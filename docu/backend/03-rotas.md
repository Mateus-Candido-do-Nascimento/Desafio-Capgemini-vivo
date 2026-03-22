### backend/routes/evento.py
Expõe o endpoint POST /evento.
- Recebe o JSON do ESP32, repassa para o AgenteService processar
- Não tem lógica — só valida o body e delega

### backend/routes/simular.py
Expõe os endpoints do simulador.
- POST /simular — body com campo cenario (ou null para aleatório)
- GET /simular/{cenario} — atalho para testar no browser
- Pede o evento ao SensorProvider e repassa para o AgenteService