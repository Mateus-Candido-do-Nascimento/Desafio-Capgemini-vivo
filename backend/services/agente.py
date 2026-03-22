from models.schemas import EventoSensor, DecisaoIA, MensagemWS
from providers.ia_provider import IAProvider
from services.broadcaster import BroadcasterService
from services.analytics import AnalyticsService


class AgenteService:
    """
    Orquestra o ciclo completo: evento → IA → broadcast → analytics.
    Não sabe qual IA está sendo usada, nem como o WS funciona.
    Depende de abstrações (IAProvider), não de implementações (Groq).
    """

    def __init__(
        self,
        ia: IAProvider,
        broadcaster: BroadcasterService,
        analytics: AnalyticsService,
    ):
        self._ia = ia
        self._broadcaster = broadcaster
        self._analytics = analytics

    async def processar(self, evento: EventoSensor, tipo: str = "evento", landmarks: dict = None) -> DecisaoIA:
        decisao = self._ia.analisar(evento)

        mensagem = MensagemWS(
            tipo=tipo,
            payload=evento,
            decisao=decisao,
            landmarks=landmarks,
        )

        await self._broadcaster.broadcast(mensagem)
        self._analytics.salvar(evento, decisao)

        return decisao