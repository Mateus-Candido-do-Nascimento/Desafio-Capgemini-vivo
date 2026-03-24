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
