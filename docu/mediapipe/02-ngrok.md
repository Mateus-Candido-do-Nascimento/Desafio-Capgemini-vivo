---

## Branch feature/camera-mediapipe — o que foi feito

### Motivação
Com o simulador validado, o próximo passo foi conectar dados reais.
O celular vira o sensor visual — câmera processa localmente via MediaPipe,
manda só coordenadas abstratas para o backend. Sem imagem, sem rosto.

---

### 1. backend/routes/camera.py

Nova rota POST /sensor/frame que recebe landmarks do MediaPipe.

FrameMediaPipe — modelo Pydantic com os joints principais:
- nose_y, left/right_shoulder, left/right_hip, left/right_wrist
- visibility — confiança da detecção (abaixo de 0.5 = sem presença)

_traduzir_frame() — converte landmarks em EventoSensor:
- lean_front  = ombro_Y - quadril_Y → inclinação para frente
- shoulder_dx = diferença entre ombros → orientação lateral
- arm_raised  = pulso acima do ombro → braço levantado
- attention_score  = baseado em lean_front + arm_raised
- hesitation_score = baseado em simetria dos ombros

_inferir_estado() — regras de inferência baseadas no documento comportamental:
- visibility < 0.5         → idle
- arm_raised + atenção > 0.7 → decisao
- shoulder_dx < 0.08       → saindo (corpo de lado)
- atenção > 0.6 + hesitação < 0.4 → engajado
- hesitação > 0.55         → indeciso
- default                  → idle

Nenhuma imagem é armazenada — só coordenadas abstratas.

---

### 2. dashboard/camera.html

Página para abrir no celular.
- Liga câmera via getUserMedia
- Roda MediaPipe Pose localmente no browser
- Desenha skeleton no canvas em tempo real
- Envia landmarks via POST /sensor/frame a cada 3s (INTERVALO_MS)
- Exibe estado atual e log de frames enviados

Problema encontrado e resolvido:
- Browser bloqueia câmera em HTTP puro (só permite HTTPS ou localhost)
- Solução: ngrok cria túnel HTTPS gratuito apontando para localhost:8000
- URL gerada: https://costally-mythopoeic-alida.ngrok-free.dev

---

### 3. backend/providers/groq_provider.py

Adicionado retry automático em caso de rate limit:
- Até 3 tentativas com espera de 2s entre elas
- Fallback retorna estado idle se todas falharem
- Intervalo de 3s entre frames reduz consumo de tokens

Rate limit do Groq gratuito:
- Reseta a cada 1 minuto (limite por janela de tempo, não por dia)
- Com INTERVALO_MS=3000 o consumo fica dentro do limite

---

### Como rodar com câmera real

Terminal 1 — backend:
```
cd backend
venv\Scripts\activate
uvicorn main:app --port 8000 --host 0.0.0.0
```

Terminal 2 — ngrok:
```
cd backend
.\ngrok.exe http 8000
```

Celular — abre no browser:
```
https://SUA-URL.ngrok-free.app/dashboard/camera.html
```

PC — dashboard ao vivo:
```
https://SUA-URL.ngrok-free.app/dashboard
```

---

### Fluxo completo com câmera real

1. Celular abre camera.html via ngrok HTTPS
2. MediaPipe detecta joints do corpo em tempo real
3. A cada 3s extrai landmarks e envia POST /sensor/frame
4. Backend traduz landmarks → EventoSensor via regras comportamentais
5. AgenteService chama Groq → DecisaoIA
6. BroadcasterService faz broadcast via WebSocket
7. Dashboard atualiza wireframe + decisão em tempo real

### Próximos passos
- [ ] Upgrade Groq para aumentar limite de requisições
- [ ] Merge para developer
- [ ] Firmware ESP32 (segunda-feira)
- [ ] Testes finais integrados antes do hackathon
```

---

Commita:
```
git add docs/anotacoes.md
git commit -m "docs: documentacao branch camera-mediapipe"
git push origin feature/camera-mediapipe