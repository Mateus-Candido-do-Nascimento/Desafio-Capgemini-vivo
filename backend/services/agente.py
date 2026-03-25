from models.schemas import EventoSensor, DecisaoIA, MensagemWS
from providers.ia_provider import IAProvider
from services.broadcaster import BroadcasterService
from services.analytics import AnalyticsService
from services.psicometria import avaliar


class AgenteService:
    """
    Orquestra o ciclo: evento → IA → broadcast → analytics.

    Otimização de tokens:
      - Só faz broadcast completo quando o estado muda
      - Estado idle não aciona a IA (tratado no GroqProvider)
      - Mantém último estado para comparação
    """

    def __init__(
        self,
        ia: IAProvider,
        broadcaster: BroadcasterService,
        analytics: AnalyticsService,
    ):
        self._ia          = ia
        self._broadcaster = broadcaster
        self._analytics   = analytics
        self._ultimo_estado_broadcast: str = "idle"

    async def processar(
        self,
        evento: EventoSensor,
        tipo: str = "evento",
        landmarks: dict = None,
    ) -> DecisaoIA:
        # 1. Avaliação psicométrica (determinística, sem API)
        psico = avaliar(evento)

        # 2. Enriquece o evento com o raciocínio psicométrico
        #    O Groq recebe o contexto científico já calculado
        evento_enriquecido = evento.model_copy(update={
            "estado_estimado": psico.perfil_psico
                            if evento.estado_estimado == "aguardando"
                            else evento.estado_estimado,
        })

        # 3. IA generativa interpreta e gera ação pro vendedor
        decisao = await self._ia.analisar(evento_enriquecido)

        # 4. Injeta raciocínio psicométrico no raciocínio final
        decisao.raciocinio = f"[Psico] {psico.raciocinio_psico} | {decisao.raciocinio}"

        estado_atual = evento_enriquecido.estado_estimado
        mudou        = estado_atual != self._ultimo_estado_broadcast
        urgente      = estado_atual in ("decisao", "saindo")

        if mudou or urgente:
            self._ultimo_estado_broadcast = estado_atual
            mensagem = MensagemWS(
                tipo     = tipo,
                payload  = evento_enriquecido,
                decisao  = decisao,
                landmarks= landmarks,
                psicometria= psico,
            )
            await self._broadcaster.broadcast(mensagem)
            self._analytics.salvar(evento_enriquecido, decisao)

        return decisao
