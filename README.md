# OlhoVivo AI

Sistema de **inteligência comportamental para varejo físico** que combina:

- **ESP32 + HC-SR04** para detectar presença e tempo de permanência;
- **MediaPipe Pose (no navegador/celular)** para inferir postura e atenção;
- **Backend FastAPI** para fusão sensorial, psicometria e decisão com IA (Groq);
- **Dashboard em tempo real** via WebSocket para operação em loja.

---

## Visão geral da arquitetura

1. O **ESP32** envia `presenca` e `tempo_parado` para `POST /sensor/esp32`.
2. A **câmera (MediaPipe)** envia landmarks para `POST /sensor/frame`.
3. O backend mantém um **estado fundido** dos sensores e gera um `EventoSensor`.
4. O `AgenteService` executa:
   - avaliação psicométrica determinística;
   - análise com IA (Groq / Llama 3.3 70B);
   - broadcast para dashboards conectados;
   - persistência em SQLite para analytics.
5. O ESP32 recebe de volta `estado`, `led` e `led_modo` para atuar no PDV.

---

## Estrutura do projeto

```text
.
├── backend/
│   ├── main.py                 # App FastAPI + WebSocket + rotas
│   ├── models/schemas.py       # Schemas Pydantic (eventos, decisão, WS)
│   ├── routes/
│   │   ├── camera.py           # Endpoint de frame MediaPipe
│   │   ├── esp32.py            # Endpoint do sensor ESP32
│   │   └── evento.py           # Endpoint manual de evento
│   ├── services/
│   │   ├── agente.py           # Orquestra IA + broadcast + analytics
│   │   ├── estado_sensor.py    # Quadro branco de fusão dos sensores
│   │   ├── broadcaster.py      # Gestão de conexões WebSocket
│   │   └── analytics.py        # Persistência SQLite (analytics.db)
│   ├── providers/
│   │   └── groq_provider.py    # Integração com Groq
│   └── requirements.txt
├── dashboard/
│   ├── index.html              # Painel operacional em tempo real
│   ├── camera.html             # Captura e envio de landmarks
│   ├── css/
│   └── js/
└── esp32/
    └── olhovivo_esp32.ino      # Firmware ESP32
```

---

## Pré-requisitos

- **Python 3.11+**
- **pip**
- **Placa ESP32** (para fluxo físico)
- **Arduino IDE** com bibliotecas:
  - `ArduinoJson` (6.x)
- Chave da API Groq:
  - variável `GROQ_API_KEY`

---

## Configuração do backend

No diretório `backend/`:

```bash
python -m venv .venv
source .venv/bin/activate      # Linux/macOS
# .venv\Scripts\activate      # Windows
pip install -r requirements.txt
```

Crie um arquivo `.env` em `backend/` com:

```env
GROQ_API_KEY=sua_chave_aqui
```

### Subir a API

Ainda em `backend/`:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

A aplicação ficará disponível em:

- API root: `http://localhost:8000/`
- Health: `http://localhost:8000/health`
- Dashboard: `http://localhost:8000/dashboard`
- Docs Swagger: `http://localhost:8000/docs`
- WebSocket: `ws://localhost:8000/ws`

---

## Endpoints principais

### `POST /sensor/frame`
Recebe landmarks do MediaPipe e processa decisão comportamental.

### `POST /sensor/esp32`
Recebe presença/tempo do ESP32 e retorna orientação para LED + ação.

### `POST /evento/`
Recebe um `EventoSensor` completo (uso manual/testes).

### `GET /health`
Status do backend e número de dashboards conectados.

---

## Rodando dashboard e câmera

Com o backend ligado:

1. Abra `http://localhost:8000/dashboard` para o painel operacional.
2. Abra `http://localhost:8000/dashboard/camera.html` em um celular/notebook com câmera.
3. Garanta que a página de câmera esteja apontando para o backend correto.

> Dica: em ambiente externo (celular em outra rede), use túnel como ngrok e configure a URL no frontend e no firmware.

---

## Firmware ESP32 (resumo)

Arquivo: `esp32/olhovivo_esp32.ino`.

Passos:

1. Atualize no código:
   - `WIFI_SSID`
   - `WIFI_PASSWORD`
   - `BACKEND_URL` (ex.: `https://<seu-tunel>/sensor/esp32`)
2. Faça upload para o ESP32.
3. Abra o Monitor Serial para acompanhar leituras e respostas do backend.

Estados de LED mapeados no backend:

- `engajado` → LED 1 (`pulso_suave`)
- `indeciso` → LED 2 (`pulso_lento`)
- `decisao`  → LED 3 (`pulso_rapido`)

---

## Persistência e analytics

Os eventos são armazenados em SQLite em:

- `backend/data/analytics.db`

A tabela `eventos` salva presença, postura, scores, perfil da IA, urgência e latência.

---

## Fluxo de teste rápido (sem ESP32)

Com a API rodando, faça um POST manual:

```bash
curl -X POST http://localhost:8000/evento/ \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "esp32-loja-01",
    "setor": "eletronicos",
    "presenca": true,
    "tempo_parado": 8,
    "movimento": "baixo",
    "postura": "lendo_etiqueta",
    "estado_estimado": "indeciso",
    "attention_score": 0.62,
    "hesitation_score": 0.71,
    "emocao": "neutro",
    "sub_estado": "em_duvida"
  }'
```

---

## Tecnologias

- **FastAPI** + **Uvicorn**
- **Pydantic v2**
- **WebSocket**
- **Groq API (Llama 3.3 70B)**
- **SQLite**
- **ESP32 (Arduino/C++)**
- **MediaPipe Pose (frontend)**

---

## Observações importantes

- O sistema foi desenhado para **decisão assistida em tempo real** no PDV.
- Quando não há presença (`idle`), a IA evita chamadas desnecessárias para economizar tokens.
- A psicometria atua como camada determinística complementar antes da IA generativa.
