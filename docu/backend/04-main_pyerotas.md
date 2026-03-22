## Routes e Main — o que foi adicionado

### backend/routes/evento.py
Expõe o endpoint POST /evento.
- Usa o padrão `criar_router(agente)` — recebe o AgenteService pronto via parâmetro
- Não instancia nada — só usa o que o main.py injeta
- Responsabilidade única: receber o body, chamar agente.processar, devolver a DecisaoIA

### backend/routes/simular.py
Expõe os endpoints do simulador.
- Usa o padrão `criar_router(agente, sensor)` — recebe AgenteService e SensorProvider prontos
- POST /simular — body com campo cenario (ou null para aleatório)
- GET /simular/{cenario} — atalho para testar no browser sem precisar de Postman
- Responsabilidade única: pedir evento ao sensor, repassar ao agente

### backend/main.py
Ponto de entrada do sistema — única responsabilidade: montar as peças.
- Instancia todos os providers e services uma única vez (broadcaster, analytics, ia, sensor, agente)
- Injeta as dependências manualmente nos routers via criar_router()
- Registra as rotas no app FastAPI
- Gerencia o WebSocket — conectar, manter vivo, desconectar
- Middleware CORS liberado para qualquer origem (ajustar em produção)
- GET / e GET /health para monitoramento básico

## Por que criar_router() em vez de Depends()

O FastAPI tem um sistema de injeção via Depends() mas ele instancia
uma nova dependência a cada request. Para o broadcaster isso seria
um problema — cada request teria sua própria lista de conexões vazia.

Com criar_router() as instâncias são criadas uma vez no main.py
e compartilhadas entre todos os requests. O broadcaster sempre
tem a lista real de quem está conectado.

## Ordem de instanciação no main.py

broadcaster → analytics → ia → sensor → agente

O agente depende dos três primeiros.
Por isso a ordem importa — agente é sempre o último a ser criado.