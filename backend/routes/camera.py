from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional
from models.schemas import EventoSensor
from services.agente import AgenteService
from services.estado_sensor import atualizar_camera, get_evento_fundido

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
    # Campos adicionais para inferência de estado operacional:
    emocao:     str = Field(default='neutro')
    sub_estado: str = Field(default='nenhum')
    timestamp:        Optional[str] = None


# Calibração adaptativa de hesitação — se ajusta à distância da câmera
_shoulder_dx_max: float = 0.25


def criar_router(agente: AgenteService) -> APIRouter:

    @router.post("/frame")
    async def receber_frame(frame: FrameMediaPipe) -> dict:
        """
        Recebe landmarks do MediaPipe, traduz para EventoSensor e processa.
        Nenhuma imagem é armazenada — só coordenadas abstratas.
        """
        evento  = _traduzir_frame(frame)
        atualizar_camera(evento)
        evento_fundido = get_evento_fundido()
        decisao = await agente.processar(evento_fundido, tipo="camera", landmarks=frame.model_dump())
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
    lean_front  = shoulder_y - hip_y  # negativo em câmera frontal (ombro acima do quadril)

    # Orientação lateral — assimetria entre ombros
    # Valor alto = pessoa de frente; valor baixo = pessoa de lado (saindo)
    shoulder_dx = abs(frame.left_shoulder_x - frame.right_shoulder_x)

    # Altura dos pulsos — braço levantado indica alcance de produto
    wrist_y_avg = (frame.left_wrist_y + frame.right_wrist_y) / 2
    arm_raised  = wrist_y_avg < shoulder_y  # pulso acima do ombro na imagem

    # Cabeça abaixada — nariz próximo ou abaixo dos ombros (leitura de etiqueta)
    # Threshold mais generoso: 0.08 abaixo do ombro (câmera frontal)
    head_down   = frame.nose_y > shoulder_y - 0.08

    # attention_score — câmera FRONTAL: usa largura dos ombros + braço levantado
    # shoulder_dx alto = pessoa de frente = engajada
    attention = min(1.0, max(0.0,
        0.3 + shoulder_dx * 1.2 + (0.25 if arm_raised else 0) + (0.1 if head_down else 0)
    ))

    # hesitation_score — adaptativo ao máximo observado na sessão
    # Funciona para qualquer distância de câmera (loja fixa ou celular)
    global _shoulder_dx_max
    _shoulder_dx_max = max(_shoulder_dx_max, shoulder_dx * 0.98)
    hesitation = min(1.0, max(0.0,
        1.2 - (shoulder_dx / _shoulder_dx_max) * 1.2
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
        emocao           = frame.emocao,      # novo
        sub_estado       = frame.sub_estado,  # novo
    )

def _inferir_estado(
    attention:   float,
    hesitation:  float,
    lean_front:  float,
    arm_raised:  bool,
    shoulder_dx: float,
    visibility:  float,
) -> str:
    if visibility < 0.4:
        return "idle"

    # Braço levantado — alcançando produto
    if arm_raised and attention > 0.5:
        return "decisao"

    # Corpo muito de lado — saindo
    if shoulder_dx < 0.12:
        return "saindo"

    # Engajado — inclinado para frente com atenção
    if attention > 0.5 and hesitation < 0.5:
        return "engajado"

    # Indeciso — hesitação alta
    if hesitation > 0.45:
        return "indeciso"

    # Engajado fraco
    if attention > 0.35:
        return "engajado"

    return "idle"