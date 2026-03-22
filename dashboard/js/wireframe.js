// ═══════════════════════════════════════════════════════════
// WIREFRAME — componente de produto
// Princípios: anônimo, tecnológico, legível em 1 segundo
// 5 estados operacionais: idle, engajado, indeciso, decisao, saindo
// ═══════════════════════════════════════════════════════════

const canvas = document.getElementById('wireCanvas');
const ctx    = canvas.getContext('2d');
const W      = canvas.width;
const H      = canvas.height;

// ── Paleta por estado ──────────────────────────────────────

const CORES = {
  idle:     { principal: 'rgba(74,90,112,1)',   dim: 'rgba(74,90,112,0.35)',  label: 'NEUTRO'          },
  engajado: { principal: 'rgba(0,180,255,1)',   dim: 'rgba(0,180,255,0.3)',   label: 'ENGAJADO'        },
  indeciso: { principal: 'rgba(255,208,96,1)',  dim: 'rgba(255,208,96,0.3)',  label: 'INDECISO'        },
  decisao:  { principal: 'rgba(0,229,160,1)',   dim: 'rgba(0,229,160,0.3)',   label: 'DECISÃO'         },
  saindo:   { principal: 'rgba(255,61,90,1)',   dim: 'rgba(255,61,90,0.3)',   label: 'SAINDO'          },
  ausente:  { principal: 'rgba(74,90,112,0.2)', dim: 'rgba(74,90,112,0.08)', label: 'SEM PRESENÇA'    },
};

// ── Poses por estado ───────────────────────────────────────
// Cada valor define a geometria do corpo
// leanX        → inclinação lateral do centro
// leanFront    → inclinação frontal (para frente = positivo)
// headTilt     → inclinação da cabeça
// squat        → agachamento
// armL / armR  → ângulo dos braços
// opacity      → visibilidade geral

const POSES = {
  idle: {
    leanX: 0, leanFront: 0, headTilt: 0,
    squat: 0, armL: -0.2, armR: 0.2, opacity: 0.6,
  },
  ausente: {
    leanX: 0, leanFront: 0, headTilt: 0,
    squat: 0, armL: -0.2, armR: 0.2, opacity: 0,
  },
  engajado: {
    leanX: 0.02, leanFront: 0.04, headTilt: 0.06,
    squat: 0.02, armL: -0.5, armR: -0.3, opacity: 1,
  },
  indeciso: {
    leanX: 0.01, leanFront: 0, headTilt: 0.18,
    squat: 0.01, armL: -0.15, armR: 0.15, opacity: 1,
  },
  decisao: {
    leanX: 0.03, leanFront: 0.08, headTilt: 0.1,
    squat: 0.10, armL: 0.7, armR: -0.3, opacity: 1,
  },
  saindo: {
    leanX: -0.06, leanFront: -0.03, headTilt: -0.08,
    squat: 0, armL: 0.3, armR: 0.4, opacity: 1,
  },
};

// ── Mapa backend → wireframe ───────────────────────────────

const MAPA_ESTADO = {
  idle:     'idle',
  engajado: 'engajado',
  indeciso: 'indeciso',
  decisao:  'decisao',
  saindo:   'saindo',
};

// ── Estado atual ───────────────────────────────────────────

let wireframeState = 'idle';
let current        = { ...POSES.idle };
let target         = { ...POSES.idle };
let targetPose     = POSES.idle; // compatibilidade dashboard.js
let poses          = POSES;      // compatibilidade dashboard.js

function setEstado(estado) {
  const mapped   = MAPA_ESTADO[estado] || 'idle';
  wireframeState = mapped;
  target         = { ...POSES[mapped] };
  targetPose     = target;
}

// ── Lerp ───────────────────────────────────────────────────

function lerp(a, b, t) { return a + (b - a) * t; }

// ── Loop ───────────────────────────────────────────────────

let animT = 0;

function animLoop() {
  animT++;
  const spd = 0.055;
  for (const k of ['leanX','leanFront','headTilt','squat','armL','armR','opacity']) {
    current[k] = lerp(current[k], target[k], spd);
  }
  desenhar(animT);
  requestAnimationFrame(animLoop);
}

// ── Desenho ────────────────────────────────────────────────

function desenhar(t) {
  ctx.clearRect(0, 0, W, H);

  const estado = wireframeState;
  const cor    = CORES[estado] || CORES.idle;
  const p      = current;
  const COR    = cor.principal;
  const DIM    = cor.dim;

  // Sem presença
  if (p.opacity < 0.03) {
    ctx.fillStyle = 'rgba(74,90,112,0.3)';
    ctx.font      = `9px 'Share Tech Mono'`;
    ctx.textAlign = 'center';
    ctx.fillText('SEM PRESENÇA', W / 2, H / 2);
    return;
  }

  // Dimensões base
  const cx    = W / 2 + p.leanX * W;
  const baseY = H * 0.88;
  const sc    = H * 0.52;

  // Microanimações por estado
  const breath  = Math.sin(t * 0.025) * 0.005;
  const wobble  = estado === 'indeciso'
    ? Math.sin(t * 0.045) * 0.014 : 0;
  const descend = estado === 'decisao'
    ? Math.sin(t * 0.06) * 0.008 : 0;
  const drift   = estado === 'saindo'
    ? Math.sin(t * 0.03) * 0.006 : 0;
  const pulse   = (estado === 'engajado' || estado === 'decisao')
    ? (Math.sin(t * 0.07) + 1) * 0.5 : 0;

  // ── Joints ──────────────────────────────────────────────

  const headX = cx + wobble * W + drift * W;
  const headY = baseY - sc * (0.84 + breath + p.leanFront * 0.5 + descend);
  const neckY = baseY - sc * 0.73;
  const shY   = baseY - sc * 0.69;
  const hipY  = baseY - sc * (0.39 + p.squat);

  const head  = { x: headX,              y: headY };
  const neck  = { x: cx + wobble * W,    y: neckY };
  const shL   = { x: cx - sc * 0.15,     y: shY   };
  const shR   = { x: cx + sc * 0.15,     y: shY   };
  const hipC  = { x: cx,                 y: hipY  };
  const hipL  = { x: cx - sc * 0.09,     y: hipY  };
  const hipR  = { x: cx + sc * 0.09,     y: hipY  };

  // Braços
  const elL = {
    x: shL.x - sc * 0.17 * Math.sin(p.armL),
    y: shL.y + sc * 0.19 * Math.cos(p.armL),
  };
  const elR = {
    x: shR.x + sc * 0.17 * Math.sin(p.armR),
    y: shR.y + sc * 0.19 * Math.cos(p.armR),
  };
  const wrL = {
    x: elL.x - sc * 0.15 * Math.sin(p.armL * 1.3),
    y: elL.y + sc * 0.15 * Math.cos(p.armL * 1.3),
  };
  const wrR = {
    x: elR.x + sc * 0.15 * Math.sin(p.armR * 1.3),
    y: elR.y + sc * 0.15 * Math.cos(p.armR * 1.3),
  };

  // Pernas
  const knL = { x: hipL.x - sc * 0.03, y: hipL.y + sc * 0.25 };
  const knR = { x: hipR.x + sc * 0.03, y: hipR.y + sc * 0.25 };
  const ftL = { x: knL.x - sc * 0.04,  y: baseY };
  const ftR = { x: knR.x + sc * 0.04,  y: baseY };

  // ── Helpers ──────────────────────────────────────────────

  const linha = (a, b, cor = DIM, lw = 1.5) => {
    ctx.strokeStyle = cor;
    ctx.lineWidth   = lw;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };

  const joint = (pt, r = 2.5, cor = DIM) => {
    ctx.fillStyle = cor;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  // ── Chão ─────────────────────────────────────────────────

  ctx.strokeStyle = 'rgba(74,90,112,0.15)';
  ctx.lineWidth   = 1;
  ctx.setLineDash([3, 8]);
  ctx.beginPath();
  ctx.moveTo(cx - 50, baseY);
  ctx.lineTo(cx + 50, baseY);
  ctx.stroke();
  ctx.setLineDash([]);

  // ── Anel de pulso (engajado / decisao) ───────────────────

  if (pulse > 0) {
    const hr = sc * 0.075;
    ctx.strokeStyle = COR.replace(/[\d.]+\)$/, `${(pulse * 0.35).toFixed(2)})`);
    ctx.lineWidth   = 1;
    ctx.setLineDash([2, 6]);
    ctx.beginPath();
    ctx.arc(head.x, head.y, hr + 7 + pulse * 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ── Bounding box (simula campo de visão da câmera) ────────

  if (estado !== 'idle' && estado !== 'ausente') {
    const pad  = 18;
    const bx   = cx - sc * 0.22 - pad;
    const by   = headY - sc * 0.10 - pad;
    const bw   = sc * 0.44 + pad * 2;
    const bh   = baseY - by + pad;
    ctx.strokeStyle = COR.replace(/[\d.]+\)$/, '0.12)');
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 6]);
    ctx.strokeRect(bx, by, bw, bh);
    ctx.setLineDash([]);
  }

  // ── Esqueleto ─────────────────────────────────────────────

  linha(neck, hipC, DIM);
  linha(shL, shR, DIM);
  linha(neck, shL, DIM);
  linha(neck, shR, DIM);
  linha(hipC, hipL, DIM);
  linha(hipC, hipR, DIM);

  // Braços com cor principal — são o gesto mais expressivo
  linha(shL, elL, COR, 1.8);
  linha(elL, wrL, COR, 1.8);
  linha(shR, elR, COR, 1.8);
  linha(elR, wrR, COR, 1.8);

  // Pernas
  linha(hipL, knL, DIM);
  linha(knL,  ftL, DIM);
  linha(hipR, knR, DIM);
  linha(knR,  ftR, DIM);

  // ── Cabeça ────────────────────────────────────────────────

  const hr = sc * 0.072;

  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(p.headTilt + wobble * 1.5);

  // Círculo da cabeça
  ctx.strokeStyle = COR;
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, hr, 0, Math.PI * 2);
  ctx.stroke();

  // Olhos — dois pontos simples
  ctx.fillStyle = COR;
  ctx.beginPath(); ctx.arc(-hr * 0.3,  -hr * 0.1, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc( hr * 0.3,  -hr * 0.1, 1.6, 0, Math.PI * 2); ctx.fill();

  // Boca — linha neutra
  ctx.strokeStyle = DIM;
  ctx.lineWidth   = 1.2;
  ctx.beginPath();
  ctx.moveTo(-hr * 0.28, hr * 0.32);
  ctx.lineTo( hr * 0.28, hr * 0.32);
  ctx.stroke();

  ctx.restore();

  // ── Joints principais ─────────────────────────────────────

  joint(neck, 2.5, DIM);
  joint(shL,  3.0, COR);
  joint(shR,  3.0, COR);
  joint(elL,  2.5, DIM);
  joint(elR,  2.5, DIM);
  joint(wrL,  2.0, DIM);
  joint(wrR,  2.0, DIM);
  joint(hipC, 2.5, DIM);
  joint(knL,  2.0, DIM);
  joint(knR,  2.0, DIM);

  // ── Ruído nos joints (simula MediaPipe real) ──────────────

  if (estado !== 'idle' && estado !== 'ausente') {
    [shL, shR, elL, elR, hipL, hipR, knL, knR].forEach(j => {
      ctx.fillStyle = COR.replace(/[\d.]+\)$/, '0.2)');
      ctx.beginPath();
      ctx.arc(
        j.x + (Math.random() - 0.5) * 1.2,
        j.y + (Math.random() - 0.5) * 1.2,
        1, 0, Math.PI * 2
      );
      ctx.fill();
    });
  }

  // ── Label de estado ───────────────────────────────────────

  ctx.fillStyle = COR;
  ctx.font      = `bold 9px 'Share Tech Mono'`;
  ctx.textAlign = 'center';
  ctx.fillText(cor.label, W / 2, H - 8);
}

// ── Init ──────────────────────────────────────────────────

animLoop();