// ═══════════════════════════════════════════════════════════
// WIREFRAME — figura humana: corpo real (landmarks) + poses animadas
// Modo 1: setLandmarks(lm, estado) — espelha corpo real da câmera
// Modo 2: setEstado(estado)        — pose animada (simulador)
// ═══════════════════════════════════════════════════════════

const canvas = document.getElementById('wireCanvas');
const ctx    = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// ── Estado global ──────────────────────────────────────────
let wireframeState   = 'idle';
let modoLandmarks    = false;      // true = câmera real, false = simulador
let lmAtual          = null;       // landmarks brutos do backend
let lmSuavizados     = null;       // landmarks com lerp aplicado

// ── Cores por estado ───────────────────────────────────────
const COR_ESTADO = {
  idle:     '#4a5a70',
  engajado: '#00b4ff',
  indeciso: '#ffd060',
  decisao:  '#00e5a0',
  saindo:   '#ff3d5a',
};

// ── Lerp ───────────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }

// ══════════════════════════════════════════════════════════
// MODO 1 — LANDMARKS REAIS
// ══════════════════════════════════════════════════════════

// Mapeamento landmark dict → ponto canvas
// O backend envia: nose_y, left/right_shoulder_x/y,
//                  left/right_hip_x/y, left/right_wrist_x/y, visibility
// Câmera frontal → espelha X (1 - x)
// Canvas: 260 × 300 — usa margem vertical para centralizar o corpo

function lmParaCanvas(x, y) {
  const mx = (1 - x) * W;          // espelha X (câmera frontal)
  const my = y * H * 0.85 + H * 0.05; // escala vertical com margem
  return { x: mx, y: my };
}

function construirPontosReais(lm) {
  const ls = lmParaCanvas(lm.left_shoulder_x,  lm.left_shoulder_y);
  const rs = lmParaCanvas(lm.right_shoulder_x, lm.right_shoulder_y);
  const lh = lmParaCanvas(lm.left_hip_x,       lm.left_hip_y);
  const rh = lmParaCanvas(lm.right_hip_x,      lm.right_hip_y);
  const lw = lmParaCanvas(lm.left_wrist_x,     lm.left_wrist_y);
  const rw = lmParaCanvas(lm.right_wrist_x,    lm.right_wrist_y);

  // Nariz: x estimado como centro dos ombros, y do backend
  const noseX = (lm.left_shoulder_x + lm.right_shoulder_x) / 2;
  const nose  = lmParaCanvas(noseX, lm.nose_y);

  // Pescoço: centro dos ombros, um pouco acima
  const neckX = (ls.x + rs.x) / 2;
  const neckY = (ls.y + rs.y) / 2 - 8;
  const neck  = { x: neckX, y: neckY };

  // Centro do quadril
  const hipC  = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };

  // Cotovelos estimados (2/3 do caminho ombro→pulso)
  const le = { x: ls.x + (lw.x - ls.x) * 0.55, y: ls.y + (lw.y - ls.y) * 0.55 };
  const re = { x: rs.x + (rw.x - rs.x) * 0.55, y: rs.y + (rw.y - rs.y) * 0.55 };

  // Pernas estimadas (projetadas abaixo do quadril)
  const legLen = H * 0.28;
  const lk = { x: lh.x - 6,  y: lh.y + legLen * 0.5 };
  const rk = { x: rh.x + 6,  y: rh.y + legLen * 0.5 };
  const la = { x: lh.x - 10, y: lh.y + legLen };
  const ra = { x: rh.x + 10, y: rh.y + legLen };

  return { nose, neck, ls, rs, le, re, lw, rw, lh, rh, hipC, lk, rk, la, ra };
}

function suavizarLandmarks(alvo, spd = 0.18) {
  if (!lmSuavizados) {
    lmSuavizados = { ...alvo };
    return lmSuavizados;
  }
  const campos = ['nose_y','left_shoulder_x','left_shoulder_y','right_shoulder_x',
    'right_shoulder_y','left_hip_x','left_hip_y','right_hip_x','right_hip_y',
    'left_wrist_x','left_wrist_y','right_wrist_x','right_wrist_y','visibility'];
  campos.forEach(k => {
    lmSuavizados[k] = lerp(lmSuavizados[k] ?? alvo[k], alvo[k], spd);
  });
  return lmSuavizados;
}

function desenharReal(t) {
  if (!lmAtual) return;

  const lm  = suavizarLandmarks(lmAtual);
  const pts = construirPontosReais(lm);
  const cor = COR_ESTADO[wireframeState] || '#4a5a70';
  const vis = Math.min(1, lm.visibility * 1.2);

  ctx.clearRect(0, 0, W, H);
  if (vis < 0.1) {
    ctx.fillStyle = 'rgba(74,90,112,0.3)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SEM PRESENÇA', W / 2, H / 2);
    return;
  }

  // Bounding box tracejada (estética MediaPipe)
  const xs = [pts.ls.x, pts.rs.x, pts.lw.x, pts.rw.x, pts.la.x, pts.ra.x];
  const ys = [pts.nose.y, pts.la.y, pts.ra.y];
  const bbX = Math.min(...xs) - 12, bbY = Math.min(...ys) - 12;
  const bbW = Math.max(...xs) - bbX + 12, bbH = Math.max(...ys) - bbY + 12;
  ctx.strokeStyle = `rgba(${hexToRgb(cor)},${vis * 0.2})`;
  ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
  ctx.strokeRect(bbX, bbY, bbW, bbH);
  ctx.setLineDash([]);

  const linha = (a, b, alpha = 0.6) => {
    ctx.strokeStyle = `rgba(${hexToRgb(cor)},${vis * alpha})`;
    ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  };
  const joint = (pt, r = 3, alpha = 0.9) => {
    ctx.fillStyle = `rgba(${hexToRgb(cor)},${vis * alpha})`;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2); ctx.fill();
  };

  // Esqueleto
  linha(pts.neck, pts.hipC, 0.7);
  linha(pts.ls,   pts.rs,   0.5);
  linha(pts.ls,   pts.le);
  linha(pts.le,   pts.lw);
  linha(pts.rs,   pts.re);
  linha(pts.re,   pts.rw);
  linha(pts.hipC, pts.lh,   0.5);
  linha(pts.hipC, pts.rh,   0.5);
  linha(pts.lh,   pts.lk);
  linha(pts.lk,   pts.la);
  linha(pts.rh,   pts.rk);
  linha(pts.rk,   pts.ra);
  linha(pts.neck, pts.ls,   0.5);
  linha(pts.neck, pts.rs,   0.5);

  // Cabeça
  const headR = Math.max(10, Math.abs(pts.ls.x - pts.rs.x) * 0.22);
  ctx.strokeStyle = `rgba(${hexToRgb(cor)},${vis})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(pts.nose.x, pts.nose.y - headR * 0.3, headR, 0, Math.PI * 2); ctx.stroke();

  // Joints
  [pts.neck, pts.ls, pts.rs, pts.le, pts.re, pts.lw, pts.rw,
   pts.lh, pts.rh, pts.lk, pts.rk, pts.la, pts.ra].forEach(j => joint(j));

  // Ruído nos joints (simula MediaPipe)
  if (wireframeState !== 'idle') {
    const ruido = Math.sin(t * 0.4) * 1.2;
    joint({ x: pts.lw.x + ruido, y: pts.lw.y + ruido }, 2, 0.5);
    joint({ x: pts.rw.x - ruido, y: pts.rw.y + ruido }, 2, 0.5);
  }

  // Efeito por estado
  if (wireframeState === 'decisao') {
    const pulse = (Math.sin(t * 0.12) + 1) * 0.5;
    ctx.strokeStyle = `rgba(${hexToRgb(cor)},${pulse * 0.4 * vis})`;
    ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.arc(pts.nose.x, pts.nose.y - headR * 0.3, headR + 6 + pulse * 4, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
  if (wireframeState === 'indeciso') {
    const shiver = Math.sin(t * 0.35) * 0.5 + 0.5;
    ctx.strokeStyle = `rgba(${hexToRgb(cor)},${shiver * 0.35 * vis})`;
    ctx.lineWidth = 1; ctx.setLineDash([2, 6]);
    ctx.beginPath();
    ctx.moveTo(pts.nose.x - headR * 2, pts.nose.y - headR * 2);
    ctx.lineTo(pts.nose.x + headR * 2, pts.nose.y + headR * 3);
    ctx.stroke(); ctx.setLineDash([]);
  }
  if (wireframeState === 'engajado') {
    const pulse = (Math.sin(t * 0.08) + 1) * 0.5;
    ctx.strokeStyle = `rgba(${hexToRgb(cor)},${pulse * 0.35 * vis})`;
    ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.arc(pts.nose.x, pts.nose.y - headR * 0.3, headR + 8 + pulse * 6, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Label
  ctx.fillStyle = `rgba(${hexToRgb(cor)},${vis * 0.6})`;
  ctx.font = "9px 'Share Tech Mono'";
  ctx.textAlign = 'center';
  ctx.fillText(`LIVE — ${wireframeState.toUpperCase()}`, W / 2, H - 8);
}

// ── Helper: hex → r,g,b string ────────────────────────────
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}


// ══════════════════════════════════════════════════════════
// MODO 2 — POSES ANIMADAS (simulador)
// ══════════════════════════════════════════════════════════

const poses = {
  idle:     { headY:0.15, torsoAngle:0,     leftArmAngle:-0.3, rightArmAngle:0.3,  leanX:0,     squat:0,    opacity:0.3 },
  ausente:  { headY:0.15, torsoAngle:0,     leftArmAngle:-0.3, rightArmAngle:0.3,  leanX:0,     squat:0,    opacity:0   },
  indeciso: { headY:0.15, torsoAngle:0.05,  leftArmAngle:-0.5, rightArmAngle:0.4,  leanX:0.03,  squat:0.05, opacity:1   },
  comprando:{ headY:0.18, torsoAngle:0.15,  leftArmAngle:0.6,  rightArmAngle:-0.8, leanX:0.05,  squat:0.12, opacity:1   },
  saindo:   { headY:0.14, torsoAngle:-0.12, leftArmAngle:0.5,  rightArmAngle:-0.3, leanX:-0.08, squat:0,    opacity:1   },
  pesquisa: { headY:0.12, torsoAngle:0.08,  leftArmAngle:-0.6, rightArmAngle:-0.4, leanX:0.02,  squat:0,    opacity:1   },
  medo:     { headY:0.16, torsoAngle:0,     leftArmAngle:-0.2, rightArmAngle:0.2,  leanX:0,     squat:0.08, opacity:1   },
};

let currentPose = { ...poses.idle };
let targetPose  = { ...poses.idle };

function desenharPose(t) {
  ctx.clearRect(0, 0, W, H);

  for (let k in targetPose) {
    currentPose[k] = lerp(currentPose[k], targetPose[k], 0.06);
  }

  const p = currentPose;
  if (p.opacity < 0.05) return;

  const cx    = W / 2 + p.leanX * W;
  const baseY = H * 0.85;
  const scale = H * 0.55;

  const breathe = Math.sin(t * 0.02) * 0.008;
  const wobble  = wireframeState === 'indeciso' ? Math.sin(t * 0.05) * 0.01 : 0;

  const cor = COR_ESTADO[wireframeState] || '#4a5a70';
  const CYAN     = `rgba(${hexToRgb(cor)},${p.opacity})`;
  const CYAN_DIM = `rgba(${hexToRgb(cor)},${p.opacity * 0.35})`;

  ctx.lineWidth = 1.5; ctx.lineCap = 'round';

  const head      = { x: cx + wobble * W,       y: baseY - scale * (0.82 - breathe + p.headY) };
  const neck      = { x: cx + wobble * W,       y: baseY - scale * 0.72 };
  const shoulderL = { x: cx - scale * 0.18,     y: baseY - scale * 0.68 };
  const shoulderR = { x: cx + scale * 0.18,     y: baseY - scale * 0.68 };
  const hip       = { x: cx + wobble * W * 0.5, y: baseY - scale * (0.38 + p.squat) };
  const hipL      = { x: cx - scale * 0.1,      y: baseY - scale * (0.35 + p.squat) };
  const hipR      = { x: cx + scale * 0.1,      y: baseY - scale * (0.35 + p.squat) };

  const elbowL = { x: shoulderL.x - scale * 0.2 * Math.sin(p.leftArmAngle),  y: shoulderL.y + scale * 0.22 * Math.cos(p.leftArmAngle) };
  const elbowR = { x: shoulderR.x + scale * 0.2 * Math.sin(p.rightArmAngle), y: shoulderR.y + scale * 0.22 * Math.cos(p.rightArmAngle) };
  const wristL = { x: elbowL.x - scale * 0.18 * Math.sin(p.leftArmAngle * 1.4),  y: elbowL.y + scale * 0.18 * Math.cos(p.leftArmAngle * 1.4) };
  const wristR = { x: elbowR.x + scale * 0.18 * Math.sin(p.rightArmAngle * 1.4), y: elbowR.y + scale * 0.18 * Math.cos(p.rightArmAngle * 1.4) };

  const kneeL = { x: hipL.x - scale * 0.04, y: hipL.y + scale * 0.24 };
  const kneeR = { x: hipR.x + scale * 0.04, y: hipR.y + scale * 0.24 };
  const footL = { x: kneeL.x - scale * 0.05, y: baseY };
  const footR = { x: kneeR.x + scale * 0.05, y: baseY };

  const drawLine = (a, b, color = CYAN_DIM) => {
    ctx.strokeStyle = color;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  };
  const drawJoint = (pt, r = 2.5, color = CYAN_DIM) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2); ctx.fill();
  };

  // Chão
  ctx.strokeStyle = `rgba(${hexToRgb(cor)},${p.opacity * 0.12})`;
  ctx.lineWidth = 1; ctx.setLineDash([4, 8]);
  ctx.beginPath(); ctx.moveTo(cx - 60, baseY); ctx.lineTo(cx + 60, baseY); ctx.stroke();
  ctx.setLineDash([]); ctx.lineWidth = 1.5;

  drawLine(neck, hip);
  drawLine(shoulderL, shoulderR, CYAN_DIM);
  drawLine(shoulderL, elbowL); drawLine(elbowL, wristL);
  drawLine(shoulderR, elbowR); drawLine(elbowR, wristR);
  drawLine(hipL, kneeL); drawLine(kneeL, footL);
  drawLine(hipR, kneeR); drawLine(kneeR, footR);
  drawLine(hip, hipL); drawLine(hip, hipR);
  drawLine(neck, shoulderL); drawLine(neck, shoulderR);

  // Cabeça
  const hr = scale * 0.07;
  ctx.strokeStyle = CYAN; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(head.x, head.y, hr, 0, Math.PI * 2); ctx.stroke();

  // Olhar
  const gazeX = head.x + hr * 1.3 * (wireframeState === 'saindo' ? -1 : 0.6);
  ctx.fillStyle = `rgba(0,229,160,${p.opacity * 0.8})`;
  ctx.beginPath(); ctx.arc(gazeX, head.y + hr * 0.1, 2.5, 0, Math.PI * 2); ctx.fill();

  [neck, shoulderL, shoulderR, elbowL, elbowR, wristL, wristR,
   hip, hipL, hipR, kneeL, kneeR, footL, footR].forEach(j => drawJoint(j));

  if (wireframeState === 'decisao' || wireframeState === 'engajado') {
    const pulse = (Math.sin(t * 0.1) + 1) * 0.5;
    ctx.strokeStyle = `rgba(${hexToRgb(cor)},${pulse * 0.4 * p.opacity})`;
    ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.arc(head.x, head.y, hr + 6 + pulse * 4, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
  if (wireframeState === 'indeciso') {
    const shiver = Math.sin(t * 0.3) * 0.5 + 0.5;
    ctx.strokeStyle = `rgba(${hexToRgb(cor)},${shiver * 0.3 * p.opacity})`;
    ctx.lineWidth = 1; ctx.setLineDash([2, 6]);
    ctx.beginPath();
    ctx.moveTo(head.x - hr * 2, head.y - hr * 1.5);
    ctx.lineTo(head.x + hr * 2, head.y + hr * 2.5);
    ctx.stroke(); ctx.setLineDash([]);
  }

  ctx.fillStyle = `rgba(${hexToRgb(cor)},${p.opacity * 0.5})`;
  ctx.font = "9px 'Share Tech Mono'";
  ctx.textAlign = 'center';
  ctx.fillText(`WIREFRAME — ${wireframeState.toUpperCase()}`, W / 2, H - 8);
}


// ══════════════════════════════════════════════════════════
// API PÚBLICA
// ══════════════════════════════════════════════════════════

const estadoParaPose = {
  idle:      'idle',    ausente:  'ausente',
  engajado:  'pesquisa', indeciso: 'indeciso',
  decisao:   'comprando', saindo:  'saindo',
  medo:      'medo',    medo_de_errar: 'medo',
  comprando: 'comprando', pesquisa: 'pesquisa',
};

// Chamado quando chega landmark real da câmera
function setLandmarks(lm, estado) {
  modoLandmarks  = true;
  lmAtual        = lm;
  wireframeState = estado || 'idle';
}

// Chamado quando não há landmarks (sem câmera ativa)
function setEstado(estado) {
  modoLandmarks  = false;
  wireframeState = estado in COR_ESTADO ? estado : 'idle';
  const poseName = estadoParaPose[estado] ?? 'idle';
  targetPose     = { ...poses[poseName] || poses.idle };
}


// ══════════════════════════════════════════════════════════
// LOOP PRINCIPAL
// ══════════════════════════════════════════════════════════

let animT = 0;
function animLoop() {
  animT++;
  if (modoLandmarks) {
    desenharReal(animT);
  } else {
    desenharPose(animT);
  }
  requestAnimationFrame(animLoop);
}
animLoop();