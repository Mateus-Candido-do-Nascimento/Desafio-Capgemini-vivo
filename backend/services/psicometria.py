# ═══════════════════════════════════════════════════════════
# PSICOMETRIA — Escalas comportamentais baseadas em literatura
# Referências: Ekman (FACS), Navarro (body language), 
#              Pease (body language), Russell (circumplex model)
# Responsabilidade: calcular traços latentes de forma 
#                   determinística, sem LLM
# ═══════════════════════════════════════════════════════════
from models.schemas import EventoSensor, AvaliacaoPsicometrica



   

def _clamp(v: float) -> float:
    return max(0.0, min(1.0, v))


def _normalizar_tempo(tempo_parado: int) -> float:
    """Normaliza tempo parado em segundos para 0-1.
    0s = 0.0 | 30s = 0.5 | 120s+ = 1.0
    Baseado em estudos de dwell time em varejo (Sorensen, 2009)
    """
    return _clamp(tempo_parado / 120.0)


def calcular_engajamento(evento: EventoSensor) -> float:
    """
    Escala de Engajamento — baseada em Navarro (2008) e 
    pesquisa de comportamento em varejo (Sorensen, 2009).
    
    Itens:
    - attention_score:  0.40 — atenção direta ao produto
    - tempo_parado:     0.35 — dwell time (tempo no ponto de venda)
    - presenca:         0.25 — baseline de presença
    """
    tempo_norm = _normalizar_tempo(evento.tempo_parado)

    score = (
        evento.attention_score * 0.40 +
        tempo_norm             * 0.35 +
        (1.0 if evento.presenca else 0.0) * 0.25
    )
    return _clamp(score)


def calcular_hesitacao(evento: EventoSensor) -> float:
    """
    Escala de Hesitação — baseada em Ekman (FACS AU1+AU4+AU15)
    e Navarro (pacifying behaviors).
    
    Itens:
    - hesitation_score: 0.50 — hesitação estimada pelo sensor
    - movimento baixo + presença longa: 0.30 — parado sem decidir
    - sub_estado avaliando/em_duvida:   0.20 — gestos de dúvida
    """
    sub_estados_duvida = {'avaliando', 'em_duvida', 'estressado'}
    sub_bonus = 0.20 if evento.sub_estado in sub_estados_duvida else 0.0

    # Movimento baixo + muito tempo parado = indecisão
    tempo_norm = _normalizar_tempo(evento.tempo_parado)
    movimento_baixo = 1.0 if evento.movimento == 'baixo' else 0.3
    paralisia = tempo_norm * movimento_baixo * 0.30

    score = (
        evento.hesitation_score * 0.50 +
        paralisia               +
        sub_bonus
    )
    return _clamp(score)


def calcular_intencao_compra(evento: EventoSensor,
                              engajamento: float,
                              hesitacao: float) -> float:
    """
    Escala de Intenção de Compra — baseada no modelo TAM 
    (Technology Acceptance Model adaptado pra varejo físico)
    e Pease (2004) sobre linguagem corporal de decisão.
    
    Itens:
    - engajamento:           0.40
    - (1 - hesitacao):       0.35 — ausência de hesitação
    - postura de ação:       0.25 — alcançando produto
    """
    posturas_acao = {'alcancando_produto', 'lendo_etiqueta'}
    postura_bonus = 0.25 if evento.postura in posturas_acao else 0.0

    score = (
        engajamento       * 0.40 +
        (1 - hesitacao)   * 0.35 +
        postura_bonus
    )
    return _clamp(score)


def calcular_estresse(evento: EventoSensor) -> float:
    """
    Escala de Estresse/Desconforto — baseada em Ekman (FACS AU4+AU5+AU23)
    e Navarro (neck touching, crossed arms).
    
    Itens:
    - emocao bravo/desanimado: 0.50
    - sub_estado estressado/resistencia: 0.30
    - hesitacao alta + tempo longo: 0.20
    """
    emocoes_estresse = {'bravo', 'desanimado', 'triste'}
    emocao_bonus = 0.50 if evento.emocao in emocoes_estresse else 0.0

    sub_estresse = {'estressado', 'resistencia'}
    sub_bonus = 0.30 if evento.sub_estado in sub_estresse else 0.0

    tempo_norm = _normalizar_tempo(evento.tempo_parado)
    tensao = evento.hesitation_score * tempo_norm * 0.20

    score = emocao_bonus + sub_bonus + tensao
    return _clamp(score)


def classificar_perfil(engajamento: float, hesitacao: float,
                        intencao: float, estresse: float,
                        presenca: bool) -> tuple[str, float]:
    """
    Classifica o perfil comportamental e retorna (perfil, confiança).
    Ordem de prioridade das regras importa.
    """
    if not presenca:
        return 'idle', 1.0

    if intencao > 0.70 and hesitacao < 0.35:
        confianca = _clamp((intencao - hesitacao))
        return 'comprador_iminente', confianca

    if estresse > 0.55:
        confianca = _clamp(estresse)
        return 'resistente', confianca

    if engajamento > 0.55 and hesitacao < 0.45:
        confianca = _clamp(engajamento - hesitacao * 0.5)
        return 'engajado_ativo', confianca

    if hesitacao > 0.55:
        confianca = _clamp(hesitacao)
        return 'hesitante', confianca

    return 'observando', _clamp(engajamento)


def _gerar_raciocinio(perfil: str, engajamento: float,
                       hesitacao: float, intencao: float,
                       estresse: float, evento: EventoSensor) -> str:
    """Gera explicação textual dos scores pra enriquecer o prompt do Groq."""
    return (
        f"Avaliação psicométrica: engajamento={engajamento:.2f}, "
        f"hesitação={hesitacao:.2f}, intenção de compra={intencao:.2f}, "
        f"estresse={estresse:.2f}. "
        f"Cliente presente há {evento.tempo_parado}s, "
        f"emoção={evento.emocao}, sub_estado={evento.sub_estado}."
    )


def avaliar(evento: EventoSensor) -> AvaliacaoPsicometrica:
    """
    Ponto de entrada principal.
    Recebe um EventoSensor e retorna a avaliação psicométrica completa.
    """
    engajamento = calcular_engajamento(evento)
    hesitacao   = calcular_hesitacao(evento)
    intencao    = calcular_intencao_compra(evento, engajamento, hesitacao)
    estresse    = calcular_estresse(evento)

    perfil, confianca = classificar_perfil(
        engajamento, hesitacao, intencao, estresse, evento.presenca
    )

    raciocinio = _gerar_raciocinio(
        perfil, engajamento, hesitacao, intencao, estresse, evento
    )

    return AvaliacaoPsicometrica(
        engajamento      = round(engajamento, 3),
        hesitacao        = round(hesitacao,   3),
        intencao_compra  = round(intencao,    3),
        estresse         = round(estresse,    3),
        perfil_psico     = perfil,
        emocao_detectada = evento.emocao or 'neutro',
        confianca        = round(confianca,   3),
        raciocinio_psico = raciocinio,
    )
