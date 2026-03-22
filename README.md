# OlhoVivo AI

> Agente operacional para varejo físico que transforma sinais comportamentais observáveis em ações comerciais em tempo real.

O **OlhoVivo AI** é um MVP para showroom/loja física que combina **FastAPI**, **Groq + Llama 3.3 70B**, **dashboard em tempo real via WebSocket**, **simulação de eventos de sensor** e uma **página mobile com MediaPipe Pose**. O objetivo é detectar o estágio da jornada de compra de um cliente sem identificar rosto, voz ou dados pessoais, e então sugerir a melhor ação operacional para o vendedor.

---

## Sumário

1. [Visão geral](#visão-geral)
2. [Problema que o projeto resolve](#problema-que-o-projeto-resolve)
3. [Como o sistema funciona](#como-o-sistema-funciona)
4. [Arquitetura](#arquitetura)
5. [Estados comportamentais suportados](#estados-comportamentais-suportados)
6. [Stack e componentes](#stack-e-componentes)
7. [Estrutura do repositório](#estrutura-do-repositório)
8. [Pré-requisitos](#pré-requisitos)
9. [Configuração do ambiente](#configuração-do-ambiente)
10. [Como rodar localmente](#como-rodar-localmente)
11. [Como usar o projeto ponta a ponta](#como-usar-o-projeto-ponta-a-ponta)
12. [API e comunicação em tempo real](#api-e-comunicação-em-tempo-real)
13. [Persistência e analytics](#persistência-e-analytics)
14. [Privacidade e limites do sistema](#privacidade-e-limites-do-sistema)
15. [Problemas conhecidos e troubleshooting](#problemas-conhecidos-e-troubleshooting)
16. [Próximos passos](#próximos-passos)

---

## Visão geral

O fluxo principal do OlhoVivo AI é:

1. Um **sensor** envia um evento comportamental para o backend.
2. O backend normaliza esse evento para o schema `EventoSensor`.
3. O **AgenteService** chama a IA para classificar o comportamento.
4. A decisão é transmitida em **tempo real** para o dashboard via WebSocket.
5. O evento e a resposta da IA são salvos em **SQLite** para análise posterior.

O projeto hoje suporta dois caminhos de entrada:

- **Simulador de eventos**, ideal para demo, teste e validação do dashboard.
- **Câmera do celular com MediaPipe Pose**, que envia apenas landmarks corporais abstratos para o backend.

---

## Problema que o projeto resolve

Em loja física, o vendedor normalmente precisa perceber sinais sutis como:

- cliente apenas navegando,
- cliente genuinamente engajado,
- cliente hesitando,
- cliente prestes a decidir,
- cliente abandonando a área.

O OlhoVivo AI transforma esses sinais em uma leitura operacional clara, com foco em:

- **priorização de atendimento**,
- **ação comercial contextual**,
- **resposta em tempo real**,
- **observabilidade da jornada no PDV**,
- **preservação de privacidade**.

A proposta do sistema **não é inferir emoção, personalidade ou estado mental**. A classificação é limitada a sinais observáveis de jornada comercial.

---

## Como o sistema funciona

### Fluxo conceitual

```text
Sensor / Simulador / MediaPipe
            |
            v
      FastAPI Backend
            |
            v
      AgenteService
            |
     +------+------+ 
     |             |
     v             v
  Groq / LLM   Analytics SQLite
     |
     v
WebSocket broadcast
     |
     v
 Dashboard operacional
```

### Fluxo ponta a ponta com simulador

```text
Dashboard -> GET /simular/{cenario}
          -> SimulatorProvider gera EventoSensor
          -> AgenteService processa
          -> GroqProvider retorna DecisaoIA
          -> Broadcaster envia MensagemWS
          -> Dashboard atualiza métricas, timeline, alertas e wireframe
```

### Fluxo ponta a ponta com câmera real

```text
Celular abre /dashboard/camera.html
-> MediaPipe Pose detecta landmarks no navegador
-> Browser envia POST /sensor/frame
-> backend/routes/camera.py traduz landmarks em EventoSensor
-> AgenteService chama a IA
-> WebSocket /ws publica a decisão
-> Dashboard /dashboard exibe estado, scores e ação recomendada
```

---

## Arquitetura

### Backend

O backend foi organizado com separação clara de responsabilidades:

- **`models/`**: contratos de dados com Pydantic.
- **`providers/`**: integrações e fontes de dados (LLM, simulador).
- **`services/`**: orquestração, persistência e broadcast.
- **`routes/`**: camada HTTP.
- **`main.py`**: composição da aplicação.

### Frontend/dashboard

O frontend é um dashboard estático servido pelo próprio FastAPI:

- `dashboard/index.html`: estrutura da interface.
- `dashboard/js/dashboard.js`: atualização da UI, métricas, timeline e simulador.
- `dashboard/js/websocket.js`: conexão WS, reconexão e keepalive.
- `dashboard/js/wireframe.js`: visual do corpo/estado no canvas.
- `dashboard/camera.html`: página mobile para captura via MediaPipe.

### Instanciação das dependências

A aplicação usa **injeção manual** no `main.py`, preservando instâncias únicas de broadcaster, analytics, provider de IA e provider de sensor. Isso é importante principalmente para o WebSocket, porque a lista de conexões precisa ser compartilhada por toda a aplicação.

---

## Estados comportamentais suportados

O sistema valida e opera com exatamente **5 estados oficiais**:

| Estado | Significado operacional |
|---|---|
| `idle` | Cliente presente sem engajamento claro |
| `engajado` | Cliente observando/interagindo com foco no produto |
| `indeciso` | Cliente hesitando, comparando, sem progredir para ação |
| `decisao` | Cliente com forte sinal de conversão iminente |
| `saindo` | Cliente orientado para saída ou perda de interesse |

Esses estados são validados no schema para impedir entradas fora do domínio esperado.

---

## Stack e componentes

### Backend

- Python
- FastAPI
- Uvicorn
- Pydantic v2
- SQLite
- Groq SDK
- python-dotenv

### Frontend

- HTML
- CSS
- JavaScript vanilla
- WebSocket nativo do navegador
- MediaPipe Pose no modo câmera

### IA

- Groq API
- Modelo `llama-3.3-70b-versatile`

---

## Estrutura do repositório

```text
.
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py
│   ├── providers/
│   │   ├── __init__.py
│   │   ├── groq_provider.py
│   │   ├── ia_provider.py
│   │   ├── sensor_provider.py
│   │   └── simulator_provider.py
│   ├── routes/
│   │   ├── camera.py
│   │   ├── evento.py
│   │   └── simular.py
│   └── services/
│       ├── agente.py
│       ├── analytics.py
│       └── broadcaster.py
├── dashboard/
│   ├── camera.html
│   ├── index.html
│   ├── css/
│   └── js/
├── docu/
└── README.md
```

---

## Pré-requisitos

Para executar o projeto localmente, você precisa de:

- **Python 3.11+** recomendado
- acesso à internet para chamar a **Groq API**
- uma chave válida em `GROQ_API_KEY`
- navegador moderno com suporte a WebSocket
- opcionalmente, **celular + HTTPS/ngrok** para testar `camera.html`

> Se você quiser usar a câmera do celular, lembre-se: navegadores móveis normalmente só liberam `getUserMedia()` em **HTTPS** ou `localhost`.

---

## Configuração do ambiente

### 1. Criar e ativar ambiente virtual

#### Linux/macOS

```bash
python -m venv .venv
source .venv/bin/activate
```

#### Windows PowerShell

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 2. Instalar dependências

```bash
pip install -r backend/requirements.txt
```

### 3. Configurar variáveis de ambiente

Crie um arquivo `.env` dentro de `backend/` com o conteúdo abaixo:

```env
GROQ_API_KEY=sua_chave_aqui
```

> O `GroqProvider` faz `load_dotenv()` na inicialização, então o arquivo `.env` em `backend/` é o caminho mais simples para o setup local.

---

## Como rodar localmente

### Subir o backend

Na raiz do projeto:

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Se tudo estiver certo, os principais pontos de acesso serão:

- API base: `http://localhost:8000`
- healthcheck: `http://localhost:8000/health`
- Swagger UI: `http://localhost:8000/docs`
- dashboard: `http://localhost:8000/dashboard`
- câmera mobile: `http://localhost:8000/dashboard/camera.html`

---

## Como usar o projeto ponta a ponta

## Cenário 1 — rodando só com simulador

Esse é o jeito mais rápido de validar o projeto inteiro.

### Passo 1
Suba o backend:

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Passo 2
Abra o dashboard no navegador:

```text
http://localhost:8000/dashboard
```

### Passo 3
Use os botões do painel simulador:

- `NEUTRO`
- `ENGAJADO`
- `INDECISO`
- `DECISÃO`
- `SAINDO`
- `SEM PRESENÇA`

### O que acontece internamente

1. O frontend chama `GET /simular/{cenario}`.
2. O `SimulatorProvider` gera um `EventoSensor` coerente com o cenário.
3. O `AgenteService` processa o evento.
4. O `GroqProvider` devolve uma `DecisaoIA`.
5. O `BroadcasterService` envia a mensagem para o WebSocket.
6. O dashboard recebe e atualiza:
   - scores,
   - timeline,
   - log,
   - ação sugerida,
   - alertas,
   - contador de eventos.

---

## Cenário 2 — rodando com câmera real no celular

### Passo 1
Suba o backend:

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Passo 2
Exponha a porta com HTTPS.

Se você usar o ngrok que já está presente na pasta `backend/`, um exemplo seria:

```bash
cd backend
./ngrok.exe http 8000
```

> Em Linux/macOS, use a sua instalação local do ngrok. O binário versionado no repositório é Windows (`ngrok.exe`).

### Passo 3
Abra no celular:

```text
https://SUA-URL-NGROK/dashboard/camera.html
```

### Passo 4
Abra em outro dispositivo o dashboard operacional:

```text
https://SUA-URL-NGROK/dashboard
```

### Passo 5
Na tela da câmera:

- selecione **FRONTAL** ou **TRASEIRA**;
- permita acesso à câmera;
- confirme ou ajuste a URL do backend;
- acompanhe o estado local e o estado retornado pelo backend.

### O que acontece internamente

1. O navegador roda o **MediaPipe Pose** localmente.
2. A página extrai landmarks essenciais do corpo.
3. Os landmarks são enviados para `POST /sensor/frame`.
4. O backend traduz o frame em `EventoSensor`.
5. A IA classifica o comportamento em um dos 5 estados.
6. O backend publica a decisão via `/ws`.
7. O dashboard recebe a atualização em tempo real.

---

## API e comunicação em tempo real

## Endpoints HTTP

### `GET /`
Retorna status da aplicação, versão e quantidade de dashboards conectados.

### `GET /health`
Healthcheck simples para monitoramento.

### `POST /evento/`
Recebe um `EventoSensor` completo e retorna `DecisaoIA`.

Exemplo de payload:

```json
{
  "device_id": "esp32-loja-01",
  "setor": "eletronicos",
  "presenca": true,
  "tempo_parado": 18,
  "movimento": "baixo",
  "postura": "oscilando_orientacao",
  "estado_estimado": "indeciso",
  "attention_score": 0.58,
  "hesitation_score": 0.82
}
```

### `POST /simular/`
Recebe body com `cenario` opcional e gera um evento sintético.

Exemplo:

```json
{
  "cenario": "decisao"
}
```

### `GET /simular/{cenario}`
Atalho para testes rápidos pelo navegador ou pelo dashboard.

Exemplos válidos:

- `/simular/idle`
- `/simular/engajado`
- `/simular/indeciso`
- `/simular/decisao`
- `/simular/saindo`
- `/simular/sem_presenca`
- `/simular/aleatorio`

### `POST /sensor/frame`
Recebe landmarks do MediaPipe e retorna status do processamento.

---

## WebSocket

### `WS /ws`

Quando o dashboard conecta:

- recebe uma mensagem inicial com `tipo="connected"`;
- envia `ping` a cada 20 segundos;
- recebe `pong` do backend para manter a conexão viva.

As mensagens úteis seguem a estrutura abaixo:

```json
{
  "tipo": "camera",
  "payload": {
    "presenca": true,
    "estado_estimado": "engajado",
    "attention_score": 0.74,
    "hesitation_score": 0.21
  },
  "decisao": {
    "perfil": "engajado",
    "confianca": 0.88,
    "raciocinio": "Cliente orientado ao produto com sinais de atenção sustentada.",
    "acao_display": "Destaque benefícios do produto.",
    "acao_vendedor": "Aborde com prova rápida de valor.",
    "urgencia": "MEDIA",
    "latencia_ms": 850,
    "erro": false
  },
  "landmarks": {
    "left_shoulder_x": 0.42
  }
}
```

---

## Persistência e analytics

O projeto salva eventos no arquivo SQLite:

```text
backend/data/analytics.db
```

Cada registro guarda, entre outros campos:

- identificação do device,
- setor,
- presença,
- postura,
- estado inferido,
- attention score,
- hesitation score,
- perfil retornado pela IA,
- confiança,
- urgência,
- latência da chamada ao modelo,
- timestamp de criação.

Isso permite auditoria simples da operação e análise posterior dos comportamentos processados.

---

## Privacidade e limites do sistema

### O que o projeto faz

- classifica comportamento observável;
- usa proxies operacionais de jornada;
- envia landmarks abstratos do corpo;
- gera recomendação operacional para atendimento.

### O que o projeto não faz

- não reconhece identidade;
- não armazena imagem bruta;
- não interpreta emoções como verdade psicológica;
- não faz biometria;
- não usa rosto, voz ou dados pessoais.

### Observação importante

O projeto é um **MVP de apoio operacional**, não um sistema de diagnóstico comportamental. As decisões devem ser entendidas como **sugestões assistidas por IA**, não como verdade absoluta sobre intenção humana.

---

## Problemas conhecidos e troubleshooting

## 1. Erro de câmera no celular

**Sintoma:** a câmera não abre no navegador mobile.

**Causa comum:** página aberta em HTTP simples.

**Como resolver:** use HTTPS com ngrok e abra `camera.html` pela URL pública segura.

---

## 2. Dashboard não recebe atualizações

**Checklist:**

- backend está rodando na porta 8000;
- dashboard foi aberto em `/dashboard`;
- o WebSocket `/ws` está acessível;
- não há bloqueio de mixed content entre `https` e `ws://`.

> Fora de `localhost`, o frontend tenta usar `wss://{hostname}/ws`.

---

## 3. Falha na análise da IA

Se a Groq API falhar, o sistema retorna uma `DecisaoIA` de fallback com:

- `perfil="idle"`
- `erro=true`
- mensagem de recuperação operacional

Isso evita queda total do fluxo durante a demo.

---

## 4. Rate limit da Groq

A captura por câmera pode gerar várias requisições em sequência. Se o plano gratuito da Groq limitar o volume:

- aumente o intervalo entre envios;
- use o simulador durante a apresentação;
- reduza o volume de testes concorrentes;
- considere upgrade de plano ou fila/cache no backend.

---

## 5. Conexão WebSocket em produção/túnel

Se o dashboard estiver atrás de proxy/túnel:

- confirme suporte a upgrade de WebSocket;
- valide se o host público está servindo `wss://` corretamente;
- teste `https://host/dashboard` e `wss://host/ws` no mesmo domínio.

---

## Próximos passos

Possíveis evoluções para o projeto:

- adicionar testes automatizados para rotas e serviços;
- criar `.env.example` na raiz ou em `backend/`;
- disponibilizar Docker/Docker Compose;
- incluir endpoint para consulta dos últimos eventos salvos no SQLite;
- trocar o simulador por integração real com ESP32/PIR;
- adicionar observabilidade com logs estruturados;
- reduzir custo/token da IA com camada heurística antes do LLM;
- endurecer CORS e políticas de produção.

---

## Resumo executivo

O **OlhoVivo AI** já entrega um fluxo completo de demo:

- backend com FastAPI,
- inferência de estado operacional,
- decisão assistida por LLM,
- dashboard em tempo real,
- simulador para apresentação,
- modo câmera para captura com MediaPipe,
- persistência local em SQLite.

Se você quer demonstrar o projeto rapidamente, o caminho mais estável é:

1. subir o backend,
2. abrir `/dashboard`,
3. usar o simulador,
4. validar o fluxo completo ao vivo.

Se quiser demonstrar o diferencial técnico, use:

1. backend + ngrok,
2. `/dashboard/camera.html` no celular,
3. `/dashboard` no notebook,
4. classificação ao vivo via MediaPipe + Groq.
