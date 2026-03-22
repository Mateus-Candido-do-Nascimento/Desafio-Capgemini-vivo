# 👁 OlhoVivo AI

Agente de varejo físico que classifica o comportamento de clientes em tempo real usando câmera, MediaPipe e IA generativa (Groq + Llama 3.3 70B).

---

## Pré-requisitos

Antes de começar, você precisa ter instalado:

- [Python 3.10+](https://www.python.org/downloads/)
- [Git](https://git-scm.com/downloads)
- Uma chave de API da [Groq](https://console.groq.com) (gratuita)

---

## Passo a passo

### 1. Clone o repositório

```bash
git clone https://github.com/Mateus-Candido-do-Nascimento/Desafio-Capgemini-vivo.git
cd Desafio-Capgemini-vivo
```

### 2. Crie e ative o ambiente virtual

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python -m venv venv
source venv/bin/activate
```

### 3. Instale as dependências

```bash
pip install -r backend/requirements.txt
```

### 4. Configure a chave da Groq

Crie um arquivo `.env` dentro da pasta `backend/`:

```bash
# Windows
echo GROQ_API_KEY=sua_chave_aqui > backend/.env

# macOS / Linux
echo "GROQ_API_KEY=sua_chave_aqui" > backend/.env
```

> Substitua `sua_chave_aqui` pela sua chave em https://console.groq.com

### 5. Rode o backend

```bash
cd backend
uvicorn main:app --reload
```

O servidor vai rodar em: http://localhost:8000

### 6. Rode a câmera com MediaPipe

Abra um **novo terminal** (com o venv ativado) e rode:

```bash
python camera/mediapipe_sensor.py
```

---

## Testando a API

Com o servidor rodando, acesse a documentação interativa:

```
http://localhost:8000/docs
```

---

## Como funciona

```
Câmera → MediaPipe → EventoSensor → GroqProvider (Llama 3.3) → DecisaoIA
```

O sistema detecta o comportamento do cliente e classifica em 5 estados:

| Estado | Descrição |
|--------|-----------|
| `idle` | Cliente presente, sem engajamento |
| `engajado` | Corpo orientado ao produto |
| `indeciso` | Dwell alto, oscilação, sem decisão |
| `decisao` | Movimento de pegar o item |
| `saindo` | Rotação para fora, deslocamento |

A IA responde com ação para o **display da loja** e instrução para o **vendedor** em menos de 300ms.

---

## Privacidade

O sistema **não captura rostos nem dados pessoais** — apenas proxies comportamentais anônimos (postura, tempo parado, nível de movimento). Projetado para estar em conformidade com a LGPD.

---

## Problemas comuns

**Erro: `GROQ_API_KEY not found`**
→ Verifique se o arquivo `.env` está dentro da pasta `backend/` e se a chave está correta.

**Erro: `ModuleNotFoundError`**
→ Certifique-se de que o venv está ativado e que rodou `pip install -r backend/requirements.txt`.

**Câmera não abre**
→ Verifique se nenhum outro programa está usando a webcam.
