from fastapi import APIRouter
from models.schemas import EventoSensor, DecisaoIA
from services.agente import AgenteService

router = APIRouter(prefix="/evento", tags=["evento"])


def criar_router(agente: AgenteService) -> APIRouter:
    @router.post("/", response_model=DecisaoIA)
    async def receber_evento(evento: EventoSensor) -> DecisaoIA:
        return await agente.processar(evento, tipo="evento")

    return router