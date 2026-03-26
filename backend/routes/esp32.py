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

# LED controlado pela acao_cliente — cada ação acende um LED diferente
# led: qual LED acende (0=nenhum, 1=LED1, 2=LED2, 3=LED3)
# modo: comportamento do LED no firmware
_LED = {
    "nenhuma_acao":        {"led": 0, "modo": "apagado"},
    "engajar_informar":    {"led": 1, "modo": "pulso_suave"},
    "converter_decisao":   {"led": 2, "modo": "pulso_lento"},
    "recuperar_interesse": {"led": 3, "modo": "pulso_rapido"},
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

        # 3. Traduz acao_cliente em qual LED acender e como
        led_info = _LED.get(decisao.acao_cliente, _LED["nenhuma_acao"])

        return {
            "estado":        decisao.perfil,
            "acao_cliente":  decisao.acao_cliente,
            "led":           led_info["led"],
            "led_modo":      led_info["modo"],
            "acao_vendedor": decisao.acao_vendedor,
            "urgencia":      decisao.urgencia,
            "confianca":     decisao.confianca,
        }

    return router
