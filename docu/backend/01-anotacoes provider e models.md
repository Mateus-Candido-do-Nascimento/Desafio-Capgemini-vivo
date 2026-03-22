# Anotações — OlhoVivo AI

## O que já foi feito

### backend/models/schemas.py
Define as estruturas de dados do projeto (Pydantic).
- `EventoSensor` — dados que chegam do ESP32 + MediaPipe (presença, postura, atenção, hesitação)
- `DecisaoIA` — resposta da IA (perfil, ação, confiança, urgência)
- `MensagemWS` — o que é enviado pelo WebSocket para o dashboard
- `SimularRequest` — body do endpoint /simular

### backend/providers/ia_provider.py
Interface abstrata (ABC) para qualquer IA.
- Define o contrato: quem quiser ser um IAProvider precisa implementar `analisar(evento)`
- Nenhuma lógica aqui — só a assinatura do método

### backend/providers/sensor_provider.py
Interface abstrata (ABC) para qualquer fonte de sensor.
- Define o contrato: quem quiser ser um SensorProvider precisa implementar `gerar_evento(cenario)`
- Nenhuma lógica aqui — só a assinatura do método

### backend/providers/groq_provider.py
Implementação concreta de IAProvider usando Groq API + Llama 3.3 70B.
- Recebe um EventoSensor, monta o prompt, chama a Groq, retorna DecisaoIA
- Se der erro na API, retorna uma DecisaoIA de fallback (não deixa o sistema cair)

### backend/providers/simulator_provider.py
Implementação concreta de SensorProvider sem hardware físico.
- Gera EventoSensor falso baseado em cenários pré-definidos
- Cenários disponíveis: indeciso, quase_comprando, prestes_a_sair, pesquisando, medo_de_errar, sem_presenca
- Na segunda quando o ESP32 chegar: criar ESP32Provider e trocar aqui — nada mais muda

---

## O que falta fazer

- [ ] services/broadcaster.py — gerencia conexões WebSocket
- [ ] services/analytics.py  — salva eventos no SQLite
- [ ] services/agente.py     — orquestra evento → IA → broadcast → salvar
- [ ] routes/evento.py       — endpoint POST /evento
- [ ] routes/simular.py      — endpoint POST /simular
- [ ] main.py                — junta tudo e sobe o servidor
- [ ] dashboard conectado ao WebSocket
- [ ] firmware ESP32

---

## Princípios SOLID aplicados

- **S** — cada arquivo tem uma única responsabilidade
- **O** — novo provider de IA? só criar a classe, não mexer em nada existente
- **D** — AgenteService depende de IAProvider (interface), não do Groq diretamente

---

## Comandos úteis
```bash
# Ativar ambiente virtual (Windows)
venv\Scripts\activate

# Instalar dependências
pip install -r requirements.txt

# Rodar o servidor
uvicorn main:app --reload --port 8000

# Commitar
git add .
git commit -m "feat(backend): descrição do que foi feito"
git push origin developer
```

## Cenários do simulador

| Cenário          | Comportamento                        | Urgência esperada |
|------------------|--------------------------------------|-------------------|
| indeciso         | Parado, olhando o produto            | MEDIA             |
| quase_comprando  | Inclinado, pegando o produto         | BAIXA             |
| prestes_a_sair   | Virando para a saída                 | CRITICA           |
| pesquisando      | Olhando vários produtos              | BAIXA             |
| medo_de_errar    | Verificando detalhes repetidamente   | MEDIA             |
| sem_presenca     | Ninguém na área                      | —                 |