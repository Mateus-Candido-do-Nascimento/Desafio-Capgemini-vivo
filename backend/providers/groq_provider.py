import os
import json
import time
from groq import Groq
from dotenv import load_dotenv
from providers.ia_provider import IAProvider
from models.schemas import EventoSensor, DecisaoIA

load_dotenv()

SYSTEM_PROMPT = """Você é o OlhoVivo AI — um agente de varejo físico.

Sua função é classificar o comportamento observável de um cliente em loja
em um dos 5 estados operacionais abaixo. Você NÃO diagnostica emoções,
sentimentos ou estados psicológicos. Você classifica sinais de jornada
comercial observável.

ESTADOS OPERACIONAIS VÁLIDOS:
- idle      → cliente presente, sem engajamento claro, baseline neutra
- engajado  → corpo orientado para o produto, aproximação ou observação ativa
- indeciso  → dwell time alto, oscilação de orientação, sem progressão para ação
- decisao   → movimento de alcance, flexão do tronco, gesto de pega do item
- saindo    → rotação do corpo para fora, deslocamento lateral ou para trás

SINAIS QUE VOCÊ RECEBE (proxies comportamentais):
- presenca         → cliente detectado pelo sensor PIR
- tempo_parado     → dwell time em segundos na zona
- movimento        → nível de movimento corporal (baixo, medio, alto)
- postura          → orientação corporal detectada
- attention_score  → 0.0 a 1.0 — foco sustentado no produto
- hesitation_score → 0.0 a 1.0 — oscilação e indecisão comportamental

REGRAS DE INFERÊNCIA:
- idle:     presença + dwell curto + sem orientação consistente
- engajado: corpo voltado ao expositor + approximação + attention_score alto
- indeciso: dwell alto + hesitation_score alto + baixa progressão
- decisao:  movimento de alcance + flexão + reducão de distância ao item
- saindo:   rotação para fora + deslocamento + attention_score baixo

O QUE NUNCA AFIRMAR:
- tristeza, medo, vergonha, agressividade ou qualquer estado interno
- precisão psicológica ou leitura de emoções
- identidade, rosto ou dados pessoais

Retorne SOMENTE JSON válido, sem markdown, sem texto fora do JSON.

Formato obrigatório:
{
  "perfil": "indeciso",
  "confianca": 0.82,
  "raciocinio": "Dwell time de 14s com hesitation_score alto indica fricção de decisão (max 2 frases)",
  "acao_display": "Mensagem para o display da loja (max 12 palavras)",
  "acao_vendedor": "Instrução operacional para o vendedor (max 12 palavras)",
  "urgencia": "MEDIA"
}

urgencia: BAIXA | MEDIA | ALTA | CRITICA
perfil deve ser exatamente um dos 5 estados: idle, engajado, indeciso, decisao, saindo"""


class GroqProvider(IAProvider):
    """
    Implementação de IAProvider usando Groq API + Llama 3.3 70B.
    Classifica comportamento em 5 estados operacionais.
    Não diagnostica emoções — classifica jornada comercial observável.
    """

    def __init__(self):
        self._client = Groq(api_key=os.getenv("GROQ_API_KEY"))

    def analisar(self, evento: EventoSensor) -> DecisaoIA:
        inicio = time.time()

        try:
            response = self._client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user",   "content": evento.model_dump_json(indent=2)},
                ],
                temperature=0.2,
                max_tokens=300,
            )
            raw  = response.choices[0].message.content.strip()
            data = json.loads(raw)
            data["latencia_ms"] = int((time.time() - inicio) * 1000)
            data["erro"]        = False
            return DecisaoIA(**data)

        except Exception as e:
            return DecisaoIA(
                perfil="idle",
                confianca=0.0,
                raciocinio=f"Erro na análise: {str(e)[:80]}",
                acao_display="Sistema em recuperação. Aguarde.",
                acao_vendedor="Aguarde — sistema em recuperação.",
                urgencia="BAIXA",
                latencia_ms=int((time.time() - inicio) * 1000),
                erro=True,
            )