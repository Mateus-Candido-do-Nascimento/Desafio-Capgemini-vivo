from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from models.schemas import MensagemWS
from providers.groq_provider import GroqProvider
from services.broadcaster import BroadcasterService
from services.analytics import AnalyticsService
from services.agente import AgenteService
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from routes import evento, camera, esp32
# ─────────────────────────────────────────
# Instâncias únicas (injeção manual)
# ─────────────────────────────────────────

broadcaster = BroadcasterService()
analytics   = AnalyticsService()
ia          = GroqProvider()
agente      = AgenteService(ia=ia, broadcaster=broadcaster, analytics=analytics)


# ─────────────────────────────────────────
# App
# ─────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("OlhoVivo AI online")
    yield
    print("OlhoVivo AI encerrado")

app = FastAPI(
    title="OlhoVivo AI",
    version="0.1.0-mvp",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────
# Dashboard estático
# ─────────────────────────────────────────

DASHBOARD_DIR = Path(__file__).parent.parent / "dashboard"
if DASHBOARD_DIR.exists():
    app.mount("/dashboard", StaticFiles(directory=str(DASHBOARD_DIR), html=True), name="dashboard")

# ─────────────────────────────────────────
# Rotas
# ─────────────────────────────────────────

app.include_router(evento.criar_router(agente=agente))
app.include_router(camera.criar_router(agente=agente))
app.include_router(esp32.criar_router(agente=agente))



@app.get("/")
async def root():
    return {
        "status": "online",
        "versao": "0.1.0-mvp",
        "dashboards_conectados": broadcaster.total_conexoes,
    }


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "dashboards_conectados": broadcaster.total_conexoes,
    }


# ─────────────────────────────────────────
# WebSocket
# ─────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await broadcaster.conectar(ws)

    await ws.send_text(
        MensagemWS(tipo="connected").model_dump_json()
    )

    try:
        while True:
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_text(
                    MensagemWS(tipo="pong").model_dump_json()
                )
    except WebSocketDisconnect:
        broadcaster.desconectar(ws)