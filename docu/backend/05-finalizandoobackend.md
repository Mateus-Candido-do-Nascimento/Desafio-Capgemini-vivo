## Status do backend

### Testado e funcionando em 21/03/2026

- GET /            → 200 OK
- GET /health      → 200 OK
- GET /simular/indeciso       → perfil INDECISO, confiança 74%, 1268ms
- GET /simular/prestes_a_sair → perfil PRESTES_A_SAIR, urgência ALTA, 742ms
- GET /simular/quase_comprando → perfil QUASE_COMPRANDO, confiança 93%, 620ms
- WebSocket /ws    → conecta e recebe MensagemWS
- Swagger em http://localhost:8000/docs

### Comandos para rodar
```bash
cd backend
venv\Scripts\activate
uvicorn main:app --reload --port 8000
```

### Dependências instaladas (Python 3.13)
```
fastapi==0.135.1
uvicorn==0.42.0
groq==1.1.1
python-dotenv==1.2.2
pydantic==2.12.5
```