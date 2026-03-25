// ═══════════════════════════════════════════════════════════
// CAMERA-MEDIAPIPE — Pose + FaceMesh em loop único alternado
// Pose roda 9 frames, FaceMesh roda 1 frame, repete
// Nunca processam ao mesmo tempo → não estoura memória
// ═══════════════════════════════════════════════════════════

let cameraAtiva  = null;
let poseModelo   = null;
let faceModelo   = null;
let ultimoFace   = null;
let frameIdx     = 0;
const FACE_CADA  = 4;    // a cada 2 frames, 1 vai pro FaceMesh

// ── Pose callback ────────────────────────────────────────
function onPoseResults(results) {
  EL.poseCanvas.width  = EL.video.videoWidth  || 640;
  EL.poseCanvas.height = EL.video.videoHeight || 480;
  poseCtx.fillStyle = '#07090f';
  poseCtx.fillRect(0, 0, EL.poseCanvas.width, EL.poseCanvas.height);
  if (!results.poseLandmarks) return;

  const lm = results.poseLandmarks;

  // Corpo
  drawConnectors(poseCtx, lm, POSE_CONNECTIONS, { color:'rgba(0,180,255,0.55)', lineWidth:2 });
  drawLandmarks(poseCtx, lm, { color:'rgba(0,229,160,0.9)', lineWidth:1, radius:3 });

  // Sobrepõe face mesh do último resultado (se tiver)
  if (ultimoFace) {
    drawConnectors(poseCtx, ultimoFace, FACEMESH_TESSELATION, { color:'rgba(0,180,255,0.12)', lineWidth:0.5 });
    drawConnectors(poseCtx, ultimoFace, FACEMESH_FACE_OVAL,   { color:'rgba(0,180,255,0.25)', lineWidth:1 });
  }

  atualizarDebug(inferirLocal(lm));
  const faceMetrics = inferirFace(ultimoFace);
  const emocao      = inferirEmocao(faceMetrics);
  const subEstado   = inferirSubEstado(lm);

  // Sub-estado — vem do Pose, independente do FaceMesh
  if (EL.v_sub_estado) {
    EL.v_sub_estado.textContent = subEstado !== 'nenhum' ? subEstado.toUpperCase() : 'NENHUM';
    EL.v_sub_estado.style.color = subEstado !== 'nenhum' ? 'var(--yellow)' : 'var(--dim)';
  }
  
  // Atualiza debug facial
  if (faceMetrics && EL.v_eye) {
  EL.v_eye.textContent    = faceMetrics.eye_openness.toFixed(3);
  EL.v_furrow.textContent = faceMetrics.brow_furrow.toFixed(3);
  EL.v_curve.textContent  = faceMetrics.mouth_curve.toFixed(3);
  EL.v_emocao.textContent = emocao.toUpperCase();
  EL.v_emocao.style.color = emocao !== 'neutro' ? 'var(--yellow)' : 'var(--dim)';

  
  const elRaise  = document.getElementById('v_raise');
  const elRaiseB = document.getElementById('v_raise_base');
  const elRelLev = document.getElementById('v_rel_levant');

  if (elRaise)  elRaise.textContent  = faceMetrics.brow_raise.toFixed(3);
  if (elRaiseB) elRaiseB.textContent = _baseline
    ? _baseline.brow_raise.toFixed(3)
    : 'calibrando...';
  if (elRelLev && _baseline) {
    const rel = (faceMetrics.brow_raise - _baseline.brow_raise) / (_baseline.brow_raise || 0.01);
    elRelLev.textContent = rel.toFixed(3);
    elRelLev.style.color = rel > 0.12  ? '#00e5a0'   // verde = curioso
                         : rel < -0.08 ? '#ff3d5a'   // vermelho = desanimado
                         :               '#4a5a70';  // cinza = neutro
  }
}



  const agora = Date.now();
  if (agora - ultimoEnvio < INTERVALO_MS) return;
  ultimoEnvio = agora;
  enviarFrame(lm, emocao, subEstado);
}  // ← fecha onPoseResults

// ── FaceMesh callback ────────────────────────────────────
function onFaceResults(results) {
  if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
    ultimoFace = results.multiFaceLandmarks[0];
    log('Face pts: ' + ultimoFace.length + ' pts', 'ok');
  } else {
    log('FaceMesh: sem rosto', 'err');
  }
}


// ── Loop único alternado ─────────────────────────────────
async function loop() {
  if (EL.video.readyState < 2) {
    requestAnimationFrame(loop);
    return;
  }

  try {
    if (frameIdx % FACE_CADA === 0 && faceModelo) {
      // Frame do FaceMesh (1 a cada FACE_CADA)
      await faceModelo.send({ image: EL.video });
    } else if (poseModelo) {
      // Frame do Pose (os outros)
      await poseModelo.send({ image: EL.video });
    }
  } catch (_) {}

  frameIdx++;
  requestAnimationFrame(loop);
}

// ── Botões câmera ────────────────────────────────────────
function setActiveBtn(modo) {
  const f = document.getElementById('btnFrontal');
  const t = document.getElementById('btnTraseira');
  f.style.background  = modo === 'user'        ? 'rgba(0,180,255,.18)' : 'rgba(0,180,255,.04)';
  f.style.color       = modo === 'user'        ? 'var(--cyan)'          : '#4a5a70';
  f.style.borderColor = modo === 'user'        ? 'var(--cyan)'          : 'rgba(0,180,255,.3)';
  t.style.background  = modo === 'environment' ? 'rgba(0,180,255,.18)' : 'rgba(0,180,255,.04)';
  t.style.color       = modo === 'environment' ? 'var(--cyan)'          : '#4a5a70';
  t.style.borderColor = modo === 'environment' ? 'var(--cyan)'          : 'rgba(0,180,255,.3)';
}

// ── Iniciar ──────────────────────────────────────────────
async function iniciar(facingMode = 'user') {
  if (cameraAtiva) { cameraAtiva.getTracks().forEach(t => t.stop()); cameraAtiva = null; }
  setActiveBtn(facingMode);
  EL.statusTxt.textContent = 'iniciando...';

  let stream = null;
  const tentativas = [
    { video: { facingMode: { ideal: facingMode } }, audio: false },
    { video: { facingMode: { ideal: 'user'      } }, audio: false },
    { video: true, audio: false },
  ];
  for (const constraints of tentativas) {
    try { stream = await navigator.mediaDevices.getUserMedia(constraints); break; }
    catch (e) { log('Tentativa falhou: ' + e.message, 'err'); }
  }
  if (!stream) {
    log('Nenhuma câmera disponível', 'err');
    setActiveBtn(null);
    return;
  }

  cameraAtiva = stream;
  EL.video.srcObject = stream;
  EL.video.setAttribute('playsinline', true);
  await new Promise(resolve => { EL.video.onloadedmetadata = resolve; });
  await EL.video.play();
  log('Stream ativo', 'ok');

  // ── Pose ──
  poseModelo = new Pose({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}` });
  poseModelo.setOptions({
    modelComplexity:        0,
    smoothLandmarks:        true,
    enableSegmentation:     false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence:  0.5,
  });
  let poseOk = false;
  poseModelo.onResults((results) => {
    if (!poseOk) { poseOk = true; log('Pose pronto', 'ok'); }
    onPoseResults(results);
  });

  // ── FaceMesh ──
  faceModelo = new FaceMesh({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}` });
  faceModelo.setOptions({
    maxNumFaces:            1,
    refineLandmarks:        true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence:  0.5,
  });
  let faceOk = false;
  faceModelo.onResults((results) => {
    if (!faceOk) { faceOk = true; log('FaceMesh pronto', 'ok'); }
    onFaceResults(results);
  });

  // Inicializa Pose primeiro
  try {
    await poseModelo.send({ image: EL.video });
    log('Pose carregando...', 'info');
  } catch (err) {
    log('Pose init: ' + err.message, 'err');
  }

  // Depois FaceMesh (1 frame pra carregar o modelo)
  try {
    await faceModelo.send({ image: EL.video });
    log('FaceMesh carregando...', 'info');
  } catch (err) {
    log('FaceMesh init: ' + err.message, 'err');
  }

  // Loop único
  frameIdx = 0;
  loop();

  EL.statusTxt.textContent    = 'câmera ativa';
  EL.statusTxt.style.color    = '#00b4ff';
  EL.intervaloTxt.textContent = INTERVALO_MS + 'ms';
  log('Pose + FaceMesh alternados', 'info');
  log('Backend: ' + BACKEND, 'info');
}