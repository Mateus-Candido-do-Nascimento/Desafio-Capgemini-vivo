// ═══════════════════════════════════════════════════════════
// WIREFRAME — animação da figura humana (MediaPipe mock)
// Responsabilidade: canvas, poses, loop de animação
// ═══════════════════════════════════════════════════════════

const canvas = document.getElementById('wireCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

let wireframeState = 'idle';

const poses = {
  idle:     { headY:0.15, torsoAngle:0, leftArmAngle:-0.3, rightArmAngle:0.3, leanX:0, squat:0, opacity:0.3 },
  ausente:  { headY:0.15, torsoAngle:0, leftArmAngle:-0.3, rightArmAngle:0.3, leanX:0, squat:0, opacity:0   },
  indeciso: { headY:0.15, torsoAngle:0.05, leftArmAngle:-0.5, rightArmAngle:0.4, leanX:0.03, squat:0.05, opacity:1 },
  comprando:{ headY:0.18, torsoAngle:0.15, leftArmAngle:0.6, rightArmAngle:-0.8, leanX:0.05, squat:0.12, opacity:1 },
  saindo:   { headY:0.14, torsoAngle:-0.12, leftArmAngle:0.5, rightArmAngle:-0.3, leanX:-0.08, squat:0, opacity:1 },
  pesquisa: { headY:0.12, torsoAngle:0.08, leftArmAngle:-0.6, rightArmAngle:-0.4, leanX:0.02, squat:0, opacity:1 },
  medo:     { headY:0.16, torsoAngle:0, leftArmAngle:-0.2, rightArmAngle:0.2, leanX:0, squat:0.08, opacity:1 },
};

let currentPose = {...poses.idle};
let targetPose  = {...poses.idle};

function lerp(a, b, t) { return a + (b - a) * t; }

function drawWireframe(t) {
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

  const CYAN     = `rgba(0,180,255,${p.opacity})`;
  const CYAN_DIM = `rgba(0,180,255,${p.opacity * 0.35})`;

  ctx.lineWidth = 1.5;
  ctx.lineCap   = 'round';

  const head      = { x: cx + wobble * W,       y: baseY - scale * (0.82 - breathe + p.headY) };
  const neck      = { x: cx + wobble * W,       y: baseY - scale * 0.72 };
  const shoulderL = { x: cx - scale * 0.18,     y: baseY - scale * 0.68 };
  const shoulderR = { x: cx + scale * 0.18,     y: baseY - scale * 0.68 };
  const hip       = { x: cx + wobble * W * 0.5, y: baseY - scale * (0.38 + p.squat) };
  const hipL      = { x: cx - scale * 0.1,      y: baseY - scale * (0.35 + p.squat) };
  const hipR      = { x: cx + scale * 0.1,      y: baseY - scale * (0.35 + p.squat) };

  const elbowL = {
    x: shoulderL.x - scale * 0.2 * Math.sin(p.leftArmAngle),
    y: shoulderL.y + scale * 0.22 * Math.cos(p.leftArmAngle)
  };
  const elbowR = {
    x: shoulderR.x + scale * 0.2 * Math.sin(p.rightArmAngle),
    y: shoulderR.y + scale * 0.22 * Math.cos(p.rightArmAngle)
  };
  const wristL = {
    x: elbowL.x - scale * 0.18 * Math.sin(p.leftArmAngle * 1.4),
    y: elbowL.y + scale * 0.18 * Math.cos(p.leftArmAngle * 1.4)
  };
  const wristR = {
    x: elbowR.x + scale * 0.18 * Math.sin(p.rightArmAngle * 1.4),
    y: elbowR.y + scale * 0.18 * Math.cos(p.rightArmAngle * 1.4)
  };

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
  ctx.strokeStyle = `rgba(0,180,255,${p.opacity * 0.12})`;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 8]);
  ctx.beginPath(); ctx.moveTo(cx - 60, baseY); ctx.lineTo(cx + 60, baseY); ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 1.5;

  // Esqueleto
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
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(head.x, head.y, hr, 0, Math.PI * 2); ctx.stroke();

  // Olhar
  const gazeX = head.x + hr * 1.3 * (wireframeState === 'saindo' ? -1 : 0.6);
  ctx.fillStyle = `rgba(0,229,160,${p.opacity * 0.8})`;
  ctx.beginPath(); ctx.arc(gazeX, head.y + hr * 0.1, 2.5, 0, Math.PI * 2); ctx.fill();

  // Joints
  [neck, shoulderL, shoulderR, elbowL, elbowR, wristL, wristR,
   hip, hipL, hipR, kneeL, kneeR, footL, footR].forEach(j => drawJoint(j));

  // Atenção (comprando/pesquisa)
  if (wireframeState === 'comprando' || wireframeState === 'pesquisa') {
    const pulse = (Math.sin(t * 0.1) + 1) * 0.5;
    ctx.strokeStyle = `rgba(0,229,160,${pulse * 0.4 * p.opacity})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.arc(head.x, head.y, hr + 6 + pulse * 4, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Hesitação (indeciso)
  if (wireframeState === 'indeciso') {
    const shiver = Math.sin(t * 0.3) * 0.5 + 0.5;
    ctx.strokeStyle = `rgba(255,208,96,${shiver * 0.3 * p.opacity})`;
    ctx.lineWidth = 1; ctx.setLineDash([2, 6]);
    ctx.beginPath();
    ctx.moveTo(head.x - hr * 2, head.y - hr * 1.5);
    ctx.lineTo(head.x + hr * 2, head.y + hr * 2.5);
    ctx.stroke(); ctx.setLineDash([]);
  }

  // Label
  ctx.fillStyle = `rgba(0,180,255,${p.opacity * 0.5})`;
  ctx.font = `9px 'Share Tech Mono'`;
  ctx.textAlign = 'center';
  ctx.fillText(`WIREFRAME — ${wireframeState.toUpperCase()}`, W / 2, H - 8);
}

let animT = 0;
function animLoop() {
  animT++;
  drawWireframe(animT);
  requestAnimationFrame(animLoop);
}
animLoop();