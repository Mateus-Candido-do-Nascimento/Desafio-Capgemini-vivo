## Services — o que foi adicionado

### backend/services/broadcaster.py
Gerencia quem está conectado no WebSocket e envia mensagens.
- Mantém uma lista interna de conexões ativas
- `conectar(ws)` — aceita e registra um novo dashboard
- `desconectar(ws)` — remove da lista quando o dashboard fecha
- `broadcast(mensagem)` — envia para todos os conectados
- Se um dashboard cair no meio do envio, remove silenciosamente sem derrubar os outros
- `total_conexoes` — propriedade para saber quantos dashboards estão abertos

### backend/services/analytics.py
Salva cada evento e a decisão da IA no banco SQLite.
- Cria automaticamente a pasta `data/` e o arquivo `analytics.db` se não existirem
- `salvar(evento, decisao)` — persiste um registro completo no banco
- `ultimos(limite)` — retorna os N eventos mais recentes para consulta
- Tabela única `eventos` com todos os campos relevantes: postura, perfil da IA, confiança, latência

### backend/services/agente.py
Orquestra o ciclo completo de um evento.
- Recebe um EventoSensor, chama a IA, faz broadcast, salva no banco
- Não sabe nada sobre Groq, WebSocket ou SQLite diretamente
- Depende apenas das interfaces e dos outros services (injeção de dependência)
- `processar(evento, tipo)` — único método público, faz tudo em sequência

## Por que essa ordem importa

broadcaster → analytics → agente

O agente depende dos dois anteriores.
Por isso foram criados nessa sequência —
agente só pode ser escrito depois que os outros existem.