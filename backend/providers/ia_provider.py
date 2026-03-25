from abc import ABC, abstractmethod
from typing import Optional
from models.schemas import EventoSensor, DecisaoIA, AvaliacaoPsicometrica


class IAProvider(ABC):
    """
    Interface para qualquer provedor de inteligência artificial.
    Trocar Groq por outro LLM = criar nova classe, não mexer em nada mais.
    """

    @abstractmethod
    async def analisar(
        self,
        evento: EventoSensor,
        psico: Optional[AvaliacaoPsicometrica] = None,
    ) -> DecisaoIA:
        ...