import random
from datetime import datetime
from typing import Optional

from providers.sensor_provider import SensorProvider
from models.schemas import EventoSensor

CENARIOS = {
    "indeciso": {
        "postura": "olhando_produto",
        "estado_estimado": "indeciso",
        "movimento": "baixo",
        "tempo_parado": (10, 25),
        "attention_score": (0.65, 0.85),
        "hesitation_score": (0.55, 0.75),
    },
    "quase_comprando": {
        "postura": "inclinado_produto",
        "estado_estimado": "quase_comprando",
        "movimento": "medio",
        "tempo_parado": (18, 35),
        "attention_score": (0.80, 0.95),
        "hesitation_score": (0.10, 0.30),
    },
    "prestes_a_sair": {
        "postura": "virando_saida",
        "estado_estimado": "prestes_a_sair",
        "movimento": "alto",
        "tempo_parado": (25, 45),
        "attention_score": (0.20, 0.40),
        "hesitation_score": (0.45, 0.65),
    },
    "pesquisando": {
        "postura": "olhando_varios",
        "estado_estimado": "pesquisando",
        "movimento": "medio",
        "tempo_parado": (5, 15),
        "attention_score": (0.50, 0.70),
        "hesitation_score": (0.30, 0.50),
    },
    "medo_de_errar": {
        "postura": "verificando_detalhes",
        "estado_estimado": "medo_de_errar",
        "movimento": "baixo",
        "tempo_parado": (15, 30),
        "attention_score": (0.60, 0.80),
        "hesitation_score": (0.70, 0.90),
    },
    "sem_presenca": {
        "postura": "ausente",
        "estado_estimado": "sem_presenca",
        "movimento": "nenhum",
        "tempo_parado": (0, 0),
        "attention_score": (0.0, 0.0),
        "hesitation_score": (0.0, 0.0),
    },
}

CENARIOS_COM_PRESENCA = [c for c in CENARIOS if c != "sem_presenca"]

ALIASES = {
    "medo":      "medo_de_errar",
    "comprando": "quase_comprando",
    "saindo":    "prestes_a_sair",
    "pesquisa":  "pesquisando",
}

class SimulatorProvider(SensorProvider):
    """
    Implementação de SensorProvider que gera eventos sintéticos.
    Substitui o ESP32 físico durante o desenvolvimento.
    Na segunda-feira: trocar por ESP32Provider sem mudar mais nada.
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

        c = CENARIOS[cenario]
        tem_presenca = cenario != "sem_presenca"

        return EventoSensor(
            presenca=tem_presenca,
            postura=c["postura"],
            estado_estimado=c["estado_estimado"],
            movimento=c["movimento"],
            tempo_parado=random.randint(*c["tempo_parado"]),
            attention_score=round(random.uniform(*c["attention_score"]), 2),
            hesitation_score=round(random.uniform(*c["hesitation_score"]), 2),
            timestamp=datetime.now(),
        )