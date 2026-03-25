from models.schemas import EventoSensor, DecisaoIA, MensagemWS
from providers.ia_provider import IAProvider
from services.broadcaster import BroadcasterService
from services.analytics import AnalyticsService
from services.psicometria import avaliar

_MAPA_PSICO_PARA_OFICIAL = {
    "comprador_iminente": "decisao",
    "engajado_ativo":     "engajado",
    "hesitante":          "indeciso",
    "observando":         "idle",
    "resistente":         "saindo",
}


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
        estado_psico   = psico.perfil_psico
        estado_oficial = _MAPA_PSICO_PARA_OFICIAL.get(estado_psico, "idle")

        evento_enriquecido = evento.model_copy(update={
            "estado_estimado": estado_oficial
                    if evento.estado_estimado == "aguardando"
                    else evento.estado_estimado,
        })


        # 3. IA generativa interpreta e gera ação pro vendedor
        #    Psicometria é passada para enriquecer o contexto do Groq
        decisao = await self._ia.analisar(evento_enriquecido, psico=psico)

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
