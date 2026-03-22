# OlhoVivo AI — Anotações do Projeto
**Hackathon Mackenzie × Capgemini + VIVO · 2026**

> "Sem rosto. Sem voz. Sem dados pessoais. Só decisão inteligente no momento certo."

---

## Índice
1. [O que o projeto faz](#1-o-que-o-projeto-faz)
2. [Estrutura de arquivos](#2-estrutura-de-arquivos)
3. [Fluxo completo de ponta a ponta](#3-fluxo-completo-de-ponta-a-ponta)
4. [Backend — cada arquivo explicado](#4-backend--cada-arquivo-explicado)
5. [Frontend — cada arquivo explicado](#5-frontend--cada-arquivo-explicado)
6. [Os 5 estados comportamentais](#6-os-5-estados-comportamentais)
7. [Como rodar](#7-como-rodar)
8. [O que está funcionando hoje](#8-o-que-está-funcionando-hoje)
9. [O que ainda precisa ser feito](#9-o-que-ainda-precisa-ser-feito)
10. [Problemas conhecidos](#10-problemas-conhecidos)

---

## 1. O que o projeto faz

O OlhoVivo AI detecta o comportamento de um cliente num showroom de eletrônicos
usando **apenas a câmera do celular** (sem gravar imagem, sem rosto) e um
**sensor IoT ESP32** (detecção de presença).

O sistema classifica o cliente em um dos **5 estados comportamentais** e
recomenda uma ação ao vendedor em tempo real, via dashboard web.

**Ciclo SENTIR → PENSAR → AGIR:**

```
Celular (MediaPipe)  ──POST /sensor/frame──►  Backend (FastAPI)
ESP32 (sensor PIR)   ──POST /evento       ──►  │
                                               │ _traduzir_frame()
                                               │ _inferir_estado()
                                               │ Groq API (Llama 3.3 70B)
                                               │
                                               └──WS broadcast──► Dashboard
                                                                   wireframe ao vivo
                                                                   decisão + ação
```

---

## 2. Estrutura de arquivos

```
backend/
  main.py                    Ponto de entrada — instancia tudo, registra rotas
  models/
    schemas.py               Tipos Pydantic: EventoSensor, DecisaoIA, MensagemWS
  providers/
    ia_provider.py           Interface abstrata IAProvider (ABC)
    groq_provider.py         Implementação: Groq API + Llama 3.3 70B
    sensor_provider.py       Interface abstrata SensorProvider (ABC)
    simulator_provider.py    Implementação: gera eventos falsos por cenário
  services/
    agente.py                Orquestra: evento → IA → broadcast → salvar
    broadcaster.py           Gerencia conexões WebSocket ativas
    analytics.py             Persiste eventos no SQLite (data/analytics.db)
  routes/
    evento.py                POST /evento  (receberá dados do ESP32)
    simular.py               GET  /simular/{cenario}  (botões do dashboard)
    camera.py                POST /sensor/frame  (landmarks do MediaPipe)

dashboard/
  index.html                 HTML estrutural — sem lógica nenhuma
  css/style.css              Todo o CSS isolado
  js/
    wireframe.js             Canvas: modo LIVE (landmarks reais) + modo POSE (simulador)
    dashboard.js             atualizarMetricas() — atualiza tudo na tela
    websocket.js             Conexão WS, reconexão automática a cada 3s
  camera.html                Página do celular: MediaPipe + envio de frames
```

---

## 3. Fluxo completo de ponta a ponta

### Via câmera (caminho principal hoje)

```
1.  Celular abre camera.html via ngrok (HTTPS obrigatório para câmera mobile)
2.  Usuário clica FRONTAL ou TRASEIRA
3.  getUserMedia() abre a câmera escolhida
4.  MediaPipe Pose roda localmente no browser — detecta joints do corpo
5.  A cada 2s, extrai landmarks e envia POST /sensor/frame
6.  Backend recebe FrameMediaPipe — Pydantic valida todos os campos [0.0, 1.0]
7.  _traduzir_frame() calcula métricas comportamentais:
       shoulder_dx  = distância horizontal entre ombros (frente vs. lado)
       arm_raised   = pulso acima do ombro (alcançando produto)
       head_down    = nariz próximo dos ombros (lendo etiqueta)
       attention    = 0.3 + shoulder_dx×1.2 + 0.25(braço) + 0.1(cabeça)
       hesitation   = 0.8 - shoulder_dx×2.0
8.  _inferir_estado() classifica em um dos 5 estados
9.  AgenteService chama Groq → DecisaoIA com raciocínio + ação
10. BroadcasterService faz broadcast via WebSocket
11. Analytics salva evento + decisão no SQLite
12. Dashboard recebe MensagemWS:
       landmarks → wireframe modo LIVE (corpo real)
       payload   → métricas, barras, badge de estado
       decisao   → raciocínio da IA, ação recomendada, confiança
```

### Via simulador (botões do dashboard)

```
1. Usuário clica botão (INDECISO, DECISÃO, SAINDO, etc.)
2. triggerScenario() faz GET /simular/{cenario}
3. SimulatorProvider gera EventoSensor falso com valores coerentes
4. Mesmo caminho a partir do passo 9 acima
5. MensagemWS chega SEM landmarks → wireframe usa pose animada
```

---

## 4. Backend — cada arquivo explicado

### `models/schemas.py`

Define os **tipos de dados** que circulam pelo sistema.

```python
EventoSensor   # O que o sensor envia: presença, postura, estado, scores
DecisaoIA      # O que a IA responde: perfil, confiança, ação, urgência
MensagemWS     # O que vai pelo WebSocket para o dashboard
               # campo landmarks: dict opcional com dados brutos do MediaPipe
SimularRequest # Body do POST /simular
```

O campo `MensagemWS.landmarks` foi adicionado para carregar os dados brutos
do MediaPipe junto com a mensagem WebSocket, permitindo que o wireframe
espelhe o corpo real do cliente em tempo real.

---

### `providers/groq_provider.py`

Chama o Groq API com Llama 3.3 70B e retorna uma `DecisaoIA`.

- `temperature=0.2` → respostas determinísticas e consistentes
- Retry automático: até 3 tentativas com espera de 2s em rate limit
- Fallback: retorna estado `idle` se todas as tentativas falharem

**Problema atual:** é chamado a cada frame (a cada 2s), esgotando o
rate limit gratuito. Solução planejada na seção 10.

---

### `services/agente.py`

Orquestra o ciclo completo. Único método público: `processar()`.

```python
async def processar(evento, tipo="evento", landmarks=None) -> DecisaoIA:
    decisao  = self._ia.analisar(evento)          # chama Groq
    mensagem = MensagemWS(tipo, payload, decisao, landmarks)
    await self._broadcaster.broadcast(mensagem)   # manda pro dashboard
    self._analytics.salvar(evento, decisao)       # salva no SQLite
    return decisao
```

O parâmetro `landmarks` foi adicionado para repassar os dados brutos do
MediaPipe até o dashboard, sem processar ou armazenar — só transporte.

---

### `services/broadcaster.py`

Mantém a lista de WebSockets conectados e faz broadcast.

**Por que não usar Depends() do FastAPI?**
O Depends() instancia uma nova dependência a cada request. O broadcaster
precisa ser uma única instância compartilhada — se fosse recriado a cada
request, a lista de conexões estaria sempre vazia.

---

### `routes/camera.py`

Recebe landmarks do MediaPipe e transforma em comportamento.

**`FrameMediaPipe`** — todos os campos têm `ge=0.0, le=1.0`. O Pydantic
rejeita com HTTP 422 qualquer valor fora desse range. Por isso o
`camera.html` clampeia tudo com `cl = v => Math.min(1, Math.max(0, v))`.

**Métricas calculadas em `_traduzir_frame()`:**

| Métrica | Cálculo | Significado |
|---------|---------|-------------|
| `shoulder_dx` | `abs(left_shoulder_x - right_shoulder_x)` | Alto = de frente; baixo = de lado |
| `arm_raised` | `wrist_y_avg < shoulder_y` | Pulso acima do ombro |
| `head_down` | `nose_y > shoulder_y - 0.08` | Cabeça abaixada |
| `attention` | `0.3 + shoulder_dx×1.2 + 0.25×arm + 0.1×head` | Engajamento |
| `hesitation` | `0.8 - shoulder_dx×2.0` | Indecisão |

**Regras de inferência em `_inferir_estado()` (ordem de prioridade):**

```
1. visibility < 0.4           → idle     (sem corpo detectável)
2. arm_raised + atenção > 0.5 → decisao  (alcançando produto)
3. shoulder_dx < 0.12         → saindo   (corpo de lado)
4. atenção > 0.5 + hesit < 0.5 → engajado
5. hesitação > 0.45           → indeciso
6. atenção > 0.35             → engajado (fraco)
7. default                    → idle
```

---

### `main.py`

**Ordem de instanciação — sempre nessa sequência:**
```python
broadcaster → analytics → ia → sensor → agente
```
O agente depende dos quatro anteriores.

---

## 5. Frontend — cada arquivo explicado

### `js/wireframe.js`

Tem dois modos que alternam automaticamente:

**Modo LIVE** — ativado por `setLandmarks(lm, estado)` quando chega dados
da câmera real. Espelha os landmarks do corpo:
- Espelha X (`1 - x`) porque câmera frontal inverte esquerda/direita
- Lerp suave entre frames (velocidade 0.18) — evita tremido
- Cotovelos estimados como 2/3 do caminho ombro → pulso
- Pernas projetadas abaixo do quadril (não vêm do MediaPipe)
- Efeito visual por estado: pulso em `decisao`/`engajado`, tremor em `indeciso`
- Label `LIVE — ESTADO` no rodapé do canvas

**Modo POSE** — ativado por `setEstado(estado)` quando chega do simulador.
Interpola entre poses pré-definidas com lerp mais lento (0.06).
- 7 poses: idle, ausente, indeciso, comprando, saindo, pesquisa, medo
- Label `WIREFRAME — ESTADO` no rodapé

**API pública:**
```javascript
setLandmarks(lm, estado)  // chamado por dashboard.js quando há câmera
setEstado(estado)         // chamado por dashboard.js quando vem do simulador
```

---

### `js/dashboard.js`

Função central: `atualizarMetricas(payload, decisao, landmarks = null)`

- Se `landmarks` existe → `setLandmarks()` (corpo real)
- Se não existe → `setEstado()` (pose animada)
- Atualiza: métricas, barras, badge de perfil, raciocínio da IA,
  ação recomendada, confiança, timeline, log, alertas, stats

---

### `js/websocket.js`

- Conecta em `ws://localhost` (local) ou `wss://host` (ngrok)
- Ping a cada 20s — mantém conexão viva
- Reconexão automática em 3s se cair
- Repassa `msg.landmarks` para `atualizarMetricas()`

---

### `camera.html`

Roda no celular do operador via ngrok (HTTPS obrigatório).

**Dois botões sempre visíveis:**
- `◉ FRONTAL` — câmera virada para si mesmo (para testar/calibrar)
- `◎ TRASEIRA` — câmera apontada para o cliente (uso real)

Clicar em qualquer botão para o stream anterior e abre o novo.

**Por que `getUserMedia` direto e não `Camera` do MediaPipe?**
O `Camera` utility do MediaPipe não atribui o stream ao `<video>`,
deixando-o preto no Chrome mobile. Com `getUserMedia` direto, o vídeo
aparece e o canvas do skeleton fica em overlay.

**Painel de calibração** (em tempo real, sem backend):
- Mostra `shoulder_dx`, `lean_front`, `arm_raised`, `head_down`
- `attention_score` e `hesitation_score` calculados localmente
- Estado inferido local vs. estado do backend lado a lado
- Serve para entender o que o sistema está vendo e ajustar thresholds

---

## 6. Os 5 estados comportamentais

| Estado | Cor | Sinal principal | Ação do vendedor |
|--------|-----|----------------|-----------------|
| `idle` | Cinza | Baseline, sem engajamento | Nenhuma |
| `engajado` | Azul | Corpo orientado ao produto | Monitorar |
| `indeciso` | Amarelo | Dwell time alto, hesitação | Aproximar com info técnica |
| `decisao` | Verde | Braço levantado, atenção alta | Facilitar conversão |
| `saindo` | Vermelho | Corpo rotacionado para saída | Alerta crítico |

**Aliases no simulador:**
```
medo, medo_de_errar      → indeciso
comprando, quase_comprando → decisao
prestes_a_sair           → saindo
pesquisa, pesquisando    → engajado
sem_presenca             → idle
```

---

## 7. Como rodar

```bash
# Terminal 1 — backend
cd backend
venv\Scripts\activate
uvicorn main:app --reload --port 8000 --host 0.0.0.0

# Terminal 2 — ngrok
cd backend
.\ngrok.exe http 8000
```

Acessar no browser:
```
Dashboard:  https://SUA-URL.ngrok-free.app/dashboard
Câmera:     https://SUA-URL.ngrok-free.app/dashboard/camera.html
Docs API:   http://localhost:8000/docs
```

Variável de ambiente necessária em `backend/.env`:
```
GROQ_API_KEY=sua_chave_aqui
```

---

## 8. O que está funcionando hoje

- [x] Backend: todos os endpoints, WebSocket, Groq, SQLite
- [x] Simulador: 5 estados + aliases de retrocompatibilidade
- [x] Dashboard: métricas, barras, timeline, log, alertas
- [x] Wireframe modo POSE: 5 poses animadas pelo simulador
- [x] Wireframe modo LIVE: espelha corpo real da câmera em tempo real
- [x] camera.html: câmera frontal e traseira no Chrome mobile via ngrok
- [x] `saindo` detectado quando corpo vira de lado
- [x] `decisao` detectado quando braço é levantado
- [x] Painel de calibração com valores em tempo real

---

## 9. O que ainda precisa ser feito

- [ ] **Firmware ESP32** — `POST /evento` com sensor PIR + `tempo_parado`
  - Hoje `tempo_parado` está hardcoded como `0`
  - Com ESP32 ele enviará o tempo desde que detectou presença

- [ ] **Throttle do Groq** — chamar IA só quando estado muda
  - Hoje chama Groq a cada 2s (todo frame) → esgota rate limit
  - Solução: chamar só quando estado muda OU a cada 15s no mesmo estado

- [ ] **Detecção de `indeciso` com histórico**
  - `indeciso` precisa de contador — "mesmo estado por N segundos"
  - Hoje é difícil de disparar por regra estática

- [ ] **Testes integrados** — câmera + ESP32 + dashboard simultâneos

---

## 10. Problemas conhecidos

### Rate limit do Groq
**Sintoma:** Dashboard para de atualizar após alguns segundos.
**Causa:** Groq chamado a cada frame (2s). Rate limit gratuito esgota.
**Solução planejada:** Throttle — chamar Groq só em mudança de estado
ou a cada 15s mínimo.

### `indeciso` raramente detectado
**Causa:** `shoulder_dx` frontal é sempre alto → `attention` sempre
passa de 0.5 → `engajado` sempre ganha antes de `indeciso`.
**Solução planejada:** Histórico de frames — `indeciso` quando parado
por mais de 10s no mesmo estado sem braço levantado.

### `tempo_parado` sempre zero
**Causa:** Hardcoded em `_traduzir_frame()`. Aguardando ESP32.