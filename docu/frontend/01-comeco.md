## Dashboard — o que foi feito

### Separação de responsabilidades (SOLID aplicado)

dashboard/
├── index.html        ← só HTML estrutural, sem lógica
├── css/
│   └── style.css     ← todo o CSS isolado
└── js/
    ├── wireframe.js  ← canvas + animação da figura humana
    ├── dashboard.js  ← estado, logs, timeline, clock, simulador
    └── websocket.js  ← conexão WS, reconexão automática

### dashboard/css/style.css
Todo o CSS do projeto — variáveis, layout, componentes.
Nenhuma lógica, só visual.

### dashboard/js/wireframe.js
Responsabilidade única: desenhar e animar a figura humana no canvas.
- Poses definidas por estado (indeciso, comprando, saindo, pesquisa, medo, ausente)
- Lerp suave entre poses a cada frame
- Efeitos visuais por estado (tremor no indeciso, pulso no comprando)
- Não sabe nada de WebSocket ou de decisão da IA

### dashboard/js/dashboard.js
Responsabilidade única: gerenciar estado e atualizar a tela.
- `atualizarMetricas(payload, decisao)` — função central que atualiza tudo
- `addLog`, `addTimeline`, `showAlert` — helpers de UI
- `triggerScenario(cenario)` — botões do simulador chamam GET /simular/{cenario}
- `toggleAuto()` — auto-ciclo de cenários a cada 8s
- Não sabe nada de como a conexão WS funciona

### dashboard/js/websocket.js
Responsabilidade única: conexão com o backend.
- Conecta em ws://localhost:8000/ws
- Reconecta automaticamente a cada 3s se cair
- Ping a cada 20s para manter a conexão viva
- Quando chega mensagem, chama atualizarMetricas() do dashboard.js
- Não sabe nada de canvas ou de como a tela é atualizada

### backend/main.py — serve o dashboard
Adicionado mount estático:
- `StaticFiles` serve a pasta dashboard/ em /dashboard
- Caminho calculado com `Path(__file__).parent.parent / "dashboard"`
- Funciona independente de onde o servidor é iniciado

## Fluxo completo funcionando

1. Backend sobe em localhost:8000
2. Dashboard abre em localhost:8000/dashboard
3. websocket.js conecta em ws://localhost:8000/ws
4. Botão do simulador chama GET /simular/{cenario}
5. Backend gera evento → chama Groq → faz broadcast via WS
6. websocket.js recebe → chama atualizarMetricas()
7. dashboard.js atualiza toda a tela
8. wireframe.js anima a figura para a pose correta
