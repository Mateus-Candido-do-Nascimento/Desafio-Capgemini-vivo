import os
import json
import time
from groq import Groq
from dotenv import load_dotenv

from providers.ia_provider import IAProvider
from models.schemas import EventoSensor, DecisaoIA

load_dotenv()

SYSTEM_PROMPT = """Você é o OlhoVivo AI — um agente de varejo físico que analisa comportamento
de clientes em tempo real com base em dados anônimos de sensores (ESP32 + MediaPipe).

Regras:
- Nunca mencione dados pessoais, rosto ou identidade
- Classifique o perfil em: INDECISO, QUASE_COMPRANDO, PRESTES_A_SAIR, PESQUISANDO, MEDO_DE_ERRAR
- Retorne SOMENTE JSON válido, sem markdown, sem texto fora do JSON

Formato obrigatório:
{
  "perfil": "INDECISO",
  "confianca": 0.82,
  "raciocinio": "Explicação do comportamento (max 2 frases)",
  "acao_display": "Mensagem para o display da loja (max 15 palavras)",
  "acao_vendedor": "Instrução para o vendedor (max 15 palavras)",
  "urgencia": "ALTA"
}

urgencia pode ser: BAIXA, MEDIA, ALTA, CRITICA"""


class GroqProvider(IAProvider):
    """
    Implementação de IAProvider usando Groq API + Llama 3.3 70B.
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
                temperature=0.3,
                max_tokens=300,
            )

            raw = response.choices[0].message.content.strip()
            data = json.loads(raw)
            data["latencia_ms"] = int((time.time() - inicio) * 1000)
            data["erro"] = False
            return DecisaoIA(**data)

        except Exception as e:
            return DecisaoIA(
                perfil="INDECISO",
                confianca=0.5,
                raciocinio=f"Erro na análise: {str(e)[:80]}",
                acao_display="Atendimento disponível. Fale com nosso vendedor.",
                acao_vendedor="Aborde o cliente com uma saudação amigável.",
                urgencia="MEDIA",
                latencia_ms=int((time.time() - inicio) * 1000),
                erro=True,
            )