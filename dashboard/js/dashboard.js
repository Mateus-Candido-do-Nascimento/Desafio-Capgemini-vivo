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
  // Wireframe
  const mapaEstado = {
    'indeciso':        'indeciso',
    'quase_comprando': 'comprando',
    'prestes_a_sair':  'saindo',
    'pesquisando':     'pesquisa',
    'medo_de_errar':   'medo',
    'sem_presenca':    'ausente',
  };
  wireframeState = mapaEstado[payload.estado_estimado] || 'idle';
  targetPose     = {...(poses[wireframeState] || poses.idle)};

  // Números
  document.getElementById('tempoParado').innerHTML =
    `${payload.tempo_parado}<span class="metric-unit">s</span>`;
  document.getElementById('attentionScore').textContent =
    payload.attention_score.toFixed(2);
  document.getElementById('hesitationScore').textContent =
    payload.hesitation_score.toFixed(2);
  document.getElementById('movimento').textContent =
    payload.movimento.toUpperCase();

  document.getElementById('attentionScore').className =
    `metric-value ${payload.attention_score > 0.7 ? 'green' : payload.attention_score > 0.4 ? 'cyan' : 'orange'}`;
  document.getElementById('hesitationScore').className =
    `metric-value ${payload.hesitation_score > 0.6 ? 'red' : payload.hesitation_score > 0.3 ? 'orange' : 'green'}`;

  // Barras
  const atencao  = Math.round(payload.attention_score * 100);
  const intencao = decisao.perfil === 'QUASE_COMPRANDO' ? 87 :
                   decisao.perfil === 'PESQUISANDO'      ? 48 :
                   decisao.perfil === 'INDECISO'         ? 35 : 12;
  const saida    = decisao.perfil === 'PRESTES_A_SAIR'   ? 88 :
                   Math.round(payload.hesitation_score * 60);

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

  // Decisão da IA
  const mapaClasse = {
    'INDECISO':        'indeciso',
    'QUASE_COMPRANDO': 'comprando',
    'PRESTES_A_SAIR':  'saindo',
    'PESQUISANDO':     'pesquisa',
    'MEDO_DE_ERRAR':   'medo',
  };
  const tag     = document.getElementById('profileTag');
  tag.textContent = '● ' + decisao.perfil.replace(/_/g, ' ');
  tag.className   = 'profile-tag ' + (mapaClasse[decisao.perfil] || 'pesquisa');

  document.getElementById('decisionText').textContent = decisao.raciocinio;
  document.getElementById('decisionAction').querySelector('.action-icon').textContent = '💡';
  document.getElementById('actionText').textContent   = decisao.acao_vendedor;
  document.getElementById('decisionTs').textContent   = getTime();
  document.getElementById('latencyBadge').textContent = decisao.latencia_ms + 'ms';

  const conf = Math.round(decisao.confianca * 100);
  document.getElementById('confidenceFill').style.width = conf + '%';
  document.getElementById('confidencePct').textContent  = conf + '%';

  // Status sensores
  const temPresenca = payload.presenca;
  document.getElementById('espDot').className       = 'status-dot ' + (temPresenca ? '' : 'warning');
  document.getElementById('espStatus').textContent   = temPresenca ? 'ESP32 ATIVO' : 'ESP32 STANDBY';
  document.getElementById('camDot').className       = 'status-dot ' + (temPresenca ? '' : 'warning');
  document.getElementById('camStatus').textContent   = temPresenca ? 'CÂMERA ON' : 'CÂMERA PAUSADA';

  // Logs
  addLog('ESP', `presença=${payload.presenca}, postura=${payload.postura}, tempo=${payload.tempo_parado}s`);
  addLog('AI',  `perfil=${decisao.perfil}, conf=${conf}%, ${decisao.latencia_ms}ms`);

  // Timeline
  const tlColor = decisao.urgencia === 'CRITICA' ? '#ff3d5a' :
                  decisao.urgencia === 'ALTA'     ? '#ff7340' :
                  decisao.urgencia === 'MEDIA'    ? '#ffd060' : '#00b4ff';
  addTimeline(decisao.raciocinio, tlColor, 'GROQ / Llama 3.3 70B → OlhoVivo Agent');

  // Alerta
  if (decisao.urgencia === 'CRITICA' || decisao.perfil === 'PRESTES_A_SAIR') {
    showAlert(decisao.acao_display);
  }

  // Stats
  stats.eventos++;
  if (decisao.urgencia === 'CRITICA' || decisao.urgencia === 'ALTA') stats.alertas++;
  if (decisao.perfil === 'QUASE_COMPRANDO') stats.vendas++;
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