from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, field_validator

#Um conjunto com os únicos 5 valores aceitos. Fica fora da classe porque é uma constante do domínio — outros arquivos vão poder importar isso também.

ESTADOS_VALIDOS = {"idle","engajado","indeciso","decisao","saindo"}

class EventoSensor(BaseModel):
   
    # Payload enviado pelo ESP32 + MediaPipe ao backend.
    
    device_id: str = Field(default="esp32-loja-01")
    setor: str = Field(default="eletronicos")
    presenca: bool
    tempo_parado: int = Field(default=0, ge=0)
    movimento: str = Field(default="baixo")
    postura: str = Field(default="em_pe")
    estado_estimado: str = Field(default="aguardando")
    attention_score: float = Field(default=0.0, ge=0.0, le=1.0)
    hesitation_score: float = Field(default=0.0, ge=0.0, le=1.0)
    timestamp: datetime = Field(default_factory=datetime.now)
    
    #Validador do Pydantic — roda automaticamente toda vez que um `EventoSensor` é criado. Se o estado não for um dos 5 válidos, o Pydantic rejeita o objeto antes mesmo de chegar no service. O erro aparece na resposta HTTP com status 422.
    
    @field_validator("estado_estimado")
    @classmethod
    def validar_estado(cls, v: str) -> str:
        if v not in ESTADOS_VALIDOS:
            raise ValueError(
                f"Estado '{v}' inválido. "
                f"Use um dos 5 estados operacionais: {ESTADOS_VALIDOS}"
            )
        return v


class DecisaoIA(BaseModel):
   
    # Resposta do agente de IA após interpretar um EventoSensor.
    
    perfil: str
    confianca: float = Field(ge=0.0, le=1.0)
    raciocinio: str
    acao_display: str
    acao_vendedor: str
    urgencia: str
    latencia_ms: int
    erro: bool = False


class MensagemWS(BaseModel):
    
    # Estrutura enviada via WebSocket para o dashboard.
    
    tipo: str          # "evento" | "simulacao" | "connected" | "pong"
    payload: Optional[EventoSensor] = None
    decisao: Optional[DecisaoIA] = None
    ts: datetime = Field(default_factory=datetime.now)


class SimularRequest(BaseModel):
    
    # Body do POST /simular.
    #cenario=None significa aleatório.
    
    cenario: Optional[str] = None