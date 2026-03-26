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

# LED por estado de decisão (regra comercial).
# 1) engajado → destacar produto e diferenciais
# 2) indeciso → oferecer incentivo/plano com desconto
# 3) decisao  → apoiar fechamento e remover objeções finais
_LED_POR_ESTADO = {
    "engajado": {"led": 1, "modo": "pulso_suave"},
    "indeciso": {"led": 2, "modo": "pulso_lento"},
    "decisao":  {"led": 3, "modo": "pulso_rapido"},
}

_ACAO_VENDEDOR_PADRAO = {
    "engajado": "Descreva os diferenciais do aparelho e por que ele é o melhor.",
    "indeciso": "Ofereça plano com desconto no combo aparelho + plano.",
    "decisao":  "Conduza o fechamento e responda dúvidas finais com objetividade.",}

def criar_router(agente):
    router = APIRouter()

    @router.post("/sensor/esp32")
    async def receber_esp32(frame: FrameESP32):
        # 1. ESP32 atualiza sua parte do quadro branco
        atualizar_esp32(frame.presenca, frame.tempo_parado)

        # 2. Backend pensa com dados completos (câmera + ESP32)
        evento  = get_evento_fundido()
        decisao = await agente.processar(evento, tipo="esp32")

        # 3. Traduz estado em qual LED acender e como
        led_info = _LED_POR_ESTADO.get(decisao.perfil, {"led": 0, "modo": "apagado"})
        acao_vendedor = _ACAO_VENDEDOR_PADRAO.get(decisao.perfil, decisao.acao_vendedor)

        return {
            "estado":        decisao.perfil,
            "acao_cliente":  decisao.acao_cliente,
            "led":           led_info["led"],
            "led_modo":      led_info["modo"],
            "acao_vendedor": acao_vendedor,
            "urgencia":      decisao.urgencia,
            "confianca":     decisao.confianca,
        }

    return router
