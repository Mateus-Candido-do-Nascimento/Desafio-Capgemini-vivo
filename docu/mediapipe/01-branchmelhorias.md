---

## Branch feature/wireframe-melhorias — o que foi feito

### Motivação
O sistema tinha 12 estados granulares difíceis de comunicar para a banca.
Seguindo princípios de produto (GPT + documento comportamental),
simplificamos para 5 estados operacionais claros e defensáveis.

### Fundamentação científica
O arquivo docs/Olho_Vivo_AI_Comportamento.pdf sustenta os 5 estados
com literatura de retail analytics e comportamento não verbal.
Frase central do projeto:
"Classificamos sinais de jornada comercial observável,
não o mundo interno do cliente."

Pipeline defensável: sensor → contexto → regra → IA → ação

---

### 1. backend/models/schemas.py

Adicionado `ESTADOS_VALIDOS` e `@field_validator`:
- Sistema agora rejeita qualquer estado fora dos 5 oficiais
- Erro acontece na entrada dos dados (fail fast) antes de chamar o Groq
- Princípio S do SOLID: o schema valida, ninguém mais

Os 5 estados válidos:
- idle      → baseline neutra, sem engajamento
- engajado  → interesse ativo, corpo orientado ao produto
- indeciso  → fricção de decisão, dwell time alto
- decisao   → sinal de conversão iminente
- saindo    → risco de perda de venda

---

### 2. backend/providers/groq_provider.py

Prompt completamente reescrito com:
- Linguagem do documento comportamental
- Regras de inferência por estado com valores numéricos
- Ações específicas para eletrônicos (não genéricas)
- Proibição explícita de frases genéricas como "aproxime-se e ofereça ajuda"
- temperature=0.2 para respostas mais consistentes e determinísticas
- Fallback retorna estado "idle" — único estado neutro válido

---

### 3. backend/providers/simulator_provider.py

Cenários atualizados para os 5 estados oficiais:
- Sinais comportamentais coerentes por estado
  - indeciso  → hesitation_score alto (0.60–0.90) + tempo longo (15–40s)
  - decisao   → attention_score alto (0.80–0.98) + hesitation baixo
  - saindo    → attention_score baixo (0.10–0.35) + movimento alto
- ALIASES expandidos para compatibilidade retroativa
  - medo, medo_de_errar → indeciso
  - comprando, quase_comprando → decisao
  - prestes_a_sair → saindo
  - pesquisa, pesquisando → engajado
- sem_presenca mapeia para estado_estimado "idle"

---

### 4. dashboard/js/wireframe.js

Reescrito como componente de produto seguindo 3 princípios:
- Anônimo — geometria pura, sem rosto identificável
- Tecnológico — bounding box, ruído nos joints, estética MediaPipe
- Legível em 1 segundo — cor comunica estado imediatamente

5 estados visuais com cor, pose e microanimação própria:

| Estado   | Cor      | Gesto principal              | Microanimação        |
|----------|----------|------------------------------|----------------------|
| idle     | Cinza    | Reto, neutro                 | Respiração sutil     |
| engajado | Azul     | Inclinado para frente        | Anel pulsante        |
| indeciso | Amarelo  | Cabeça inclinada             | Oscilação leve       |
| decisao  | Verde    | Braço estendido, agachado    | Movimento descendente|
| saindo   | Vermelho | Corpo rotacionado para fora  | Deriva lateral       |

Extras visuais:
- Bounding box tracejado — simula campo de visão da câmera
- Ruído nos joints — simula comportamento real do MediaPipe
- Olhos e boca simplificados — anônimo por design
- Transição suave entre poses via lerp (speed=0.055)

---

### 5. dashboard/js/dashboard.js

- autoCycleList atualizado para os 5 estados oficiais
- COR_ESTADO e CLASSE_ESTADO — lookup tables simples substituem if/else
- atualizarMetricas() chama setEstado() do wireframe.js
- triggerScenario() sem aliases — chama diretamente o estado correto
- Stats: decisao conta como venda, ALTA/CRITICA conta como alerta

---

### 6. dashboard/index.html

Botões do simulador atualizados para os 5 estados:
- ⭕ NEUTRO → idle
- 👁️ ENGAJADO → engajado
- 🤔 INDECISO → indeciso
- 🛍️ DECISÃO → decisao
- 🚪 SAINDO → saindo
- 📡 SEM PRESENÇA → sem_presenca

---

### Próximo passo — camera.html

Criar página para o celular que:
1. Liga a câmera via browser
2. Roda MediaPipe Pose localmente
3. Traduz landmarks em EventoSensor
4. Envia POST /sensor/frame ao backend a cada 1s
5. Backend classifica estado e faz broadcast para o dashboard
`