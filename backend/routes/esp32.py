# ═══════════════════════════════════════════════════════════
# ROTA ESP32 — SENTIR + AGIR
# ESP32 só sente (presença + tempo) — o pensar é do backend
# Usa estado_sensor para fundir dados de câmera + ESP32
# ═══════════════════════════════════════════════════════════
from fastapi import APIRouter
from pydantic import BaseModel, Field
from services.estado_sensor import atualizar_esp32, get_evento_fundido

class FrameESP32(BaseModel):
    presenca:     bool
    tempo_parado: int   = Field(default=0, ge=0)
    distancia_cm: float = Field(default=0.0)

_LED = {
    "idle":     "apagado",
    "engajado": "pulso_suave",
    "indeciso": "pulso_lento",
    "decisao":  "fixo",
    "saindo":   "apagado",
}


def criar_router(agente):
    router = APIRouter()

    @router.post("/sensor/esp32")
    async def receber_esp32(frame: FrameESP32):
        # 1. ESP32 atualiza sua parte do quadro branco
        atualizar_esp32(frame.presenca, frame.tempo_parado)

        # 2. Backend pensa com dados completos (câmera + ESP32)
        evento  = get_evento_fundido()
        decisao = await agente.processar(evento, tipo="esp32")
        estado  = decisao.perfil

        # 3. Traduz decisão em ação física para o cliente
        led = _LED.get(estado, "apagado")

        return {
            "estado":       estado,
            "led":          led,
            "acao_vendedor":decisao.acao_vendedor,
            "urgencia":     decisao.urgencia,
            "confianca":    decisao.confianca,
        }

    return router
