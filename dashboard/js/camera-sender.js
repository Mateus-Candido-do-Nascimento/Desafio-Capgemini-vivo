// ═══════════════════════════════════════════════════════════
// CAMERA-SENDER — comunicação com backend + log local
// Responsabilidade: enviar dados e registrar eventos
// ═══════════════════════════════════════════════════════════

let frameCount = 0, enviando = false, ultimoEnvio = 0;

function log(msg, tipo = '') {
  const el = document.createElement('div');
  el.className = tipo ? 'log-' + tipo : '';
  el.textContent = new Date().toTimeString().slice(0,8) + '  ' + msg;
  EL.log.insertBefore(el, EL.log.firstChild);
  if (EL.log.children.length > 25) EL.log.removeChild(EL.log.lastChild);
}

async function enviarFrame(landmarks, emocao = 'neutro', subEstado = 'nenhum') {
  if (enviando) return;
  enviando = true;
  try {
    const res = await fetch(`${BACKEND}/sensor/frame`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...extrairBody(landmarks),
        emocao:     emocao,
        sub_estado: subEstado,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    frameCount++;
    EL.frameCount.textContent = frameCount;

    const estado = data.estado || 'idle';
    const conf   = data.decisao?.confianca ?? 0;
    EL.estadoAtual.textContent    = estado.toUpperCase();
    EL.estadoAtual.style.color    = CORES[estado] || '#4a5a70';
    EL.confiancaBadge.innerHTML   = `CONF ${Math.round(conf * 100)}%<br>frames: ${frameCount}`;
    EL.v_estado_backend.textContent = estado.toUpperCase();
    EL.v_estado_backend.style.color = CORES[estado] || '#4a5a70';
    EL.statusTxt.textContent      = 'transmitindo';
    EL.statusTxt.style.color      = '#00e5a0';
    log(`↑ ${estado} | conf=${Math.round(conf*100)}%`, 'ok');
  } catch (err) {
    EL.statusTxt.textContent = 'erro';
    EL.statusTxt.style.color = '#ff3d5a';
    log(`ERRO: ${err.message}`, 'err');
  } finally {
    enviando = false;
  }
}
