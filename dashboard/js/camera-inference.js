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
// ═══════════════════════════════════════════════════════════
// FACE — métricas faciais usando landmarks do FaceMesh (468 pts)
// 4=ponta do nariz  159=olho esq centro  386=olho dir centro
// 61=boca esq  291=boca dir  13=lábio sup  14=lábio inf
// 234=têmpora esq  454=têmpora dir
// 105=sobrancelha esq  334=sobrancelha dir
// ═══════════════════════════════════════════════════════════

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function inferirFace(lm) {
  if (!lm || lm.length < 468) return null;

  const nariz    = lm[4];    // ponta do nariz
  const olhoEsq  = lm[159];  // centro aprox olho esquerdo
  const olhoDir  = lm[386];  // centro aprox olho direito
  const bocaEsq  = lm[61];   // canto esquerdo da boca
  const bocaDir  = lm[291];  // canto direito da boca
  const labioSup = lm[13];   // lábio superior
  const labioInf = lm[14];   // lábio inferior
  const tempEsq  = lm[234];  // têmpora/bochecha esquerda
  const tempDir  = lm[454];  // têmpora/bochecha direita
  const sobrEsq  = lm[105];  // sobrancelha esquerda centro
  const sobrDir  = lm[334];  // sobrancelha direita centro

  // Referência: distância entre têmporas (largura do rosto)
  const larguraRosto = dist(tempEsq, tempDir) || 0.001;

  // 1. gaze_x — nariz deslocado em relação ao centro dos olhos
  //    0 = olhando reto, negativo = esquerda, positivo = direita
  const centroOlhosX = (olhoEsq.x + olhoDir.x) / 2;
  const gaze_x = (nariz.x - centroOlhosX) / larguraRosto;

  // 2. head_tilt — diferença Y entre olhos
  //    0 = reto, positivo = inclinado pra direita
  const head_tilt = (olhoDir.y - olhoEsq.y) / larguraRosto;

  // 3. face_frontal — simetria têmpora-nariz
  //    1.0 = perfeitamente de frente, 0 = totalmente de lado
  const distTempEsq = dist(tempEsq, nariz);
  const distTempDir = dist(tempDir, nariz);
  const maiorDist = Math.max(distTempEsq, distTempDir) || 0.001;
  const menorDist = Math.min(distTempEsq, distTempDir);
  const face_frontal = menorDist / maiorDist;

  // 4. mouth_open — abertura real da boca (lábio sup vs inf)
  const mouth_open = dist(labioSup, labioInf) / larguraRosto;

  // 5. smile — largura da boca vs largura do rosto
  //    Valor alto = sorriso largo
  const smile = dist(bocaEsq, bocaDir) / larguraRosto;

  // 6. brow_raise — sobrancelha vs olho no eixo Y
  //    Valor alto = sobrancelha levantada
  const centroSobrY = (sobrEsq.y + sobrDir.y) / 2;
  const centroOlhosY = (olhoEsq.y + olhoDir.y) / 2;
  const brow_raise = (centroOlhosY - centroSobrY) / larguraRosto;

  return {
    gaze_x:       parseFloat(gaze_x.toFixed(3)),
    head_tilt:    parseFloat(head_tilt.toFixed(3)),
    face_frontal: parseFloat(face_frontal.toFixed(3)),
    mouth_open:   parseFloat(mouth_open.toFixed(3)),
    smile:        parseFloat(smile.toFixed(3)),
    brow_raise:   parseFloat(brow_raise.toFixed(3)),
  };
}