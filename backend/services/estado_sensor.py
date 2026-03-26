# ═══════════════════════════════════════════════════════════
# ESTADO SENSOR — quadro branco compartilhado entre sensores
#
# Câmera escreve: attention, hesitation, emocao, sub_estado
# ESP32  escreve: presenca, tempo_parado
# Backend lê o quadro completo para pensar (psicometria + Groq)
# ═══════════════════════════════════════════════════════════
from models.schemas import EventoSensor

_estado = {
    # Câmera (MediaPipe)
    "attention_score":  0.0,
    "hesitation_score": 0.0,
    "emocao":           "neutro",
    "sub_estado":       "nenhum",
    "estado_estimado":  "aguardando",
    "postura":          "em_pe",
    "movimento":        "baixo",
    # ESP32 (HC-SR04)
    "presenca":         False,
    "tempo_parado":     0,
}


def atualizar_camera(evento: EventoSensor):
    """Câmera atualiza sua parte do quadro."""
    _estado["attention_score"]  = evento.attention_score
    _estado["hesitation_score"] = evento.hesitation_score
    _estado["emocao"]           = evento.emocao or "neutro"
    _estado["sub_estado"]       = evento.sub_estado or "nenhum"
    _estado["estado_estimado"]  = evento.estado_estimado
    _estado["postura"]          = evento.postura
    _estado["movimento"]        = evento.movimento
    # Câmera também informa presença via visibility
    _estado["presenca"]         = evento.presenca


def atualizar_esp32(presenca: bool, tempo_parado: int):
    """ESP32 atualiza sua parte do quadro."""
    _estado["presenca"]     = presenca
    _estado["tempo_parado"] = tempo_parado


def get_evento_fundido() -> EventoSensor:
    """Retorna EventoSensor com dados completos de todos os sensores."""
    return EventoSensor(**_estado)
