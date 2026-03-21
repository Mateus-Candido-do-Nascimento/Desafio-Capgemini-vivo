import sqlite3
from pathlib import Path
from datetime import datetime

from models.schemas import EventoSensor, DecisaoIA

DB_PATH = Path(__file__).parent.parent / "data" / "analytics.db"


class AnalyticsService:
    """
    Persiste eventos e decisões no SQLite para análise posterior.
    Responsabilidade única: salvar e consultar histórico.
    """

    def __init__(self):
        DB_PATH.parent.mkdir(exist_ok=True)
        self._inicializar_banco()

    def _inicializar_banco(self) -> None:
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS eventos (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    device_id   TEXT,
                    setor       TEXT,
                    presenca    INTEGER,
                    postura     TEXT,
                    estado      TEXT,
                    attention   REAL,
                    hesitation  REAL,
                    perfil_ia   TEXT,
                    confianca   REAL,
                    urgencia    TEXT,
                    latencia_ms INTEGER,
                    criado_em   TEXT
                )
            """)

    def salvar(self, evento: EventoSensor, decisao: DecisaoIA) -> None:
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("""
                INSERT INTO eventos (
                    device_id, setor, presenca, postura, estado,
                    attention, hesitation, perfil_ia, confianca,
                    urgencia, latencia_ms, criado_em
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                evento.device_id,
                evento.setor,
                int(evento.presenca),
                evento.postura,
                evento.estado_estimado,
                evento.attention_score,
                evento.hesitation_score,
                decisao.perfil,
                decisao.confianca,
                decisao.urgencia,
                decisao.latencia_ms,
                datetime.now().isoformat(),
            ))

    def ultimos(self, limite: int = 20) -> list[dict]:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                "SELECT * FROM eventos ORDER BY id DESC LIMIT ?", (limite,)
            ).fetchall()
            return [dict(r) for r in rows]