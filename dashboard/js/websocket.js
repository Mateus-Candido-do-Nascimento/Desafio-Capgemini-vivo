// ═══════════════════════════════════════════════════════════
// WEBSOCKET — conexão com o backend
// Responsabilidade: conectar, reconectar, receber mensagens
// ═══════════════════════════════════════════════════════════

let ws            = null;
let wsReconectando = false;

  function conectarWS() {
    const hostname = window.location.hostname;
  
    let wsUrl;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      wsUrl = 'ws://localhost:8000/ws';
    }else {
      wsUrl = `wss://${hostname}/ws`;
    }

    ws = new WebSocket(wsUrl);
  ws.onopen = () => {
    document.getElementById('aiDot').className     = 'status-dot';
    document.getElementById('aiStatus').textContent = 'GROQ CONECTADO';
    addLog('SYS', 'WebSocket conectado ao backend');
    wsReconectando = false;

    setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send('ping');
    }, 20000);
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    console.log('ws recebido:',msg);
    if (msg.tipo === 'pong' || msg.tipo === 'connected') return;
    if (!msg.payload || !msg.decisao) return;
    atualizarMetricas(msg.payload, msg.decisao, msg.landmarks || null, msg.psicometria || null);

  };

  ws.onclose = () => {
    document.getElementById('aiDot').className     = 'status-dot warning';
    document.getElementById('aiStatus').textContent = 'RECONECTANDO...';
    addLog('SYS', 'WebSocket desconectado — reconectando em 3s...');
    if (!wsReconectando) {
      wsReconectando = true;
      setTimeout(conectarWS, 3000);
    }
  };

  ws.onerror = () => {
    addLog('SYS', 'Erro no WebSocket — backend offline?');
  };
}

conectarWS();