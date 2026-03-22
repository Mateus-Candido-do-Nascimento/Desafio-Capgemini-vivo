from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


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
    
    tipo: str          # "evento" | "simulacao" | "camera" | "connected" | "pong"
    payload: Optional[EventoSensor] = None
    decisao: Optional[DecisaoIA] = None
    landmarks: Optional[dict] = None   # landmarks brutos do MediaPipe
    ts: datetime = Field(default_factory=datetime.now)


class SimularRequest(BaseModel):
    
    # Body do POST /simular.
    #cenario=None significa aleatório.
    
    cenario: Optional[str] = None