import os
import json
import time
import asyncio
from groq import Groq
from dotenv import load_dotenv
from typing import Optional
from providers.ia_provider import IAProvider
from models.schemas import EventoSensor, DecisaoIA, AvaliacaoPsicometrica


load_dotenv()

SYSTEM_PROMPT = """Você é OlhoVivo AI — assistente de inteligência comportamental para varejo físico.
Analise os dados e oriente o vendedor com base em psicologia de varejo real.
Retorne SOMENTE JSON válido, sem markdown.

PRINCÍPIOS FUNDAMENTAIS (não viole):
1. Desconto imediato para cliente saindo = treina comportamento negativo, NUNCA recomende
2. Abordagem agressiva com cliente resistente = garante abandono
3. Interromper cliente no momento de decisão = perda de venda
4. "Observe e aguarde" é estratégia válida — às vezes a melhor ação é nenhuma
5. confianca < 0.60 → ação conservadora sempre

LEITURA DOS SCORES PSICOMÉTRICOS:
- intencao > 0.70 → cliente inclinado a comprar, facilite sem pressionar
- intencao < 0.35 → baixo interesse, não force abordagem
- estresse > 0.55 → cliente desconfortável, dê espaço imediatamente
- hesitacao > 0.60 → em dúvida, informação técnica ajuda mais que pressão
- engajamento > 0.70 → boa janela de abordagem natural

ESTRATÉGIA POR ESTADO:
- idle: standby, nenhuma ação
- engajado: observe antes de abordar — interrupção precoce afasta
- indeciso: abordagem informativa suave, ofereça ajuda sem pressionar
- decisao: facilite, remova obstáculos, não interrompa o processo
- saindo + engajamento alto: abordagem discreta e respeitosa é possível
- saindo + engajamento baixo: deixe ir, era curioso, não comprador

EMOÇÕES (contexto adicional):
- curioso: alta probabilidade de conversão, aborde naturalmente
- bravo: frustração ativa, recue e dê espaço
- desanimado: interesse caindo, janela curta para abordagem informativa
- neutro: sem sinal emocional claro

SUB-ESTADOS (gestos):
- avaliando: deliberando, não interrompa
- em_duvida: incerteza, ofereça informação técnica
- estressado: desconforto, abordagem muito suave ou recue
- resistencia: postura fechada, não force a venda

Estados: idle, engajado, indeciso, decisao, saindo
Urgência: BAIXA, MEDIA, ALTA, CRITICA

LED FÍSICO (campo acao_cliente — age sobre o CLIENTE, independente do que o vendedor faz):
acao_vendedor = instrução pro vendedor. acao_cliente = LED no PDV para o cliente. São campos separados.
Vendedor pode "observar" enquanto o LED já comunica sutilmente com o cliente. Nunca use nenhuma_acao para engajado/indeciso/decisao.

Regra direta por estado — siga exatamente:
- idle                → nenhuma_acao
- engajado            → engajar_informar    (sempre — cliente está olhando, LED informa sutilmente)
- indeciso            → converter_decisao   (sempre — cliente hesita, LED oferece incentivo)
- decisao             → engajar_informar    (facilita sem pressionar)
- saindo + engaj alto → recuperar_interesse (LED chama atenção com oferta rápida)
- saindo + engaj baixo→ nenhuma_acao        (cliente não comprador, não force)

Valores válidos para acao_cliente (use apenas estes):
engajar_informar | converter_decisao | recuperar_interesse | nenhuma_acao

Formato obrigatório:
{"estado":"engajado","confianca":0.82,"raciocinio":"1 frase curta.","acao_vendedor":"Instrução objetiva (max 12 palavras).","acao_cliente":"engajar_informar","urgencia":"MEDIA"}"""

_ALIAS = {
    "INDECISO":        "indeciso",
    "QUASE_COMPRANDO": "decisao",
    "PRESTES_A_SAIR":  "saindo",
    "PESQUISANDO":     "engajado",
    "MEDO_DE_ERRAR":   "indeciso",
}

_COOLDOWN = {
    "idle":     999,
    "engajado":  20,
    "indeciso":  12,
    "decisao":    5,
    "saindo":    10,
}

_ACOES_CLIENTE = {
    "nenhuma_acao",        # todos apagados
    "engajar_informar",    # LED 1 — cliente atento, destacar produto
    "converter_decisao",   # LED 2 — cliente indeciso, oferecer incentivo
    "recuperar_interesse", # LED 3 — cliente saindo, chamar atenção
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
        self._client          = Groq(api_key=os.getenv("GROQ_API_KEY"))
        self._ultimo_estado:  str       = "idle"
        self._ultimo_ts:      float     = 0.0
        self._ultima_decisao: DecisaoIA = None

    async def analisar(
        self,
        evento: EventoSensor,
        psico: Optional[AvaliacaoPsicometrica] = None,
    ) -> DecisaoIA:
        estado_atual = evento.estado_estimado

        if estado_atual == "idle":
            self._ultima_decisao = None
            return self._decisao_idle()

        agora        = time.time()
        cooldown     = _COOLDOWN.get(estado_atual, 10)
        mesmo_estado = (estado_atual == self._ultimo_estado)

        # Força nova chamada se emoção ou sub-estado mudou — mesmo no cooldown
        emocao_relevante    = getattr(evento, 'emocao', 'neutro') not in ('neutro', None)
        substado_relevante  = getattr(evento, 'sub_estado', 'nenhum') not in ('nenhum', None)
        contexto_novo       = emocao_relevante or substado_relevante

        if mesmo_estado and not contexto_novo and (agora - self._ultimo_ts) < cooldown:
            return self._ultima_decisao or self._decisao_idle()

        self._ultimo_estado  = estado_atual
        self._ultimo_ts      = agora
        self._ultima_decisao = await self._chamar_groq(evento, estado_atual, psico)
        return self._ultima_decisao

    async def _chamar_groq(
        self,
        evento: EventoSensor,
        estado_atual: str,
        psico: Optional[AvaliacaoPsicometrica] = None,
    ) -> DecisaoIA:
        inicio = time.time()

        emocao     = getattr(evento, 'emocao',     'neutro')
        sub_estado = getattr(evento, 'sub_estado', 'nenhum')

        # Scores psicométricos — contexto científico para o Groq decidir melhor
        contexto_psico = ""
        if psico:
            contexto_psico = (
                f" engajamento={psico.engajamento:.2f}"
                f" hesitacao={psico.hesitacao:.2f}"
                f" intencao={psico.intencao_compra:.2f}"
                f" estresse={psico.estresse:.2f}"
                f" confianca={psico.confianca:.2f}"
            )

        # Contexto emocional e gestual só quando há sinal — economiza tokens
        contexto_emocional = ""
        if emocao and emocao != 'neutro':
            contexto_emocional += f" emocao={emocao}"
        if sub_estado and sub_estado != 'nenhum':
            contexto_emocional += f" sub_estado={sub_estado}"

        user_msg = (
            f"estado={estado_atual}"
            f" postura={evento.postura}"
            f"{contexto_psico}"
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
                    max_tokens=150,
                )
                raw  = response.choices[0].message.content.strip()
                print(f"[GROQ RAW] {raw}")
                data = json.loads(raw)

                estado_retornado = data.get("estado", estado_atual)
                data["estado"] = _ALIAS.get(estado_retornado.upper(), estado_retornado.lower())

                acao_cliente_raw = data.get("acao_cliente", "nenhuma_acao")
                acao_cliente     = acao_cliente_raw if acao_cliente_raw in _ACOES_CLIENTE else "nenhuma_acao"
                print(f"[GROQ] acao_cliente_raw={acao_cliente_raw!r} → validado={acao_cliente!r}")

                return DecisaoIA(
                    perfil        = data["estado"],
                    confianca     = float(data.get("confianca", 0.7)),
                    raciocinio    = data.get("raciocinio", ""),
                    acao_display  = data.get("acao_vendedor", ""),
                    acao_vendedor = data.get("acao_vendedor", ""),
                    acao_cliente  = acao_cliente,
                    urgencia      = data.get("urgencia", "MEDIA"),
                    latencia_ms   = int((time.time() - inicio) * 1000),
                    erro          = False,
                )

            except Exception as e:
                if "rate_limit" in str(e).lower() and tentativa < 2:
                    await asyncio.sleep(2)
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
            "engajado": "Observe — aguarde momento natural para abordar.",
            "indeciso": "Ofereça informação técnica com tom suave.",
            "decisao":  "Facilite — remova obstáculos sem interromper.",
            "saindo":   "Observe — se engajou bem, abordagem discreta possível.",
        }
        return acoes.get(estado, "Monitore o cliente.")