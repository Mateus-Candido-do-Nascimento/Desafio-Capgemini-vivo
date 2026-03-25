// ═══════════════════════════════════════════════════════════
// CAMERA-INFERENCE — cálculo de métricas e estado
// Responsabilidade: lógica de negócio (corpo → estado)
// ═══════════════════════════════════════════════════════════

function inferirLocal(l) {
  const shoulder_y  = ((l[11]?.y ?? 0.4) + (l[12]?.y ?? 0.4)) / 2;
  const hip_y       = ((l[23]?.y ?? 0.6) + (l[24]?.y ?? 0.6)) / 2;
  const lean_front  = shoulder_y - hip_y;
  const shoulder_dx = Math.abs((l[11]?.x ?? 0.4) - (l[12]?.x ?? 0.6));
  const wrist_y_avg = ((l[15]?.y ?? 0.6) + (l[16]?.y ?? 0.6)) / 2;
  const arm_raised  = wrist_y_avg < shoulder_y;
  const head_down   = (l[0]?.y ?? 0.5) > shoulder_y - 0.08;
  const visibility  = l[11]?.visibility ?? 1.0;

  const attention  = Math.min(1, Math.max(0,
    0.3 + shoulder_dx * 1.2 + (arm_raised ? 0.25 : 0) + (head_down ? 0.1 : 0)
  ));
  const hesitation = Math.min(1, Math.max(0, 0.8 - shoulder_dx * 2.0));

  let estado = 'idle';
  if (visibility < 0.4)                        estado = 'idle';
  else if (arm_raised && attention > 0.5)       estado = 'decisao';
  else if (shoulder_dx < 0.12)                  estado = 'saindo';
  else if (attention > 0.5 && hesitation < 0.5) estado = 'engajado';
  else if (hesitation > 0.45)                   estado = 'indeciso';
  else if (attention > 0.35)                    estado = 'engajado';

  return { lean_front, shoulder_dx, arm_raised, head_down, attention, hesitation, visibility, estado };
}

const cl = v => Math.min(1.0, Math.max(0.0, v ?? 0.5));

function extrairBody(l) {
  return {
    nose_y:           cl(l[0]?.y),
    left_shoulder_x:  cl(l[11]?.x), left_shoulder_y:  cl(l[11]?.y),
    right_shoulder_x: cl(l[12]?.x), right_shoulder_y: cl(l[12]?.y),
    left_hip_x:       cl(l[23]?.x), left_hip_y:       cl(l[23]?.y),
    right_hip_x:      cl(l[24]?.x), right_hip_y:      cl(l[24]?.y),
    left_wrist_x:     cl(l[15]?.x), left_wrist_y:     cl(l[15]?.y),
    right_wrist_x:    cl(l[16]?.x), right_wrist_y:    cl(l[16]?.y),
    visibility:       cl(l[11]?.visibility),
  };
}

function atualizarDebug(m) {
  const fmt = v => v.toFixed(3);
  EL.v_lean.textContent = fmt(m.lean_front);
  EL.v_sdx.textContent  = fmt(m.shoulder_dx);
  EL.v_arm.textContent  = m.arm_raised ? 'SIM' : 'NÃO';
  EL.v_arm.className    = 'debug-val ' + (m.arm_raised ? 'good' : '');
  EL.v_head.textContent = m.head_down ? 'SIM' : 'NÃO';
  EL.v_vis.textContent  = fmt(m.visibility);
  EL.v_att.textContent  = Math.round(m.attention  * 100) + '%';
  EL.v_hes.textContent  = Math.round(m.hesitation * 100) + '%';
  EL.v_estado_local.textContent = m.estado.toUpperCase();
  EL.v_estado_local.style.color = CORES[m.estado] || '#4a5a70';

  EL.b_lean.style.width = Math.min(100, Math.max(0, (m.lean_front + 0.2) / 0.4 * 100)) + '%';
  EL.b_sdx.style.width  = Math.min(100, m.shoulder_dx / 0.5 * 100) + '%';
  EL.b_att.style.width  = (m.attention  * 100) + '%';
  EL.b_hes.style.width  = (m.hesitation * 100) + '%';
}

function atualizarDebugFace(fm, emocao, subEstado) {
  const elEmocao    = document.getElementById('v_emocao');
  const elSubEstado = document.getElementById('v_sub_estado');
  if (elEmocao)    elEmocao.textContent    = emocao.toUpperCase();
  if (elSubEstado) elSubEstado.textContent = subEstado.toUpperCase();

  if (!fm) return;
  const elEye  = document.getElementById('v_eye');
  const elFurr = document.getElementById('v_furrow');
  const elCurv = document.getElementById('v_curve');
  if (elEye)  elEye.textContent  = fm.eye_openness.toFixed(3);
  if (elFurr) elFurr.textContent = fm.brow_furrow.toFixed(3);
  if (elCurv) elCurv.textContent = fm.mouth_curve.toFixed(3);
}

// ═══════════════════════════════════════════════════════════
// FACE — métricas faciais usando landmarks do FaceMesh (468 pts)
// ═══════════════════════════════════════════════════════════

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function inferirFace(lm) {
  if (!lm || lm.length < 468) return null;

  const nariz    = lm[4];
  const olhoEsq  = lm[159];
  const olhoDir  = lm[386];
  const bocaEsq  = lm[61];
  const bocaDir  = lm[291];
  const labioSup = lm[13];
  const labioInf = lm[14];
  const tempEsq  = lm[234];
  const tempDir  = lm[454];
  const sobrEsq  = lm[105];
  const sobrDir  = lm[334];

  const larguraRosto = dist(tempEsq, tempDir) || 0.001;

  const centroOlhosX = (olhoEsq.x + olhoDir.x) / 2;
  const gaze_x = (nariz.x - centroOlhosX) / larguraRosto;

  const head_tilt = (olhoDir.y - olhoEsq.y) / larguraRosto;

  const distTempEsq  = dist(tempEsq, nariz);
  const distTempDir  = dist(tempDir, nariz);
  const maiorDist    = Math.max(distTempEsq, distTempDir) || 0.001;
  const menorDist    = Math.min(distTempEsq, distTempDir);
  const face_frontal = menorDist / maiorDist;

  const mouth_open = dist(labioSup, labioInf) / larguraRosto;
  const smile      = dist(bocaEsq, bocaDir)   / larguraRosto;

  const centroSobrY  = (sobrEsq.y + sobrDir.y) / 2;
  const centroOlhosY = (olhoEsq.y + olhoDir.y) / 2;
  const brow_raise   = (centroOlhosY - centroSobrY) / larguraRosto;

  const olhoEsqSup   = lm[159];
  const olhoEsqInf   = lm[145];
  const olhoDirSup   = lm[386];
  const olhoDirInf   = lm[374];
  const eye_openness = ((dist(olhoEsqSup, olhoEsqInf) + dist(olhoDirSup, olhoDirInf)) / 2) / larguraRosto;

  const sobrIntEsq  = lm[107];
  const sobrIntDir  = lm[336];
  const brow_furrow = dist(sobrIntEsq, sobrIntDir) / larguraRosto;

  const centroLabioY = labioSup.y;
  const cantoEsqY    = bocaEsq.y;
  const cantoDirY    = bocaDir.y;
  const mouth_curve  = ((centroLabioY - cantoEsqY) + (centroLabioY - cantoDirY)) / 2 / larguraRosto;

  return {
    gaze_x:       parseFloat(gaze_x.toFixed(3)),
    head_tilt:    parseFloat(head_tilt.toFixed(3)),
    face_frontal: parseFloat(face_frontal.toFixed(3)),
    mouth_open:   parseFloat(mouth_open.toFixed(3)),
    smile:        parseFloat(smile.toFixed(3)),
    brow_raise:   parseFloat(brow_raise.toFixed(3)),
    eye_openness: parseFloat(eye_openness.toFixed(3)),
    brow_furrow:  parseFloat(brow_furrow.toFixed(3)),
    mouth_curve:  parseFloat(mouth_curve.toFixed(3)),
  };
}
// ═══════════════════════════════════════════════════════════
// EMOÇÃO — classifica emoção a partir das métricas faciais
// Baseado em FACS (Ekman) — Action Units aproximadas
// ═══════════════════════════════════════════════════════════
function inferirEmocao(face) {
  if (!face) return 'neutro';

  const { eye_openness, brow_raise, brow_furrow, mouth_curve } = face;

  // Bravo: sobrancelhas juntas + olhos estreitos + boca tensa
  if (brow_furrow < 0.18 && eye_openness < 0.25 && mouth_curve < 0.0)
    return 'bravo';

  // Triste: boca caída + sobrancelhas juntas + olhos semi-fechados
  if (mouth_curve < -0.01 && brow_furrow < 0.22 && eye_openness < 0.30)
    return 'triste';

  // Desanimado: olhos muito fechados + sobrancelha baixa + boca neutra
  if (eye_openness < 0.18 && brow_raise < 0.20)
    return 'desanimado';

  // Curioso: olhos abertos + sobrancelha levantada
  if (eye_openness > 0.30 && brow_raise > 0.28)
    return 'curioso';

  return 'neutro';
}

// ═══════════════════════════════════════════════════════════
// SUB-ESTADO — detecta gesto corporal a partir do Pose
// Baseado em Navarro (2008) e Pease (2004)
// ═══════════════════════════════════════════════════════════
function inferirSubEstado(lm) {
  if (!lm || lm.length < 17) return 'nenhum';

  const nose      = lm[0];
  const shoulderL = lm[11];
  const shoulderR = lm[12];
  const wristL    = lm[15];
  const wristR    = lm[16];

  const shoulder_y = (shoulderL.y + shoulderR.y) / 2;
  const mid_x      = (shoulderL.x + shoulderR.x) / 2;

  // Braços cruzados — pulsos cruzando a linha central do corpo
  const bracosCruzados =
    wristL.x > mid_x + 0.05 && wristR.x < mid_x - 0.05;
  if (bracosCruzados) return 'resistencia';

  // Mão no queixo — pulso entre ombro e nariz, próximo ao centro
  const pulsoNaAlturaDaFace = (w) =>
    w.y < nose.y + 0.05 &&
    w.y > shoulder_y - 0.05 &&
    Math.abs(w.x - mid_x) < 0.15;

  if (pulsoNaAlturaDaFace(wristL) || pulsoNaAlturaDaFace(wristR))
    return 'avaliando';

  // Mão na cabeça — pulso acima do nariz, próximo ao centro
  const pulsoNaCabeca = (w) =>
    w.y < nose.y - 0.05 &&
    Math.abs(w.x - mid_x) < 0.20;

  if (pulsoNaCabeca(wristL) || pulsoNaCabeca(wristR))
    return 'em_duvida';

  // Mão no pescoço — pulso centralizado na altura do pescoço
  const pescocoY = shoulder_y - 0.08;
  const pulsoNoPescoco = (w) =>
    Math.abs(w.y - pescocoY) < 0.06 &&
    Math.abs(w.x - mid_x) < 0.12;

  if (pulsoNoPescoco(wristL) || pulsoNoPescoco(wristR))
    return 'estressado';

  return 'nenhum';
}
