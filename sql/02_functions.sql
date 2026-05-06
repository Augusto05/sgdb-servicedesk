-- Funções (stored procedures)
CREATE OR REPLACE FUNCTION fn_calcular_prazo_sla(
    p_data_abertura TIMESTAMPTZ,
    p_id_categoria INTEGER,
    p_id_prioridade INTEGER
) RETURNS TIMESTAMPTZ
LANGUAGE sql STABLE AS $$
    SELECT p_data_abertura + make_interval(hours => GREATEST(1, ceil(cc.sla_horas_padrao::NUMERIC * pr.fator_sla)::integer))
    FROM categoria_chamado cc CROSS JOIN prioridade pr
    WHERE cc.id_categoria = p_id_categoria AND pr.id_prioridade = p_id_prioridade;
$$;

/**
 * Cria um novo chamado no sistema.
 * Nota: O SLA não é calculado na abertura, pois o chamado entra no status 'Aguardando'.
 * O cálculo ocorrerá apenas na atribuição do técnico.
 */
CREATE OR REPLACE FUNCTION sp_abrir_chamado(
    p_id_solicitante INTEGER,
    p_id_categoria INTEGER,
    p_id_prioridade INTEGER,
    p_id_status_inicial INTEGER,
    p_titulo VARCHAR(200),
    p_descricao TEXT,
    p_id_hardware_rel INTEGER DEFAULT NULL,
    p_id_software_rel INTEGER DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_id INTEGER;
BEGIN
    INSERT INTO chamado (
        id_solicitante, id_categoria, id_prioridade, id_status, id_hardware_rel, id_software_rel, titulo, descricao, data_prazo_sla, criado_por
    ) VALUES (
        p_id_solicitante, p_id_categoria, p_id_prioridade, p_id_status_inicial, p_id_hardware_rel, p_id_software_rel, p_titulo, p_descricao, NULL, p_id_solicitante
    ) RETURNING id_chamado INTO v_id;

    INSERT INTO chamado_historico (id_chamado, id_autor, mensagem, tipo_evento)
    VALUES (v_id, p_id_solicitante, 'Chamado aberto.', 'ABERTURA');
    RETURN v_id;
END;
$$;

/**
 * Atribui um técnico a um chamado e inicia a contagem do SLA em tempo real.
 * Muda o status para 'EM_ATENDIMENTO' e calcula o prazo (agora() + horas_da_categoria * fator_prioridade).
 */
CREATE OR REPLACE FUNCTION sp_atribuir_tecnico(
    p_id_chamado INTEGER,
    p_id_tecnico INTEGER,
    p_id_operador INTEGER
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    st INTEGER;
    t_nome VARCHAR(120);
    v_cat INTEGER;
    v_prio INTEGER;
    v_prazo TIMESTAMPTZ;
BEGIN
    SELECT id_status INTO st FROM status_chamado WHERE codigo = 'EM_ATENDIMENTO' LIMIT 1;
    SELECT u.nome_usuario INTO t_nome FROM tecnico t JOIN usuario u ON u.id_usuario = t.id_usuario WHERE t.id_tecnico = p_id_tecnico;
    
    -- Obter dados para cálculo do SLA
    SELECT id_categoria, id_prioridade INTO v_cat, v_prio FROM chamado WHERE id_chamado = p_id_chamado;
    v_prazo := fn_calcular_prazo_sla(now(), v_cat, v_prio);

    UPDATE chamado 
    SET id_tecnico = p_id_tecnico, 
        id_status = st, 
        data_prazo_sla = v_prazo,
        atualizado_em = now() 
    WHERE id_chamado = p_id_chamado;
    
    IF NOT FOUND THEN RAISE EXCEPTION 'Chamado não encontrado'; END IF;

    INSERT INTO chamado_historico (id_chamado, id_autor, mensagem, tipo_evento)
    VALUES (p_id_chamado, p_id_operador, format('O técnico %s assumiu este chamado e está trabalhando para resolvê-lo.', t_nome), 'ATRIBUICAO');
END;
$$;

CREATE OR REPLACE FUNCTION sp_registrar_resolucao(
    p_id_chamado INTEGER, p_solucao TEXT, p_id_status_resolvido INTEGER, p_id_operador INTEGER
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF p_solucao IS NULL OR btrim(p_solucao) = '' THEN RAISE EXCEPTION 'Solução obrigatória.'; END IF;
    UPDATE chamado SET solucao = p_solucao, id_status = p_id_status_resolvido, data_resolucao = now(), atualizado_em = now()
    WHERE id_chamado = p_id_chamado;
    IF NOT FOUND THEN RAISE EXCEPTION 'Chamado não encontrado'; END IF;
    INSERT INTO chamado_historico (id_chamado, id_autor, mensagem, tipo_evento)
    VALUES (p_id_chamado, p_id_operador, left(p_solucao, 2000), 'RESOLUCAO');
END;
$$;

CREATE OR REPLACE FUNCTION sp_fechar_chamado(
    p_id_chamado INTEGER, p_id_status_fechado INTEGER, p_id_operador INTEGER
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE r chamado%ROWTYPE;
BEGIN
    SELECT * INTO r FROM chamado WHERE id_chamado = p_id_chamado FOR UPDATE;
    IF r.solucao IS NULL OR btrim(r.solucao) = '' THEN RAISE EXCEPTION 'Requer solução.'; END IF;
    UPDATE chamado SET id_status = p_id_status_fechado, data_fechamento = now(), atualizado_em = now() WHERE id_chamado = p_id_chamado;
    INSERT INTO chamado_historico (id_chamado, id_autor, mensagem, tipo_evento)
    VALUES (p_id_chamado, p_id_operador, 'Chamado fechado.', 'FECHAMENTO');
END;
$$;
