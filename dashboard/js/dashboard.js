// ═══════════════════════════════════════════════════════════
// DASHBOARD — estado global, UI helpers, simulador local
// Responsabilidade: gerenciar estado e atualizar a tela
// ═══════════════════════════════════════════════════════════

let stats        = { eventos: 0, alertas: 0, vendas: 0 };
let alertTimeout = null;
let autoMode     = false;
let autoCycle    = null;
let autoCycleIdx = 0;

const autoCycleList = ['indeciso','pesquisa','comprando','medo_de_errar','saindo','ausente'];

// ── Clock ──────────────────────────────────────────────────

function getTime() {
  return new Date().toTimeString().slice(0, 8);
}

function updateClock() {
  document.getElementById('headerTime').textContent = getTime();
}

setInterval(updateClock, 1000);
updateClock();

// ── Log de eventos ─────────────────────────────────────────

function addLog(type, msg) {
  const log      = document.getElementById('eventLog');
  const el       = document.createElement('div');
  el.className   = 'ev-item';
  const srcClass = type === 'ESP' ? 'esp' : type === 'CAM' ? 'cam' : 'ai';
  el.innerHTML   = `<span class="ev-time">${getTime()}</span><span class="ev-src ${srcClass}">${type}</span><span class="ev-msg">${msg}</span>`;
  log.insertBefore(el, log.firstChild);
  if (log.children.length > 30) log.removeChild(log.lastChild);
}

// ── Timeline ───────────────────────────────────────────────

function addTimeline(msg, color, source) {
  const tl     = document.getElementById('timeline');
  const el     = document.createElement('div');
  el.className = 'tl-item';
  el.innerHTML = `
    <span class="tl-time">${getTime()}</span>
    <div class="tl-dot" style="background:${color}; box-shadow:0 0 6px ${color}"></div>
    <div>
      <div class="tl-msg">${msg}</div>
      <div class="tl-source">${source}</div>
    </div>`;
  tl.insertBefore(el, tl.firstChild);
  if (tl.children.length > 8) tl.removeChild(tl.lastChild);
}

// ── Alerta banner ──────────────────────────────────────────

function showAlert(text) {
  const banner = document.getElementById('alertBanner');
  document.getElementById('alertText').textContent = text;
  banner.classList.add('show');
  if (alertTimeout) clearTimeout(alertTimeout);
  alertTimeout = setTimeout(() => banner.classList.remove('show'), 6000);
}

// ── Atualiza métricas na tela ──────────────────────────────
function atualizarMetricas(payload, decisao) {

  // Wireframe — chama setEstado() do wireframe.js
  setEstado(payload.estado_estimado);

  // Métricas numéricas
  document.getElementById('tempoParado').innerHTML =
    `${payload.tempo_parado}<span class="metric-unit">s</span>`;
  document.getElementById('attentionScore').textContent =
    payload.attention_score.toFixed(2);
  document.getElementById('hesitationScore').textContent =
    payload.hesitation_score.toFixed(2);
  document.getElementById('movimento').textContent =
    payload.movimento.toUpperCase();

  document.getElementById('attentionScore').className =
    `metric-value ${payload.attention_score > 0.7 ? 'green' :
                    payload.attention_score > 0.4 ? 'cyan' : 'orange'}`;
  document.getElementById('hesitationScore').className =
    `metric-value ${payload.hesitation_score > 0.6 ? 'red' :
                    payload.hesitation_score > 0.3 ? 'orange' : 'green'}`;

  // Barras
  const atencao  = Math.round(payload.attention_score * 100);
  const intencao = decisao.perfil === 'decisao'  ? 88 :
                   decisao.perfil === 'engajado'  ? 55 :
                   decisao.perfil === 'indeciso'  ? 35 : 10;
  const saida    = decisao.perfil === 'saindo'    ? 90 :
                   Math.round(payload.hesitation_score * 55);

  document.getElementById('barAtencao').style.width    = atencao + '%';
  document.getElementById('barAtencaoVal').textContent  = atencao + '%';
  document.getElementById('barIntencao').style.width    = intencao + '%';
  document.getElementById('barIntencaoVal').textContent = intencao + '%';
  document.getElementById('barSaida').style.width       = saida + '%';
  document.getElementById('barSaidaVal').textContent    = saida + '%';

  // Payload display
  document.getElementById('pSetor').textContent    = `"${payload.setor}"`;
  document.getElementById('pPostura').textContent  = `"${payload.postura}"`;
  document.getElementById('pEstado').textContent   = `"${payload.estado_estimado}"`;
  document.getElementById('pPresenca').textContent = payload.presenca ? 'true' : 'false';

  const ts = new Date().toISOString().slice(0, 19);
  document.getElementById('payloadDisplay').innerHTML = `
<span class="pk">{</span><br>
&nbsp;&nbsp;<span class="pk">"setor": </span><span class="pv-str">"${payload.setor}"</span>,<br>
&nbsp;&nbsp;<span class="pk">"presenca": </span><span class="pv-bool">${payload.presenca}</span>,<br>
&nbsp;&nbsp;<span class="pk">"tempo_parado": </span><span class="pv-num">${payload.tempo_parado}</span>,<br>
&nbsp;&nbsp;<span class="pk">"movimento": </span><span class="pv-str">"${payload.movimento}"</span>,<br>
&nbsp;&nbsp;<span class="pk">"postura": </span><span class="pv-str">"${payload.postura}"</span>,<br>
&nbsp;&nbsp;<span class="pk">"estado_estimado": </span><span class="pv-str">"${payload.estado_estimado}"</span>,<br>
&nbsp;&nbsp;<span class="pk">"attention_score": </span><span class="pv-num">${payload.attention_score.toFixed(2)}</span>,<br>
&nbsp;&nbsp;<span class="pk">"hesitation_score": </span><span class="pv-num">${payload.hesitation_score.toFixed(2)}</span>,<br>
&nbsp;&nbsp;<span class="pk">"timestamp": </span><span class="pv-str">"${ts}"</span><br>
<span class="pk">}</span>`;

  // Decisão da IA — 5 estados oficiais
  const corEstado = {
    idle:     '#4a5a70',
    engajado: '#00b4ff',
    indeciso: '#ffd060',
    decisao:  '#00e5a0',
    saindo:   '#ff3d5a',
  };
  const classeEstado = {
    idle:     'pesquisa',
    engajado: 'pesquisa',
    indeciso: 'indeciso',
    decisao:  'comprando',
    saindo:   'saindo',
  };

  const cor    = corEstado[decisao.perfil]    || corEstado.idle;
  const classe = classeEstado[decisao.perfil] || 'pesquisa';

  const tag = document.getElementById('profileTag');
  tag.textContent = '● ' + (decisao.perfil || 'idle').toUpperCase();
  tag.className   = 'profile-tag ' + classe;

  document.getElementById('decisionText').textContent = decisao.raciocinio;
  document.getElementById('decisionAction').querySelector('.action-icon').textContent = '💡';
  document.getElementById('actionText').textContent   = decisao.acao_vendedor;
  document.getElementById('decisionTs').textContent   = getTime();
  document.getElementById('latencyBadge').textContent = decisao.latencia_ms + 'ms';

  const conf = Math.round(decisao.confianca * 100);
  document.getElementById('confidenceFill').style.width = conf + '%';
  document.getElementById('confidencePct').textContent  = conf + '%';

  // Status sensores
  document.getElementById('espDot').className      = 'status-dot ' + (payload.presenca ? '' : 'warning');
  document.getElementById('espStatus').textContent  = payload.presenca ? 'ESP32 ATIVO'   : 'ESP32 STANDBY';
  document.getElementById('camDot').className      = 'status-dot ' + (payload.presenca ? '' : 'warning');
  document.getElementById('camStatus').textContent  = payload.presenca ? 'CÂMERA ON'     : 'CÂMERA PAUSADA';

  // Logs
  addLog('CAM', `estado=${payload.estado_estimado}, attn=${payload.attention_score.toFixed(2)}, hes=${payload.hesitation_score.toFixed(2)}`);
  addLog('AI',  `perfil=${decisao.perfil}, conf=${conf}%, ${decisao.latencia_ms}ms`);

  // Timeline
  addTimeline(decisao.raciocinio, cor, 'GROQ / Llama 3.3 70B → OlhoVivo Agent');

  // Alerta
  if (decisao.urgencia === 'CRITICA' || decisao.perfil === 'saindo') {
    showAlert(decisao.acao_display);
  }

  // Stats
  stats.eventos++;
  if (decisao.urgencia === 'ALTA' || decisao.urgencia === 'CRITICA') stats.alertas++;
  if (decisao.perfil === 'decisao') stats.vendas++;
  document.getElementById('statEventos').textContent = stats.eventos;
  document.getElementById('statAlertas').textContent = stats.alertas;
  document.getElementById('statVendas').textContent  = stats.vendas;
}

// ── Auto-ciclo ─────────────────────────────────────────────

function toggleAuto() {
  autoMode = !autoMode;
  document.getElementById('autoToggle').classList.toggle('on', autoMode);
  if (autoMode) {
    autoCycle = setInterval(() => {
      fetch(`http://localhost:8000/simular/${autoCycleList[autoCycleIdx % autoCycleList.length]}`)
      autoCycleIdx++;
    }, 8000);
  } else {
    clearInterval(autoCycle);
  }
}

// ── Botões do simulador ────────────────────────────────────

function triggerScenario(cenario) {
  document.querySelectorAll('.scenario-btn').forEach(b => b.classList.remove('active'));
  const btns = ['indeciso','comprando','saindo','pesquisa','medo_de_errar','ausente'];
  const idx  = btns.indexOf(cenario);
  if (idx >= 0) document.querySelectorAll('.scenario-btn')[idx].classList.add('active');

  fetch(`http://localhost:8000/simular/${cenario}`)
    .catch(() => addLog('SYS', `Erro ao chamar /simular/${cenario} — backend online?`));
}

// ── Boot ───────────────────────────────────────────────────

setTimeout(() => addLog('SYS', 'Dashboard iniciado'), 300);
setTimeout(() => addTimeline('Sistema OlhoVivo AI inicializado.', '#00b4ff', 'SYS / Bootstrap'), 600);