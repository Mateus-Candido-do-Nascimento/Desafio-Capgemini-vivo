// ═══════════════════════════════════════════════════════════
// CAMERA-MEDIAPIPE — controle da câmera e integração MediaPipe
// Responsabilidade: captura de vídeo e processamento de landmarks
// ═══════════════════════════════════════════════════════════

let cameraAtiva = null;

function onResults(results) {
  EL.poseCanvas.width  = EL.video.videoWidth  || 640;
  EL.poseCanvas.height = EL.video.videoHeight || 480;
  poseCtx.fillStyle = '#07090f';
  poseCtx.fillRect(0, 0, EL.poseCanvas.width, EL.poseCanvas.height);
  if (!results.poseLandmarks) return;

  const lm   = results.poseLandmarks;
  const face = results.faceLandmarks || null;

  // Corpo
  drawConnectors(poseCtx, lm, POSE_CONNECTIONS, { color:'rgba(0,180,255,0.55)', lineWidth:2 });
  drawLandmarks(poseCtx, lm, { color:'rgba(0,229,160,0.9)', lineWidth:1, radius:3 });

  // Face mesh
  if (face) {
    drawConnectors(poseCtx, face, FACEMESH_TESSELATION, { color:'rgba(0,180,255,0.15)', lineWidth:0.5 });
    drawConnectors(poseCtx, face, FACEMESH_FACE_OVAL,   { color:'rgba(0,180,255,0.3)',  lineWidth:1 });
  }

  atualizarDebug(inferirLocal(lm));

  const agora = Date.now();
  if (agora - ultimoEnvio < INTERVALO_MS) return;
  ultimoEnvio = agora;
  enviarFrame(lm);
}

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

  const holistic = new Holistic({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${f}` });
  holistic.setOptions({
    modelComplexity:        1,
    smoothLandmarks:        true,
    refineFaceLandmarks:    true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence:  0.5,
  });

  let poseOk = false;
  holistic.onResults((results) => {
    if (!poseOk) {
      poseOk = true;
      log('Holistic pronto', 'ok');
    }
    onResults(results);
  });

  try {
    await holistic.send({ image: EL.video });
    log('Modelo carregando...', 'info');
  } catch (err) {
    log('Holistic init: ' + err.message, 'err');
  }

  async function loop() {
    if (EL.video.readyState >= 2) {
      try { await holistic.send({ image: EL.video }); } catch (_) {}
    }
    requestAnimationFrame(loop);
  }
  loop();

  EL.statusTxt.textContent   = 'câmera ativa';
  EL.statusTxt.style.color   = '#00b4ff';
  EL.intervaloTxt.textContent = INTERVALO_MS + 'ms';
  log('MediaPipe Holistic iniciado', 'info');
  log('Backend: ' + BACKEND, 'info');
}
