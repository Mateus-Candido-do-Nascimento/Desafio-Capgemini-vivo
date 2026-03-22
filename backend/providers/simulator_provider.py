import random
from datetime import datetime
from typing import Optional

from providers.sensor_provider import SensorProvider
from models.schemas import EventoSensor

# ── Cenários mapeados nos 5 estados operacionais ───────────
# Cada cenário gera um EventoSensor com sinais comportamentais
# coerentes com o estado. O backend não manda "gesto" —
# manda proxies observáveis. A IA classifica o estado.

CENARIOS = {
    "idle": {
        "postura":          "em_pe_neutro",
        "estado_estimado":  "idle",
        "movimento":        "baixo",
        "tempo_parado":     (3, 10),
        "attention_score":  (0.10, 0.30),
        "hesitation_score": (0.05, 0.20),
    },
    "engajado": {
        "postura":          "orientado_produto",
        "estado_estimado":  "engajado",
        "movimento":        "medio",
        "tempo_parado":     (8, 20),
        "attention_score":  (0.65, 0.90),
        "hesitation_score": (0.10, 0.30),
    },
    "indeciso": {
        "postura":          "oscilando_orientacao",
        "estado_estimado":  "indeciso",
        "movimento":        "baixo",
        "tempo_parado":     (15, 40),
        "attention_score":  (0.40, 0.65),
        "hesitation_score": (0.60, 0.90),
    },
    "decisao": {
        "postura":          "alcancando_produto",
        "estado_estimado":  "decisao",
        "movimento":        "medio",
        "tempo_parado":     (5, 15),
        "attention_score":  (0.80, 0.98),
        "hesitation_score": (0.05, 0.20),
    },
    "saindo": {
        "postura":          "rotacionado_saida",
        "estado_estimado":  "saindo",
        "movimento":        "alto",
        "tempo_parado":     (20, 45),
        "attention_score":  (0.10, 0.35),
        "hesitation_score": (0.40, 0.65),
    },
    "sem_presenca": {
        "postura":          "ausente",
        "estado_estimado":  "idle",
        "movimento":        "nenhum",
        "tempo_parado":     (0, 0),
        "attention_score":  (0.0, 0.0),
        "hesitation_score": (0.0, 0.0),
    },
}

CENARIOS_COM_PRESENCA = [
    c for c in CENARIOS if c != "sem_presenca"
]

ALIASES = {
    "medo":            "indeciso",
    "comprando":       "decisao",
    "quase_comprando": "decisao",
    "prestes_a_sair":  "saindo",
    "pesquisa":        "engajado",
    "pesquisando":     "engajado",
    "medo_de_errar":   "indeciso",
    "ausente":         "sem_presenca",
}


class SimulatorProvider(SensorProvider):
    """
    Implementação de SensorProvider que gera eventos sintéticos.
    Usa os 5 estados operacionais oficiais do MVP.
    Substitui o ESP32 físico durante o desenvolvimento.
    """

    def gerar_evento(self, cenario: Optional[str] = None) -> EventoSensor:
        if cenario is None:
            cenario = random.choice(CENARIOS_COM_PRESENCA)

        cenario = ALIASES.get(cenario, cenario)

        if cenario not in CENARIOS:
            raise ValueError(
                f"Cenário '{cenario}' inválido. "
                f"Opções: {list(CENARIOS.keys())}"
            )

        c           = CENARIOS[cenario]
        tem_presenca = cenario != "sem_presenca"

        return EventoSensor(
            presenca         = tem_presenca,
            postura          = c["postura"],
            estado_estimado  = c["estado_estimado"],
            movimento        = c["movimento"],
            tempo_parado     = random.randint(*c["tempo_parado"]),
            attention_score  = round(random.uniform(*c["attention_score"]), 2),
            hesitation_score = round(random.uniform(*c["hesitation_score"]), 2),
            timestamp        = datetime.now(),
        )