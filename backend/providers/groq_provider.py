import os
import json
import time
from groq import Groq
from dotenv import load_dotenv
from providers.ia_provider import IAProvider
from models.schemas import EventoSensor, DecisaoIA

load_dotenv()

# Prompt enxuto — contexto estático mínimo, sem repetir definições a cada chamada
SYSTEM_PROMPT = """Você é OlhoVivo AI — classificador de comportamento de varejo físico.
Analise sinais corporais anônimos e retorne SOMENTE JSON válido, sem markdown.

Estados possíveis: idle, engajado, indeciso, decisao, saindo
Urgência possível: BAIXA, MEDIA, ALTA, CRITICA

Formato obrigatório:
{"estado":"engajado","confianca":0.82,"raciocinio":"1 frase curta.","acao_vendedor":"Instrução objetiva (max 12 palavras).","urgencia":"MEDIA"}"""

# Mapeamento de fallback: se a IA retornar perfil antigo, converte para estado novo
_ALIAS = {
    "INDECISO":        "indeciso",
    "QUASE_COMPRANDO": "decisao",
    "PRESTES_A_SAIR":  "saindo",
    "PESQUISANDO":     "engajado",
    "MEDO_DE_ERRAR":   "indeciso",
}

# Cooldown em segundos por estado — estados urgentes chamam mais vezes
_COOLDOWN = {
    "idle":     999,   # nunca chama Groq pra idle
    "engajado":  15,
    "indeciso":  10,
    "decisao":    3,
    "saindo":     2,
}

class GroqProvider(IAProvider):
    """
    IAProvider usando Groq API + Llama 3.3 70B.
    Otimizações:
      - Não chama a API para estado idle
      - Cooldown por estado (estados urgentes chamam com mais frequência)
      - Prompt e input mínimos (~80 tokens input, max_tokens=80 output)
      - Fallback com alias para compatibilidade com perfis legados
    """

    def __init__(self):
        self._client    = Groq(api_key=os.getenv("GROQ_API_KEY"))
        self._ultimo_estado: str   = "idle"
        self._ultimo_ts:    float  = 0.0

    def analisar(self, evento: EventoSensor) -> DecisaoIA:
        estado_atual = evento.estado_estimado

        # Nunca chama Groq para idle — retorna decisão padrão diretamente
        if estado_atual == "idle":
            return self._decisao_idle()

        # Cooldown: só chama se passou tempo suficiente desde a última chamada
        agora    = time.time()
        cooldown = _COOLDOWN.get(estado_atual, 10)
        mesmo_estado = (estado_atual == self._ultimo_estado)

        if mesmo_estado and (agora - self._ultimo_ts) < cooldown:
            return self._decisao_idle()  # silencia — sem mudança relevante

        # Atualiza controle
        self._ultimo_estado = estado_atual
        self._ultimo_ts     = agora

        return self._chamar_groq(evento, estado_atual)

    # ------------------------------------------------------------------
    # Chamada real à API
    # ------------------------------------------------------------------
    def _chamar_groq(self, evento: EventoSensor, estado_atual: str) -> DecisaoIA:
        inicio = time.time()

        # Input mínimo — só as métricas que a IA realmente precisa
        user_msg = (
            f"estado={estado_atual} "
            f"attention={evento.attention_score} "
            f"hesitation={evento.hesitation_score} "
            f"postura={evento.postura} "
            f"movimento={evento.movimento}"
        )

        for tentativa in range(3):
            try:
                response = self._client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user",   "content": user_msg},
                    ],
                    temperature=0.2,
                    max_tokens=80,   # resposta JSON pequena — 80 é mais que suficiente
                )
                raw  = response.choices[0].message.content.strip()
                data = json.loads(raw)

                # Normaliza estado caso a IA retorne perfil legado
                estado_retornado = data.get("estado", estado_atual)
                data["estado"] = _ALIAS.get(estado_retornado.upper(), estado_retornado.lower())

                # Mapeia para campos do schema DecisaoIA
                return DecisaoIA(
                    perfil        = data["estado"],
                    confianca     = float(data.get("confianca", 0.7)),
                    raciocinio    = data.get("raciocinio", ""),
                    acao_display  = data.get("acao_vendedor", ""),  # reutiliza no display
                    acao_vendedor = data.get("acao_vendedor", ""),
                    urgencia      = data.get("urgencia", "MEDIA"),
                    latencia_ms   = int((time.time() - inicio) * 1000),
                    erro          = False,
                )

            except Exception as e:
                if "rate_limit" in str(e).lower() and tentativa < 2:
                    time.sleep(2)
                    continue
                # Fallback sem broadcast de erro — retorna estado inferido localmente
                return DecisaoIA(
                    perfil        = estado_atual,
                    confianca     = 0.5,
                    raciocinio    = "Inferência local — API em pausa.",
                    acao_display  = self._acao_fallback(estado_atual),
                    acao_vendedor = self._acao_fallback(estado_atual),
                    urgencia      = "BAIXA",
                    latencia_ms   = int((time.time() - inicio) * 1000),
                    erro          = True,
                )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _decisao_idle(self) -> DecisaoIA:
        return DecisaoIA(
            perfil        = "idle",
            confianca     = 1.0,
            raciocinio    = "Nenhuma presença ativa detectada.",
            acao_display  = "Sistema em standby.",
            acao_vendedor = "Nenhuma ação necessária.",
            urgencia      = "BAIXA",
            latencia_ms   = 0,
            erro          = False,
        )

    def _acao_fallback(self, estado: str) -> str:
        acoes = {
            "engajado": "Cliente interessado — observe sem interromper.",
            "indeciso": "Aproxime-se e ofereça informação técnica.",
            "decisao":  "Facilite a compra agora.",
            "saindo":   "Aborde com oferta relâmpago imediatamente.",
        }
        return acoes.get(estado, "Monitore o cliente.")