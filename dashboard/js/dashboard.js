// ═══════════════════════════════════════════════════════════
// DASHBOARD — estado global, UI helpers, simulador local
// Responsabilidade: gerenciar estado e atualizar a tela
// ═══════════════════════════════════════════════════════════

let stats        = { eventos: 0, alertas: 0, vendas: 0 };
let alertTimeout = null;
let autoMode     = false;
let autoCycle    = null;
let autoCycleIdx = 0;

// ── Estados oficiais do sistema (5 estados) ────────────────
// Alinhado com: groq_provider.py, wireframe.js, schemas.py
const autoCycleList = ['engajado', 'indeciso', 'decisao', 'saindo', 'idle'];

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
function atualizarMetricas(payload, decisao, landmarks = null) {

  // Guards — protege contra campos null/undefined antes de qualquer operação
  // Isso evita o crash no .toFixed() e .toUpperCase() quando o payload
  // chega incompleto (ex: frame de câmera sem todos os campos preenchidos)
  const attention  = payload.attention_score  ?? 0;
  const hesitation = payload.hesitation_score ?? 0;
  const movimento  = payload.movimento        ?? 'baixo';
  const postura    = payload.postura          ?? 'em_pe';
  const setor      = payload.setor            ?? 'eletronicos';
  const estado     = payload.estado_estimado  ?? 'idle';
  const presenca   = payload.presenca         ?? false;
  const tempo      = payload.tempo_parado     ?? 0;

  const perfil      = decisao.perfil        ?? 'idle';
  const confianca   = decisao.confianca     ?? 0;
  const raciocinio  = decisao.raciocinio    ?? '';
  const acaoDisplay = decisao.acao_display  ?? '';
  const acaoVend    = decisao.acao_vendedor ?? '';
  const urgencia    = decisao.urgencia      ?? 'BAIXA';
  const latencia    = decisao.latencia_ms   ?? 0;

  // Wireframe — corpo real se tiver landmarks, pose animada se não tiver
  if (landmarks) {
    setLandmarks(landmarks, estado);
  } else {
    setEstado(estado);
  }

  // Métricas numéricas
  document.getElementById('tempoParado').innerHTML =
    `${tempo}<span class="metric-unit">s</span>`;
  document.getElementById('attentionScore').textContent  = attention.toFixed(2);
  document.getElementById('hesitationScore').textContent = hesitation.toFixed(2);
  document.getElementById('movimento').textContent       = movimento.toUpperCase();

  document.getElementById('attentionScore').className =
    `metric-value ${attention > 0.7 ? 'green' : attention > 0.4 ? 'cyan' : 'orange'}`;
  document.getElementById('hesitationScore').className =
    `metric-value ${hesitation > 0.6 ? 'red' : hesitation > 0.3 ? 'orange' : 'green'}`;

  // Barras
  const barAtencao  = Math.round(attention * 100);
  const barIntencao = perfil === 'decisao'  ? 88 :
                      perfil === 'engajado' ? 55 :
                      perfil === 'indeciso' ? 35 : 10;
  const barSaida    = perfil === 'saindo'
    ? 90
    : Math.round(hesitation * 55);

  document.getElementById('barAtencao').style.width     = barAtencao + '%';
  document.getElementById('barAtencaoVal').textContent  = barAtencao + '%';
  document.getElementById('barIntencao').style.width    = barIntencao + '%';
  document.getElementById('barIntencaoVal').textContent = barIntencao + '%';
  document.getElementById('barSaida').style.width       = barSaida + '%';
  document.getElementById('barSaidaVal').textContent    = barSaida + '%';

  // Payload display
  document.getElementById('pSetor').textContent    = `"${setor}"`;
  document.getElementById('pPostura').textContent  = `"${postura}"`;
  document.getElementById('pEstado').textContent   = `"${estado}"`;
  document.getElementById('pPresenca').textContent = presenca ? 'true' : 'false';

  const ts = new Date().toISOString().slice(0, 19);
  document.getElementById('payloadDisplay').innerHTML = `
<span class="pk">{</span><br>
&nbsp;&nbsp;<span class="pk">"setor": </span><span class="pv-str">"${setor}"</span>,<br>
&nbsp;&nbsp;<span class="pk">"presenca": </span><span class="pv-bool">${presenca}</span>,<br>
&nbsp;&nbsp;<span class="pk">"tempo_parado": </span><span class="pv-num">${tempo}</span>,<br>
&nbsp;&nbsp;<span class="pk">"movimento": </span><span class="pv-str">"${movimento}"</span>,<br>
&nbsp;&nbsp;<span class="pk">"postura": </span><span class="pv-str">"${postura}"</span>,<br>
&nbsp;&nbsp;<span class="pk">"estado_estimado": </span><span class="pv-str">"${estado}"</span>,<br>
&nbsp;&nbsp;<span class="pk">"attention_score": </span><span class="pv-num">${attention.toFixed(2)}</span>,<br>
&nbsp;&nbsp;<span class="pk">"hesitation_score": </span><span class="pv-num">${hesitation.toFixed(2)}</span>,<br>
&nbsp;&nbsp;<span class="pk">"timestamp": </span><span class="pv-str">"${ts}"</span><br>
<span class="pk">}</span>`;

  // Decisão da IA — mapeamento dos 5 estados oficiais
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

  const cor    = corEstado[perfil]    || corEstado.idle;
  const classe = classeEstado[perfil] || 'pesquisa';

  const tag = document.getElementById('profileTag');
  tag.textContent = '● ' + perfil.toUpperCase();
  tag.className   = 'profile-tag ' + classe;

  document.getElementById('decisionText').textContent = raciocinio;
  document.getElementById('decisionAction').querySelector('.action-icon').textContent = '💡';
  document.getElementById('actionText').textContent   = acaoVend;
  document.getElementById('decisionTs').textContent   = getTime();
  document.getElementById('latencyBadge').textContent = latencia + 'ms';

  const conf = Math.round(confianca * 100);
  document.getElementById('confidenceFill').style.width = conf + '%';
  document.getElementById('confidencePct').textContent  = conf + '%';

  // Status sensores
  document.getElementById('espDot').className      = 'status-dot ' + (presenca ? '' : 'warning');
  document.getElementById('espStatus').textContent  = presenca ? 'ESP32 ATIVO'   : 'ESP32 STANDBY';
  document.getElementById('camDot').className      = 'status-dot ' + (presenca ? '' : 'warning');
  document.getElementById('camStatus').textContent  = presenca ? 'CÂMERA ON'     : 'CÂMERA PAUSADA';

  // Logs
  addLog('CAM', `estado=${estado}, attn=${attention.toFixed(2)}, hes=${hesitation.toFixed(2)}`);
  addLog('AI',  `perfil=${perfil}, conf=${conf}%, ${latencia}ms`);

  // Timeline
  addTimeline(raciocinio, cor, 'GROQ / Llama 3.3 70B → OlhoVivo Agent');

  // Alerta para estados críticos
  if (urgencia === 'CRITICA' || perfil === 'saindo') {
    showAlert(acaoDisplay);
  }

  // Stats
  stats.eventos++;
  if (urgencia === 'ALTA' || urgencia === 'CRITICA') stats.alertas++;
  if (perfil === 'decisao') stats.vendas++;
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
      fetch(`http://localhost:8000/simular/${autoCycleList[autoCycleIdx % autoCycleList.length]}`);
      autoCycleIdx++;
    }, 8000);
  } else {
    clearInterval(autoCycle);
  }
}

// ── Botões do simulador ────────────────────────────────────
// Mapeamento: nome do botão no HTML → estado oficial do sistema
const _ALIAS_CENARIO = {
  indeciso:     'indeciso',
  comprando:    'decisao',
  saindo:       'saindo',
  pesquisa:     'engajado',
  medo_de_errar:'indeciso',
  ausente:      'idle',
};

function triggerScenario(cenario) {
  document.querySelectorAll('.scenario-btn').forEach(b => b.classList.remove('active'));
  const btns = ['indeciso','comprando','saindo','pesquisa','medo_de_errar','ausente'];
  const idx  = btns.indexOf(cenario);
  if (idx >= 0) document.querySelectorAll('.scenario-btn')[idx].classList.add('active');

  // Traduz cenário legado para estado oficial antes de chamar o backend
  const cenarioNormalizado = _ALIAS_CENARIO[cenario] || cenario;
  fetch(`http://localhost:8000/simular/${cenarioNormalizado}`)
    .catch(() => addLog('SYS', `Erro ao chamar /simular/${cenarioNormalizado} — backend online?`));
}

// ── Boot ───────────────────────────────────────────────────

setTimeout(() => addLog('SYS', 'Dashboard iniciado'), 300);
setTimeout(() => addTimeline('Sistema OlhoVivo AI inicializado.', '#00b4ff', 'SYS / Bootstrap'), 600);