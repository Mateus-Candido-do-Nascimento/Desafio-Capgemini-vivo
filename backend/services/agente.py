from models.schemas import EventoSensor, DecisaoIA, MensagemWS
from providers.ia_provider import IAProvider
from services.broadcaster import BroadcasterService
from services.analytics import AnalyticsService


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

        decisao = self._ia.analisar(evento)

        # Só faz broadcast e salva analytics quando há mudança de estado
        # ou quando o estado é urgente (decisao / saindo)
        estado_atual = evento.estado_estimado
        mudou        = estado_atual != self._ultimo_estado_broadcast
        urgente      = estado_atual in ("decisao", "saindo")

        if mudou or urgente:
            self._ultimo_estado_broadcast = estado_atual

            mensagem = MensagemWS(
                tipo     = tipo,
                payload  = evento,
                decisao  = decisao,
                landmarks= landmarks,
            )
            await self._broadcaster.broadcast(mensagem)
            self._analytics.salvar(evento, decisao)

        return decisao