// ═══════════════════════════════════════════════════════════
// CAMERA-CONFIG — constantes, cache DOM, backend URL
// Responsabilidade: configuração centralizada
// ═══════════════════════════════════════════════════════════

const INTERVALO_MS = 2000;
const CORES = {
  idle:     '#4a5a70',
  engajado: '#00b4ff',
  indeciso: '#ffd060',
  decisao:  '#00e5a0',
  saindo:   '#ff3d5a'
};

// Cache de elementos DOM — resolvidos uma vez no boot
const EL = {
  video:          document.getElementById('video'),
  poseCanvas:     document.getElementById('poseCanvas'),
  estadoAtual:    document.getElementById('estadoAtual'),
  confiancaBadge: document.getElementById('confiancaBadge'),
  frameCount:     document.getElementById('frameCount'),
  statusTxt:      document.getElementById('statusTxt'),
  intervaloTxt:   document.getElementById('intervaloTxt'),
  backendInput:   document.getElementById('backendInput'),
  log:            document.getElementById('log'),
  v_lean:         document.getElementById('v_lean'),
  v_sdx:          document.getElementById('v_sdx'),
  v_arm:          document.getElementById('v_arm'),
  v_head:         document.getElementById('v_head'),
  v_att:          document.getElementById('v_att'),
  v_hes:          document.getElementById('v_hes'),
  v_vis:          document.getElementById('v_vis'),
  v_estado_local:   document.getElementById('v_estado_local'),
  v_estado_backend: document.getElementById('v_estado_backend'),
  b_lean: document.getElementById('b_lean'),
  b_sdx:  document.getElementById('b_sdx'),
  b_att:  document.getElementById('b_att'),
  b_hes:  document.getElementById('b_hes'),
  v_sub_estado: document.getElementById('v_sub_estado'),
  v_eye:        document.getElementById('v_eye'),
  v_furrow:     document.getElementById('v_furrow'),
  v_curve:      document.getElementById('v_curve'),
  v_emocao:     document.getElementById('v_emocao'),

};

const poseCtx = EL.poseCanvas.getContext('2d');

// Detecção e persistência do backend
function detectarBackend() {
  const salvo = localStorage.getItem('olhovivo_backend');
  if (salvo) return salvo;
  const h = window.location.hostname;
  return (h === 'localhost' || h === '127.0.0.1')
    ? 'http://localhost:8000'
    : `${window.location.protocol}//${h}`;
}

let BACKEND = detectarBackend();
EL.backendInput.value = BACKEND;

function salvarBackend() {
  BACKEND = EL.backendInput.value.trim().replace(/\/$/, '');
  localStorage.setItem('olhovivo_backend', BACKEND);
  log('Backend salvo: ' + BACKEND, 'info');
}
