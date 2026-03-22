from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional
from models.schemas import EventoSensor
from services.agente import AgenteService

router = APIRouter(prefix="/sensor", tags=["camera"])


class FrameMediaPipe(BaseModel):
    """
    Dados brutos enviados pelo MediaPipe Pose rodando no browser do celular.
    Landmarks são coordenadas normalizadas (0.0 a 1.0) dos joints do corpo.
    """
    # Joints principais do MediaPipe Pose (índices do modelo)
    nose_y:           float = Field(default=0.5, ge=0.0, le=1.0)
    left_shoulder_x:  float = Field(default=0.4, ge=0.0, le=1.0)
    left_shoulder_y:  float = Field(default=0.4, ge=0.0, le=1.0)
    right_shoulder_x: float = Field(default=0.6, ge=0.0, le=1.0)
    right_shoulder_y: float = Field(default=0.4, ge=0.0, le=1.0)
    left_hip_x:       float = Field(default=0.4, ge=0.0, le=1.0)
    left_hip_y:       float = Field(default=0.6, ge=0.0, le=1.0)
    right_hip_x:      float = Field(default=0.6, ge=0.0, le=1.0)
    right_hip_y:      float = Field(default=0.6, ge=0.0, le=1.0)
    left_wrist_x:     float = Field(default=0.3, ge=0.0, le=1.0)
    left_wrist_y:     float = Field(default=0.6, ge=0.0, le=1.0)
    right_wrist_x:    float = Field(default=0.7, ge=0.0, le=1.0)
    right_wrist_y:    float = Field(default=0.6, ge=0.0, le=1.0)
    visibility:       float = Field(default=1.0, ge=0.0, le=1.0)
    timestamp:        Optional[str] = None


def criar_router(agente: AgenteService) -> APIRouter:

    @router.post("/frame")
    async def receber_frame(frame: FrameMediaPipe) -> dict:
        """
        Recebe landmarks do MediaPipe, traduz para EventoSensor e processa.
        Nenhuma imagem é armazenada — só coordenadas abstratas.
        """
        evento = _traduzir_frame(frame)
        decisao = await agente.processar(evento, tipo="camera")
        return {"status": "processado", "estado": evento.estado_estimado, "decisao": decisao}

    return router


def _traduzir_frame(frame: FrameMediaPipe) -> EventoSensor:
    """
    Traduz landmarks do MediaPipe em EventoSensor com estado operacional.
    Usa regras de inferência do documento comportamental.
    """
    # Inclinação frontal — diferença Y entre ombros e quadril
    shoulder_y  = (frame.left_shoulder_y + frame.right_shoulder_y) / 2
    hip_y       = (frame.left_hip_y + frame.right_hip_y) / 2
    lean_front  = shoulder_y - hip_y  # positivo = inclinado para frente

    # Orientação lateral — assimetria entre ombros
    shoulder_dx = abs(frame.left_shoulder_x - frame.right_shoulder_x)

    # Altura dos pulsos — braço levantado indica alcance
    wrist_y_avg = (frame.left_wrist_y + frame.right_wrist_y) / 2
    arm_raised  = wrist_y_avg < shoulder_y  # pulso acima do ombro

    # Posição da cabeça — olhando para baixo indica leitura de produto
    head_down   = frame.nose_y > shoulder_y + 0.05

    # attention_score — baseado em inclinação frontal e orientação
    attention = min(1.0, max(0.0,
        0.4 + lean_front * 1.5 + (0.2 if arm_raised else 0)
    ))

    # hesitation_score — baseado em simetria e pouco movimento
    hesitation = min(1.0, max(0.0,
        0.8 - shoulder_dx * 2.0
    ))

    # Inferência do estado operacional
    estado = _inferir_estado(
        attention   = attention,
        hesitation  = hesitation,
        lean_front  = lean_front,
        arm_raised  = arm_raised,
        shoulder_dx = shoulder_dx,
        visibility  = frame.visibility,
    )

    # Postura descritiva
    if arm_raised:
        postura = "alcancando_produto"
    elif head_down:
        postura = "lendo_etiqueta"
    elif shoulder_dx < 0.1:
        postura = "rotacionado_saida"
    elif lean_front > 0.05:
        postura = "orientado_produto"
    else:
        postura = "em_pe_neutro"

    return EventoSensor(
        presenca         = frame.visibility > 0.5,
        postura          = postura,
        estado_estimado  = estado,
        movimento        = "medio" if arm_raised else "baixo",
        tempo_parado     = 0,
        attention_score  = round(attention, 2),
        hesitation_score = round(hesitation, 2),
    )


def _inferir_estado(
    attention:   float,
    hesitation:  float,
    lean_front:  float,
    arm_raised:  bool,
    shoulder_dx: float,
    visibility:  float,
) -> str:
    """
    Regras de inferência baseadas no documento comportamental.
    Retorna um dos 5 estados operacionais válidos.
    """
    if visibility < 0.5:
        return "idle"

    if arm_raised and attention > 0.7:
        return "decisao"

    if shoulder_dx < 0.08:
        return "saindo"

    if attention > 0.6 and hesitation < 0.4:
        return "engajado"

    if hesitation > 0.55 and attention < 0.7:
        return "indeciso"

    if attention > 0.45:
        return "engajado"

    return "idle"