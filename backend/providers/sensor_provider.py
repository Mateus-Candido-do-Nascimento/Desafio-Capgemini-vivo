from abc import ABC, abstractmethod
from models.schemas import EventoSensor
from typing import Optional


class SensorProvider(ABC):
    """
    Interface para qualquer fonte de eventos de sensor.
    Hoje: simulador. Segunda-feira: ESP32 real.
    Nada no backend muda — só o provider injetado.
    """

    @abstractmethod
    def gerar_evento(self, cenario: Optional[str] = None) -> EventoSensor:
        ...