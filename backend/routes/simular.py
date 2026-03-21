from fastapi import APIRouter
from models.schemas import SimularRequest, DecisaoIA
from services.agente import AgenteService
from providers.sensor_provider import SensorProvider

router = APIRouter(prefix="/simular", tags=["simulador"])


def criar_router(agente: AgenteService, sensor: SensorProvider) -> APIRouter:
    @router.post("/", response_model=DecisaoIA)
    async def simular_evento(req: SimularRequest) -> DecisaoIA:
        evento = sensor.gerar_evento(req.cenario)
        return await agente.processar(evento, tipo="simulacao")

    @router.get("/{cenario}", response_model=DecisaoIA)
    async def simular_get(cenario: str) -> DecisaoIA:
        evento = sensor.gerar_evento(
            None if cenario == "aleatorio" else cenario
        )
        return await agente.processar(evento, tipo="simulacao")

    return router