from fastapi import APIRouter, Depends
from models.schemas import EventoSensor, DecisaoIA
from services.agente import AgenteService

router = APIRouter(prefix="/evento", tags=["evento"])


@router.post("/", response_model=DecisaoIA)
async def receber_evento(
    evento: EventoSensor,
    agente: AgenteService = Depends(),
) -> DecisaoIA:
    """
    Recebe um evento real do ESP32 + MediaPipe.
    Chama a IA e faz broadcast para os dashboards conectados.
    """
    return await agente.processar(evento, tipo="evento")