from fastapi import WebSocket
from models.schemas import MensagemWS


class BroadcasterService:
    """
    Gerencia conexões WebSocket ativas e faz broadcast das mensagens.
    Responsabilidade única: quem está conectado e como enviar.
    """

    def __init__(self):
        self._conexoes: list[WebSocket] = []

    async def conectar(self, ws: WebSocket) -> None:
        await ws.accept()
        self._conexoes.append(ws)

    def desconectar(self, ws: WebSocket) -> None:
        self._conexoes.remove(ws)

    async def broadcast(self, mensagem: MensagemWS) -> None:
        payload = mensagem.model_dump_json()
        mortos = []

        for ws in self._conexoes:
            try:
                await ws.send_text(payload)
            except Exception:
                mortos.append(ws)

        for ws in mortos:
            self._conexoes.remove(ws)

    @property
    def total_conexoes(self) -> int:
        return len(self._conexoes)