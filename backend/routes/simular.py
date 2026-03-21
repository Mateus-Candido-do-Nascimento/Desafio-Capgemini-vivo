from fastapi import APIRouter, Depends
from models.schemas import SimularRequest, DecisaoIA
from services.agente import AgenteService
from providers.sensor_provider import SensorProvider

router = APIRouter(prefix="/simular", tags=["simulador"])


@router.post("/", response_model=DecisaoIA)
async def simular_evento(
    req: SimularRequest,
    agente: AgenteService = Depends(),
    sensor: SensorProvider = Depends(),
) -> DecisaoIA:
    """
    Gera um evento simulado e processa como se fosse real.
    Usado durante o desenvolvimento sem ESP32 físico.
    """
    evento = sensor.gerar_evento(req.cenario)
    return await agente.processar(evento, tipo="simulacao")


@router.get("/{cenario}", response_model=DecisaoIA)
async def simular_get(
    cenario: str,
    agente: AgenteService = Depends(),
    sensor: SensorProvider = Depends(),
) -> DecisaoIA:
    """
    Atalho GET para simular — fácil de testar direto no browser.
    Ex: GET /simular/indeciso
    """
    evento = sensor.gerar_evento(
        None if cenario == "aleatorio" else cenario
    )
    return await agente.processar(evento, tipo="simulacao")