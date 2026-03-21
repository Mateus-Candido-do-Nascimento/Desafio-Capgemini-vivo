from abc import ABC, abstractmethod
from models.schemas import EventoSensor, DecisaoIA


class IAProvider(ABC):
    """
    Interface para qualquer provedor de inteligência artificial.
    Trocar Groq por outro LLM = criar nova classe, não mexer em nada mais.
    """

    @abstractmethod
    def analisar(self, evento: EventoSensor) -> DecisaoIA:
        ...