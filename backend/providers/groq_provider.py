import os
import json
import time
from groq import Groq
from dotenv import load_dotenv
from providers.ia_provider import IAProvider
from models.schemas import EventoSensor, DecisaoIA

load_dotenv()

SYSTEM_PROMPT = """Você é OlhoVivo AI — classificador de comportamento de varejo físico.
Analise sinais corporais e faciais anônimos e retorne SOMENTE JSON válido, sem markdown.

Estados possíveis: idle, engajado, indeciso, decisao, saindo
Urgência possível: BAIXA, MEDIA, ALTA, CRITICA

Emoções possíveis (contexto adicional — não substituem o estado):
- curioso: processando ativamente, alta probabilidade de conversão
- bravo: frustração com preço/produto/atendimento — risco de abandono
- desanimado: perdeu interesse, janela curta antes de sair
- triste: quer mas sente que não pode — argumento de valor pode ajudar
- neutro: sem sinal emocional claro

Sub-estados possíveis (gesto corporal observado):
- avaliando: mão no queixo — deliberando, não interrompa
- em_duvida: coçando a cabeça — incerteza, abordagem informativa ajuda
- estressado: mão no pescoço — sinal de desconforto, abordagem suave
- resistencia: braços cruzados — postura fechada, não force a venda
- nenhum: sem gesto identificado

Use emoção e sub-estado para calibrar o tom e urgência da ação recomendada.
Exemplo: engajado + bravo + resistencia → urgência ALTA, ação de de-escalada.
Exemplo: indeciso + curioso + avaliando → urgência MEDIA, ofereça informação técnica.

Formato obrigatório:
{"estado":"engajado","confianca":0.82,"raciocinio":"1 frase curta.","acao_vendedor":"Instrução objetiva (max 12 palavras).","urgencia":"MEDIA"}"""

_ALIAS = {
    "INDECISO":        "indeciso",
    "QUASE_COMPRANDO": "decisao",
    "PRESTES_A_SAIR":  "saindo",
    "PESQUISANDO":     "engajado",
    "MEDO_DE_ERRAR":   "indeciso",
}

_COOLDOWN = {
    "idle":     999,
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
      - Prompt e input mínimos (~100 tokens input, max_tokens=80 output)
      - Emoção e sub-estado incluídos apenas quando não são neutro/nenhum
      - Fallback com alias para compatibilidade com perfis legados
    """

    def __init__(self):
        self._client         = Groq(api_key=os.getenv("GROQ_API_KEY"))
        self._ultimo_estado: str  = "idle"
        self._ultimo_ts:    float = 0.0

    def analisar(self, evento: EventoSensor) -> DecisaoIA:
        estado_atual = evento.estado_estimado

        if estado_atual == "idle":
            return self._decisao_idle()

        agora        = time.time()
        cooldown     = _COOLDOWN.get(estado_atual, 10)
        mesmo_estado = (estado_atual == self._ultimo_estado)

        # Força nova chamada se emoção ou sub-estado mudou — mesmo no cooldown
        emocao_relevante    = getattr(evento, 'emocao', 'neutro') not in ('neutro', None)
        substado_relevante  = getattr(evento, 'sub_estado', 'nenhum') not in ('nenhum', None)
        contexto_novo       = emocao_relevante or substado_relevante

        if mesmo_estado and not contexto_novo and (agora - self._ultimo_ts) < cooldown:
            return self._decisao_idle()

        self._ultimo_estado = estado_atual
        self._ultimo_ts     = agora

        return self._chamar_groq(evento, estado_atual)

    def _chamar_groq(self, evento: EventoSensor, estado_atual: str) -> DecisaoIA:
        inicio = time.time()

        emocao     = getattr(evento, 'emocao',     'neutro')
        sub_estado = getattr(evento, 'sub_estado', 'nenhum')

        # Monta contexto emocional só quando há sinal — economiza tokens
        contexto_emocional = ""
        if emocao and emocao != 'neutro':
            contexto_emocional += f" emocao={emocao}"
        if sub_estado and sub_estado != 'nenhum':
            contexto_emocional += f" sub_estado={sub_estado}"

        user_msg = (
            f"estado={estado_atual} "
            f"attention={evento.attention_score} "
            f"hesitation={evento.hesitation_score} "
            f"postura={evento.postura} "
            f"movimento={evento.movimento}"
            f"{contexto_emocional}"
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
                    max_tokens=80,
                )
                raw  = response.choices[0].message.content.strip()
                data = json.loads(raw)

                estado_retornado = data.get("estado", estado_atual)
                data["estado"] = _ALIAS.get(estado_retornado.upper(), estado_retornado.lower())

                return DecisaoIA(
                    perfil        = data["estado"],
                    confianca     = float(data.get("confianca", 0.7)),
                    raciocinio    = data.get("raciocinio", ""),
                    acao_display  = data.get("acao_vendedor", ""),
                    acao_vendedor = data.get("acao_vendedor", ""),
                    urgencia      = data.get("urgencia", "MEDIA"),
                    latencia_ms   = int((time.time() - inicio) * 1000),
                    erro          = False,
                )

            except Exception as e:
                if "rate_limit" in str(e).lower() and tentativa < 2:
                    time.sleep(2)
                    continue
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