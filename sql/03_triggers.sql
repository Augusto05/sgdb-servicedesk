-- Triggers
CREATE OR REPLACE FUNCTION trg_fn_chamado_impedir_fechamento_sem_solucao() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_codigo VARCHAR(40);
BEGIN
    SELECT codigo INTO v_codigo FROM status_chamado WHERE id_status = NEW.id_status;
    IF upper(v_codigo) = 'FECHADO' THEN
        IF NEW.solucao IS NULL OR btrim(NEW.solucao) = '' THEN
            RAISE EXCEPTION 'Não é permitido fechar chamado sem solução.';
        END IF;
        IF NEW.data_fechamento IS NULL THEN NEW.data_fechamento := now(); END IF;
    END IF;
    IF TG_OP = 'UPDATE' THEN NEW.atualizado_em := now(); END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_chamado_fechar_regra ON chamado;
CREATE TRIGGER tr_chamado_fechar_regra BEFORE INSERT OR UPDATE OF id_status, solucao ON chamado FOR EACH ROW EXECUTE PROCEDURE trg_fn_chamado_impedir_fechamento_sem_solucao();

CREATE OR REPLACE FUNCTION trg_fn_chamado_preencher_sla() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.data_prazo_sla IS NULL THEN
        NEW.data_prazo_sla := fn_calcular_prazo_sla(NEW.data_abertura, NEW.id_categoria, NEW.id_prioridade);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_chamado_bi_sla ON chamado;
CREATE TRIGGER tr_chamado_bi_sla BEFORE INSERT ON chamado FOR EACH ROW EXECUTE PROCEDURE trg_fn_chamado_preencher_sla();

CREATE OR REPLACE FUNCTION trg_fn_chamado_historico_status() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE old_c VARCHAR(40); new_c VARCHAR(40);
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.id_status IS DISTINCT FROM NEW.id_status THEN
        SELECT codigo INTO old_c FROM status_chamado WHERE id_status = OLD.id_status;
        SELECT codigo INTO new_c FROM status_chamado WHERE id_status = NEW.id_status;
        INSERT INTO chamado_historico (id_chamado, id_autor, mensagem, tipo_evento)
        VALUES (NEW.id_chamado, NULL, format('Status alterado de %s para %s.', old_c, new_c), 'MUDANCA_STATUS');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_chamado_au_status ON chamado;
CREATE TRIGGER tr_chamado_au_status AFTER UPDATE OF id_status ON chamado FOR EACH ROW EXECUTE PROCEDURE trg_fn_chamado_historico_status();
