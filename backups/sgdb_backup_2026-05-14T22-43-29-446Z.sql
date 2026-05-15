-- SGDB Raw SQL Dump
-- Gerado em: 2026-05-14T22:43:29.448Z

-- ==========================================
-- ESTRUTURA DO BANCO (DDL) E REGRAS (SGBD)
-- ==========================================

-- Arquivo: 01_schema.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE empresa (
    id_empresa SERIAL PRIMARY KEY,
    nome_fantasia VARCHAR(120) NOT NULL UNIQUE,
    cnpj VARCHAR(18) UNIQUE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE perfil (
    id_perfil SERIAL PRIMARY KEY,
    codigo VARCHAR(40) NOT NULL UNIQUE,
    descricao VARCHAR(200) NOT NULL
);

CREATE TABLE usuario (
    id_usuario SERIAL PRIMARY KEY,
    nome_usuario VARCHAR(120) NOT NULL,
    cargo VARCHAR(120),
    data_ingresso DATE NOT NULL DEFAULT CURRENT_DATE,
    id_empresa INTEGER NOT NULL REFERENCES empresa (id_empresa),
    email VARCHAR(180) NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_email_format CHECK (email ~* '^[^@]+@[^@]+\.[^@]+$')
);

CREATE TABLE usuario_perfil (
    id_usuario INTEGER NOT NULL REFERENCES usuario (id_usuario) ON DELETE CASCADE,
    id_perfil INTEGER NOT NULL REFERENCES perfil (id_perfil) ON DELETE RESTRICT,
    PRIMARY KEY (id_usuario, id_perfil)
);

CREATE TABLE tecnico (
    id_tecnico SERIAL PRIMARY KEY,
    id_usuario INTEGER NOT NULL UNIQUE REFERENCES usuario (id_usuario) ON DELETE CASCADE,
    especialidade VARCHAR(200),
    matricula VARCHAR(40) UNIQUE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE tecnico_empresa (
    id_tecnico INTEGER NOT NULL REFERENCES tecnico (id_tecnico) ON DELETE CASCADE,
    id_empresa INTEGER NOT NULL REFERENCES empresa (id_empresa) ON DELETE CASCADE,
    PRIMARY KEY (id_tecnico, id_empresa)
);

CREATE TABLE fabricante (
    id_fabricante SERIAL PRIMARY KEY,
    nome VARCHAR(120) NOT NULL UNIQUE
);

CREATE TABLE tipo_hardware (
    id_tipo_hardware SERIAL PRIMARY KEY,
    nome VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE hardware (
    id_hardware SERIAL PRIMARY KEY,
    id_tipo_hardware INTEGER NOT NULL REFERENCES tipo_hardware (id_tipo_hardware),
    id_fabricante INTEGER NOT NULL REFERENCES fabricante (id_fabricante),
    id_empresa INTEGER NOT NULL REFERENCES empresa (id_empresa),
    modelo VARCHAR(120) NOT NULL,
    numero_serie VARCHAR(120) UNIQUE,
    patrimonio_tag VARCHAR(80) UNIQUE,
    data_aquisicao DATE,
    valor_aquisicao NUMERIC(14, 2),
    status_patrimonio VARCHAR(40) NOT NULL DEFAULT 'DISPONIVEL'
        CHECK (status_patrimonio IN ('DISPONIVEL','MANUTENCAO','BAIXADO')),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE software (
    id_software SERIAL PRIMARY KEY,
    id_fabricante INTEGER NOT NULL REFERENCES fabricante (id_fabricante),
    id_empresa INTEGER NOT NULL REFERENCES empresa (id_empresa),
    nome VARCHAR(120) NOT NULL,
    versao VARCHAR(80),
    chave_licenca VARCHAR(200),
    data_expiracao DATE,
    status_software VARCHAR(40) NOT NULL DEFAULT 'ATIVO' CHECK (status_software IN ('ATIVO','EXPIRADO','CANCELADO')),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE categoria_chamado (
    id_categoria SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    sla_horas_padrao INTEGER NOT NULL DEFAULT 24 CHECK (sla_horas_padrao > 0)
);

CREATE TABLE prioridade (
    id_prioridade SERIAL PRIMARY KEY,
    nome VARCHAR(40) NOT NULL UNIQUE,
    peso INTEGER NOT NULL DEFAULT 1 CHECK (peso BETWEEN 1 AND 5),
    fator_sla NUMERIC(4,2) NOT NULL DEFAULT 1.00 CHECK (fator_sla > 0)
);

CREATE TABLE status_chamado (
    id_status SERIAL PRIMARY KEY,
    codigo VARCHAR(40) NOT NULL UNIQUE,
    descricao VARCHAR(120) NOT NULL
);

CREATE TABLE chamado (
    id_chamado SERIAL PRIMARY KEY,
    id_solicitante INTEGER NOT NULL REFERENCES usuario (id_usuario),
    id_categoria INTEGER NOT NULL REFERENCES categoria_chamado (id_categoria),
    id_prioridade INTEGER NOT NULL REFERENCES prioridade (id_prioridade),
    id_status INTEGER NOT NULL REFERENCES status_chamado (id_status),
    id_tecnico INTEGER REFERENCES tecnico (id_tecnico),
    id_hardware_rel INTEGER REFERENCES hardware (id_hardware),
    id_software_rel INTEGER REFERENCES software (id_software),
    titulo VARCHAR(200) NOT NULL,
    descricao TEXT NOT NULL,
    solucao TEXT,
    data_abertura TIMESTAMPTZ NOT NULL DEFAULT now(),
    data_prazo_sla TIMESTAMPTZ,
    data_primeira_resposta TIMESTAMPTZ,
    data_resolucao TIMESTAMPTZ,
    data_fechamento TIMESTAMPTZ,
    criado_por INTEGER REFERENCES usuario (id_usuario),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE chamado_historico (
    id_historico BIGSERIAL PRIMARY KEY,
    id_chamado INTEGER NOT NULL REFERENCES chamado (id_chamado) ON DELETE CASCADE,
    id_autor INTEGER REFERENCES usuario (id_usuario),
    mensagem TEXT NOT NULL,
    tipo_evento VARCHAR(40) NOT NULL DEFAULT 'COMENTARIO',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE manutencao (
    id_manutencao SERIAL PRIMARY KEY,
    id_hardware INTEGER NOT NULL REFERENCES hardware (id_hardware),
    id_tecnico INTEGER REFERENCES tecnico (id_tecnico),
    tipo VARCHAR(40) NOT NULL CHECK (tipo IN ('PREVENTIVA','CORRETIVA','UPGRADE')),
    descricao TEXT NOT NULL,
    custo NUMERIC(12, 2),
    data_execucao DATE NOT NULL DEFAULT CURRENT_DATE,
    id_chamado INTEGER REFERENCES chamado (id_chamado)
);

CREATE INDEX ix_chamado_solicitante ON chamado (id_solicitante);
CREATE INDEX ix_chamado_status ON chamado (id_status);
CREATE INDEX ix_chamado_tecnico ON chamado (id_tecnico);
CREATE INDEX ix_chamado_abertura ON chamado (data_abertura);
CREATE INDEX ix_tecnico_empresa_empresa ON tecnico_empresa (id_empresa);


-- Arquivo: 02_functions.sql
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


-- Arquivo: 03_triggers.sql
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


-- Arquivo: 04_security.sql
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sgdb_app') THEN
        CREATE ROLE sgdb_app LOGIN PASSWORD 'troque_esta_senha_em_producao';
    END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO sgdb_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sgdb_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sgdb_app;

GRANT EXECUTE ON FUNCTION fn_calcular_prazo_sla(TIMESTAMPTZ, INTEGER, INTEGER) TO sgdb_app;
GRANT EXECUTE ON FUNCTION sp_abrir_chamado(INTEGER, INTEGER, INTEGER, INTEGER, VARCHAR, TEXT, INTEGER, INTEGER) TO sgdb_app;
GRANT EXECUTE ON FUNCTION sp_atribuir_tecnico(INTEGER, INTEGER, INTEGER) TO sgdb_app;
GRANT EXECUTE ON FUNCTION sp_registrar_resolucao(INTEGER, TEXT, INTEGER, INTEGER) TO sgdb_app;
GRANT EXECUTE ON FUNCTION sp_fechar_chamado(INTEGER, INTEGER, INTEGER) TO sgdb_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sgdb_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO sgdb_app;


-- Arquivo: 06_unified_inventory.sql
-- 1. Create unified inventory table
CREATE TABLE inventario (
    id_inventario SERIAL PRIMARY KEY,
    tipo_item VARCHAR(20) NOT NULL CHECK (tipo_item IN ('HARDWARE', 'SOFTWARE')),
    id_empresa INTEGER NOT NULL REFERENCES empresa (id_empresa) ON DELETE CASCADE,
    id_fabricante INTEGER NOT NULL REFERENCES fabricante (id_fabricante),
    nome_modelo VARCHAR(120) NOT NULL,
    id_tipo_hardware INTEGER REFERENCES tipo_hardware (id_tipo_hardware),
    numero_serie VARCHAR(120) UNIQUE,
    patrimonio_tag VARCHAR(80) UNIQUE,
    data_aquisicao DATE,
    valor_aquisicao NUMERIC(14, 2),
    versao VARCHAR(80),
    chave_licenca VARCHAR(200),
    data_expiracao DATE,
    status VARCHAR(40) NOT NULL DEFAULT 'ATIVO',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migrate data from hardware to inventario
INSERT INTO inventario (tipo_item, id_empresa, id_fabricante, nome_modelo, id_tipo_hardware, numero_serie, patrimonio_tag, data_aquisicao, valor_aquisicao, status, criado_em)
SELECT 'HARDWARE', id_empresa, id_fabricante, modelo, id_tipo_hardware, numero_serie, patrimonio_tag, data_aquisicao, valor_aquisicao, status_patrimonio, criado_em
FROM hardware;

-- Migrate data from software to inventario
INSERT INTO inventario (tipo_item, id_empresa, id_fabricante, nome_modelo, versao, chave_licenca, data_expiracao, status, criado_em)
SELECT 'SOFTWARE', id_empresa, id_fabricante, nome, versao, chave_licenca, data_expiracao, status_software, criado_em
FROM software;

-- 2. Update chamado table to point to new inventory table
ALTER TABLE chamado ADD COLUMN id_inventario_rel INTEGER REFERENCES inventario (id_inventario);

-- Try to map old relationships to the new table (this is a simplified migration, might fail if data is complex, but works for dev)
-- For hardware
UPDATE chamado c
SET id_inventario_rel = i.id_inventario
FROM hardware h
JOIN inventario i ON i.patrimonio_tag = h.patrimonio_tag AND i.tipo_item = 'HARDWARE'
WHERE c.id_hardware_rel = h.id_hardware;

-- For software
UPDATE chamado c
SET id_inventario_rel = i.id_inventario
FROM software s
JOIN inventario i ON i.nome_modelo = s.nome AND i.chave_licenca IS NOT DISTINCT FROM s.chave_licenca AND i.tipo_item = 'SOFTWARE'
WHERE c.id_software_rel = s.id_software;

-- Drop old columns
ALTER TABLE chamado DROP COLUMN id_hardware_rel;
ALTER TABLE chamado DROP COLUMN id_software_rel;

-- Drop old tables (optional but keeps schema clean)
-- We need to drop dependent tables first like manutencao
ALTER TABLE manutencao ADD COLUMN id_inventario INTEGER REFERENCES inventario (id_inventario);

UPDATE manutencao m
SET id_inventario = i.id_inventario
FROM hardware h
JOIN inventario i ON i.patrimonio_tag = h.patrimonio_tag AND i.tipo_item = 'HARDWARE'
WHERE m.id_hardware = h.id_hardware;

ALTER TABLE manutencao DROP COLUMN id_hardware;
ALTER TABLE manutencao ALTER COLUMN id_inventario SET NOT NULL;

DROP TABLE hardware;
DROP TABLE software;

-- 3. Create SLA Request Table
CREATE TABLE solicitacao_sla (
    id_solicitacao SERIAL PRIMARY KEY,
    id_chamado INTEGER NOT NULL REFERENCES chamado (id_chamado) ON DELETE CASCADE,
    id_tecnico INTEGER NOT NULL REFERENCES tecnico (id_tecnico) ON DELETE CASCADE,
    nova_data_prazo TIMESTAMPTZ NOT NULL,
    motivo TEXT NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'APROVADA', 'REJEITADA')),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    avaliado_por INTEGER REFERENCES usuario (id_usuario),
    avaliado_em TIMESTAMPTZ
);

-- 4. Create User Details Table
CREATE TABLE usuario_detalhes (
    id_detalhe SERIAL PRIMARY KEY,
    id_usuario INTEGER NOT NULL UNIQUE REFERENCES usuario (id_usuario) ON DELETE CASCADE,
    foto_url TEXT,
    data_nascimento DATE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed some user details for testing
INSERT INTO usuario_detalhes (id_usuario, foto_url, data_nascimento)
SELECT id_usuario, 'https://i.pravatar.cc/150?u=' || id_usuario, '1990-01-01'::DATE
FROM usuario;


-- Arquivo: 07_db_management.sql
-- 07_db_management.sql

CREATE TABLE sistema_log (
    id_log SERIAL PRIMARY KEY,
    nivel VARCHAR(20) NOT NULL CHECK (nivel IN ('INFO', 'WARN', 'ERROR', 'CRITICAL')),
    modulo VARCHAR(50) NOT NULL, -- ex: 'BACKUP', 'AUTH', 'SYSTEM', 'DATABASE'
    mensagem TEXT NOT NULL,
    detalhes JSONB,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for faster querying of recent logs
CREATE INDEX idx_sistema_log_criado_em ON sistema_log (criado_em DESC);
CREATE INDEX idx_sistema_log_nivel ON sistema_log (nivel);

-- Insert initial log
INSERT INTO sistema_log (nivel, modulo, mensagem, detalhes) 
VALUES ('INFO', 'SYSTEM', 'Sistema de logs e gerenciamento de banco de dados inicializado com sucesso.', '{"versao": "1.0.0"}');


-- ==========================================
-- EXPORTAÇÃO DE DADOS (DML)
-- ==========================================

-- Dados da tabela: empresa
INSERT INTO empresa (id_empresa, nome_fantasia, cnpj, ativo, criado_em) VALUES (1, 'Global MSP - Empresa Matriz', '00.000.000/0001-00', TRUE, '2026-05-04T23:38:33.483Z');
INSERT INTO empresa (id_empresa, nome_fantasia, cnpj, ativo, criado_em) VALUES (2, 'Cliente Alfa S.A.', '11.111.111/0001-11', TRUE, '2026-05-04T23:38:33.483Z');
INSERT INTO empresa (id_empresa, nome_fantasia, cnpj, ativo, criado_em) VALUES (3, 'Cliente Beta S.A.', '22.222.222/0001-22', TRUE, '2026-05-04T23:38:33.483Z');

-- Dados da tabela: usuario
INSERT INTO usuario (id_usuario, nome_usuario, cargo, data_ingresso, id_empresa, email, senha_hash, ativo, criado_em) VALUES (1, 'Administrador Global', 'Gestor MSP', '2026-05-04T03:00:00.000Z', 1, 'admin@msp.local', '$2a$06$pzUXNE9rQupsiYvHU/taKOQ6EcN/FayB1.B7KTebQDIVqAfK5lNgO', TRUE, '2026-05-04T23:38:33.495Z');
INSERT INTO usuario (id_usuario, nome_usuario, cargo, data_ingresso, id_empresa, email, senha_hash, ativo, criado_em) VALUES (2, 'Maria Técnica', 'Analista de Suporte', '2026-05-04T03:00:00.000Z', 1, 'tecnico@msp.local', '$2a$06$NKOeEk0gy4eG0AOqWnJ6CukFnbtbUDBjj8lb/Jn0yTxGED1/SFxke', TRUE, '2026-05-04T23:38:33.502Z');
INSERT INTO usuario (id_usuario, nome_usuario, cargo, data_ingresso, id_empresa, email, senha_hash, ativo, criado_em) VALUES (3, 'Carlos Gerente', 'Gerente TI Cliente', '2026-05-04T03:00:00.000Z', 2, 'admin@alfa.local', '$2a$06$gRCQKkLXHaOknDs6uz5O7uCpVtoyqgLi0p1ez9rpo9DXYmAwL89yu', TRUE, '2026-05-04T23:38:33.521Z');
INSERT INTO usuario (id_usuario, nome_usuario, cargo, data_ingresso, id_empresa, email, senha_hash, ativo, criado_em) VALUES (4, 'João Solicitante', 'Analista Financeiro', '2026-05-04T03:00:00.000Z', 2, 'joao@alfa.local', '$2a$06$s7/i8iVFnh460CTytOwfZ.JNfKyndABr4toJPbv7IkdliZn39cXYu', TRUE, '2026-05-04T23:38:33.539Z');
INSERT INTO usuario (id_usuario, nome_usuario, cargo, data_ingresso, id_empresa, email, senha_hash, ativo, criado_em) VALUES (6, 'Felipe Tecnico', 'Tecnico', '2026-05-07T03:00:00.000Z', 1, 'tecnico@gmail.com', '$2a$06$KVUmlNGUuIiBGPea3jlsCO2LhOWDdgvF24wfHA7XMeoBkce65qHu.', TRUE, '2026-05-07T22:51:01.483Z');

-- Dados da tabela: inventario
INSERT INTO inventario (id_inventario, tipo_item, id_empresa, id_fabricante, nome_modelo, id_tipo_hardware, numero_serie, patrimonio_tag, data_aquisicao, valor_aquisicao, versao, chave_licenca, data_expiracao, status, criado_em) VALUES (1, 'HARDWARE', 2, 1, 'Latitude 5440', 1, 'SN-ALFA-001', 'PAT-ALFA-001', NULL, NULL, NULL, NULL, NULL, 'BAIXADO', '2026-05-04T23:38:33.635Z');
INSERT INTO inventario (id_inventario, tipo_item, id_empresa, id_fabricante, nome_modelo, id_tipo_hardware, numero_serie, patrimonio_tag, data_aquisicao, valor_aquisicao, versao, chave_licenca, data_expiracao, status, criado_em) VALUES (2, 'HARDWARE', 3, 4, 'Apple Screen Pro', 3, '12939123', 'APP-STG-001', NULL, NULL, NULL, NULL, NULL, 'DISPONIVEL', '2026-05-07T22:47:22.604Z');
INSERT INTO inventario (id_inventario, tipo_item, id_empresa, id_fabricante, nome_modelo, id_tipo_hardware, numero_serie, patrimonio_tag, data_aquisicao, valor_aquisicao, versao, chave_licenca, data_expiracao, status, criado_em) VALUES (3, 'SOFTWARE', 2, 5, 'Office 365 Business', NULL, NULL, NULL, NULL, NULL, '2023', 'XXXX-YYYY-ZZZZ', '2027-01-01T03:00:00.000Z', 'ATIVO', '2026-05-04T23:38:33.667Z');

-- Dados da tabela: chamado
INSERT INTO chamado (id_chamado, id_solicitante, id_categoria, id_prioridade, id_status, id_tecnico, titulo, descricao, solucao, data_abertura, data_prazo_sla, data_primeira_resposta, data_resolucao, data_fechamento, criado_por, atualizado_em, id_inventario_rel) VALUES (1, 1, 1, 3, 5, 1, 'Preciso de Ajuda', 'DASDA', 'Feito', '2026-05-06T00:23:57.479Z', '2026-05-06T04:23:57.479Z', NULL, '2026-05-06T00:42:33.011Z', '2026-05-06T00:42:36.902Z', 1, '2026-05-06T00:42:36.902Z', 1);
INSERT INTO chamado (id_chamado, id_solicitante, id_categoria, id_prioridade, id_status, id_tecnico, titulo, descricao, solucao, data_abertura, data_prazo_sla, data_primeira_resposta, data_resolucao, data_fechamento, criado_por, atualizado_em, id_inventario_rel) VALUES (2, 1, 3, 2, 5, 1, 'Preciso Arrumar Meu PC', 'Meu PC parou de funcionar', 'resolvido', '2026-05-06T03:19:21.096Z', '2026-05-07T03:19:21.096Z', NULL, '2026-05-06T03:21:15.542Z', '2026-05-06T03:21:18.197Z', 1, '2026-05-06T03:21:18.197Z', 1);
INSERT INTO chamado (id_chamado, id_solicitante, id_categoria, id_prioridade, id_status, id_tecnico, titulo, descricao, solucao, data_abertura, data_prazo_sla, data_primeira_resposta, data_resolucao, data_fechamento, criado_por, atualizado_em, id_inventario_rel) VALUES (3, 1, 1, 2, 2, 1, 'Minha tela quebrou', 'Tela quebrou', NULL, '2026-05-07T22:52:48.909Z', '2026-05-08T06:52:48.909Z', NULL, NULL, NULL, 1, '2026-05-07T22:57:21.652Z', 2);
INSERT INTO chamado (id_chamado, id_solicitante, id_categoria, id_prioridade, id_status, id_tecnico, titulo, descricao, solucao, data_abertura, data_prazo_sla, data_primeira_resposta, data_resolucao, data_fechamento, criado_por, atualizado_em, id_inventario_rel) VALUES (4, 3, 1, 3, 4, 2, 'Fodase', 'fodase', 'deu certo', '2026-05-07T22:58:30.672Z', '2026-05-08T02:58:30.672Z', NULL, '2026-05-12T23:24:13.577Z', NULL, 3, '2026-05-12T23:24:13.577Z', NULL);
INSERT INTO chamado (id_chamado, id_solicitante, id_categoria, id_prioridade, id_status, id_tecnico, titulo, descricao, solucao, data_abertura, data_prazo_sla, data_primeira_resposta, data_resolucao, data_fechamento, criado_por, atualizado_em, id_inventario_rel) VALUES (5, 1, 1, 1, 2, 1, 'Preciso de Ajuda', 'teste', NULL, '2026-05-12T23:24:43.224Z', '2026-05-13T11:24:43.224Z', NULL, NULL, NULL, 1, '2026-05-13T00:32:06.004Z', 3);
INSERT INTO chamado (id_chamado, id_solicitante, id_categoria, id_prioridade, id_status, id_tecnico, titulo, descricao, solucao, data_abertura, data_prazo_sla, data_primeira_resposta, data_resolucao, data_fechamento, criado_por, atualizado_em, id_inventario_rel) VALUES (6, 1, 1, 1, 4, NULL, 'teste', 'teste', 'FEITO', '2026-05-13T00:43:11.952Z', '2026-05-13T12:43:11.952Z', NULL, '2026-05-13T00:45:33.846Z', NULL, 1, '2026-05-13T00:45:33.846Z', 3);
INSERT INTO chamado (id_chamado, id_solicitante, id_categoria, id_prioridade, id_status, id_tecnico, titulo, descricao, solucao, data_abertura, data_prazo_sla, data_primeira_resposta, data_resolucao, data_fechamento, criado_por, atualizado_em, id_inventario_rel) VALUES (7, 3, 1, 2, 5, 1, 'Teste 2', 'teste2', 'FEITO', '2026-05-13T00:43:49.646Z', '2026-05-14T00:44:00.000Z', NULL, '2026-05-13T00:46:20.784Z', '2026-05-13T00:46:30.479Z', 3, '2026-05-13T00:46:30.479Z', 3);

-- Dados da tabela: chamado_historico
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('1', 1, 1, 'Chamado aberto.', 'ABERTURA', '2026-05-06T00:23:57.479Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('2', 1, NULL, 'Status alterado de ABERTO para EM_ATENDIMENTO.', 'MUDANCA_STATUS', '2026-05-06T00:30:17.436Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('3', 1, 1, 'O técnico Maria Técnica assumiu este chamado e está trabalhando para resolvê-lo.', 'ATRIBUICAO', '2026-05-06T00:30:17.436Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('4', 1, NULL, 'Status alterado de EM_ATENDIMENTO para RESOLVIDO.', 'MUDANCA_STATUS', '2026-05-06T00:42:33.011Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('5', 1, 1, 'Feito', 'RESOLUCAO', '2026-05-06T00:42:33.011Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('6', 1, NULL, 'Status alterado de RESOLVIDO para FECHADO.', 'MUDANCA_STATUS', '2026-05-06T00:42:36.902Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('7', 1, 1, 'Chamado fechado.', 'FECHAMENTO', '2026-05-06T00:42:36.902Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('8', 2, 1, 'Chamado aberto.', 'ABERTURA', '2026-05-06T03:19:21.096Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('9', 2, NULL, 'Status alterado de ABERTO para EM_ATENDIMENTO.', 'MUDANCA_STATUS', '2026-05-06T03:19:39.273Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('10', 2, 1, 'O técnico Maria Técnica assumiu este chamado e está trabalhando para resolvê-lo.', 'ATRIBUICAO', '2026-05-06T03:19:39.273Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('11', 2, NULL, 'Status alterado de EM_ATENDIMENTO para RESOLVIDO.', 'MUDANCA_STATUS', '2026-05-06T03:21:15.542Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('12', 2, 1, 'resolvido', 'RESOLUCAO', '2026-05-06T03:21:15.542Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('13', 2, NULL, 'Status alterado de RESOLVIDO para FECHADO.', 'MUDANCA_STATUS', '2026-05-06T03:21:18.197Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('14', 2, 1, 'Chamado fechado.', 'FECHAMENTO', '2026-05-06T03:21:18.197Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('15', 3, 1, 'Chamado aberto.', 'ABERTURA', '2026-05-07T22:52:48.909Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('16', 3, NULL, 'Status alterado de ABERTO para EM_ATENDIMENTO.', 'MUDANCA_STATUS', '2026-05-07T22:53:18.160Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('17', 3, 1, 'O técnico Felipe Tecnico assumiu este chamado e está trabalhando para resolvê-lo.', 'ATRIBUICAO', '2026-05-07T22:53:18.160Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('18', 3, 1, 'O técnico Felipe Tecnico assumiu este chamado e está trabalhando para resolvê-lo.', 'ATRIBUICAO', '2026-05-07T22:57:07.786Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('19', 3, 1, 'O técnico Maria Técnica assumiu este chamado e está trabalhando para resolvê-lo.', 'ATRIBUICAO', '2026-05-07T22:57:21.652Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('20', 4, 3, 'Chamado aberto.', 'ABERTURA', '2026-05-07T22:58:30.672Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('21', 4, NULL, 'Status alterado de ABERTO para EM_ATENDIMENTO.', 'MUDANCA_STATUS', '2026-05-07T22:58:55.262Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('22', 4, 2, 'O técnico Maria Técnica assumiu este chamado e está trabalhando para resolvê-lo.', 'ATRIBUICAO', '2026-05-07T22:58:55.262Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('23', 4, 1, 'Tentei ir ao local mas estava fechado', 'COMENTARIO', '2026-05-12T23:23:29.628Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('24', 4, 1, 'Precisa ir de novo', 'IMPEDIMENTO', '2026-05-12T23:23:44.415Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('25', 4, 1, 'O técnico Maria Técnica assumiu este chamado e está trabalhando para resolvê-lo.', 'ATRIBUICAO', '2026-05-12T23:23:59.631Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('26', 4, 1, 'O técnico Felipe Tecnico assumiu este chamado e está trabalhando para resolvê-lo.', 'ATRIBUICAO', '2026-05-12T23:24:05.533Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('27', 4, NULL, 'Status alterado de EM_ATENDIMENTO para RESOLVIDO.', 'MUDANCA_STATUS', '2026-05-12T23:24:13.577Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('28', 4, 1, 'deu certo', 'RESOLUCAO', '2026-05-12T23:24:13.577Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('29', 5, 1, 'Chamado aberto.', 'ABERTURA', '2026-05-12T23:24:43.224Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('30', 5, 1, 'ajuda', 'ANALISE', '2026-05-12T23:24:57.834Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('31', 5, NULL, 'Status alterado de ABERTO para EM_ATENDIMENTO.', 'MUDANCA_STATUS', '2026-05-13T00:32:06.004Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('32', 5, 1, 'O técnico Maria Técnica assumiu este chamado e está trabalhando para resolvê-lo.', 'ATRIBUICAO', '2026-05-13T00:32:06.004Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('33', 5, 1, 'precisa voltar, deu erro', 'IMPEDIMENTO', '2026-05-13T00:32:20.593Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('34', 6, 1, 'Chamado aberto.', 'ABERTURA', '2026-05-13T00:43:11.952Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('35', 7, 3, 'Chamado aberto.', 'ABERTURA', '2026-05-13T00:43:49.646Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('36', 7, NULL, 'Status alterado de ABERTO para EM_ATENDIMENTO.', 'MUDANCA_STATUS', '2026-05-13T00:44:17.843Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('37', 7, 2, 'O técnico Maria Técnica assumiu este chamado e está trabalhando para resolvê-lo.', 'ATRIBUICAO', '2026-05-13T00:44:17.843Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('38', 7, 2, 'Técnico solicitou alteração de SLA para 2026-05-14T00:44:00.000Z. Motivo: Nao consegui contato', 'SOLICITACAO_SLA', '2026-05-13T00:44:42.298Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('39', 7, 1, 'Solicitação de SLA APROVADA. VALIDO', 'RESPOSTA_SLA', '2026-05-13T00:45:07.698Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('40', 6, NULL, 'Status alterado de ABERTO para RESOLVIDO.', 'MUDANCA_STATUS', '2026-05-13T00:45:33.846Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('41', 6, 1, 'FEITO', 'RESOLUCAO', '2026-05-13T00:45:33.846Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('42', 7, NULL, 'Status alterado de EM_ATENDIMENTO para RESOLVIDO.', 'MUDANCA_STATUS', '2026-05-13T00:46:20.784Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('43', 7, 1, 'FEITO', 'RESOLUCAO', '2026-05-13T00:46:20.784Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('44', 7, NULL, 'Status alterado de RESOLVIDO para FECHADO.', 'MUDANCA_STATUS', '2026-05-13T00:46:30.479Z');
INSERT INTO chamado_historico (id_historico, id_chamado, id_autor, mensagem, tipo_evento, criado_em) VALUES ('45', 7, 1, 'Chamado fechado.', 'FECHAMENTO', '2026-05-13T00:46:30.479Z');

-- Dados da tabela: sistema_log
INSERT INTO sistema_log (id_log, nivel, modulo, mensagem, detalhes, criado_em) VALUES (1, 'INFO', 'SYSTEM', 'Sistema de logs e gerenciamento de banco de dados inicializado com sucesso.', '{"versao":"1.0.0"}', '2026-05-13T00:58:11.935Z');
INSERT INTO sistema_log (id_log, nivel, modulo, mensagem, detalhes, criado_em) VALUES (2, 'INFO', 'BACKUP', 'Iniciando backup agendado', '{"arquivo":"sgdb_backup_2026-05-13T01-06-34-682Z.sql"}', '2026-05-13T01:06:34.751Z');
INSERT INTO sistema_log (id_log, nivel, modulo, mensagem, detalhes, criado_em) VALUES (3, 'ERROR', 'BACKUP', 'Falha ao executar backup', '{"erro":"Command failed: pg_dump \"postgres://sgdb_app:troque_esta_senha_em_producao@127.0.0.1:5432/sgdb\" -F c -f \"C:\\Users\\bueno\\coding\\sgdb-project\\backups\\sgdb_backup_2026-05-13T01-06-34-682Z.sql\"\n''pg_dump'' n�o � reconhecido como um comando interno\r\nou externo, um programa oper�vel ou um arquivo em lotes.\r\n","stderr":"''pg_dump'' n�o � reconhecido como um comando interno\r\nou externo, um programa oper�vel ou um arquivo em lotes.\r\n","duration_ms":75}', '2026-05-13T01:06:34.770Z');
INSERT INTO sistema_log (id_log, nivel, modulo, mensagem, detalhes, criado_em) VALUES (4, 'INFO', 'BACKUP', 'Iniciando backup manual', '{"arquivo":"sgdb_backup_2026-05-13T01-07-24-791Z.sql"}', '2026-05-13T01:07:25.361Z');
INSERT INTO sistema_log (id_log, nivel, modulo, mensagem, detalhes, criado_em) VALUES (5, 'ERROR', 'BACKUP', 'Falha ao executar backup', '{"erro":"Command failed: pg_dump \"postgres://sgdb_app:troque_esta_senha_em_producao@127.0.0.1:5432/sgdb\" -F c -f \"C:\\Users\\bueno\\coding\\sgdb-project\\backups\\sgdb_backup_2026-05-13T01-07-24-791Z.sql\"\n''pg_dump'' n�o � reconhecido como um comando interno\r\nou externo, um programa oper�vel ou um arquivo em lotes.\r\n","stderr":"''pg_dump'' n�o � reconhecido como um comando interno\r\nou externo, um programa oper�vel ou um arquivo em lotes.\r\n","duration_ms":586}', '2026-05-13T01:07:25.388Z');
INSERT INTO sistema_log (id_log, nivel, modulo, mensagem, detalhes, criado_em) VALUES (6, 'INFO', 'BACKUP', 'Iniciando backup agendado (modo JSON leve)', '{"arquivo":"sgdb_backup_2026-05-13T01-10-43-494Z.json"}', '2026-05-13T01:10:43.546Z');
INSERT INTO sistema_log (id_log, nivel, modulo, mensagem, detalhes, criado_em) VALUES (7, 'INFO', 'BACKUP', 'Iniciando backup agendado (modo Raw SQL)', '{"arquivo":"sgdb_backup_2026-05-13T03-12-44-903Z.sql"}', '2026-05-13T03:12:44.953Z');
INSERT INTO sistema_log (id_log, nivel, modulo, mensagem, detalhes, criado_em) VALUES (8, 'INFO', 'BACKUP', 'Iniciando backup manual (modo Raw SQL)', '{"arquivo":"sgdb_backup_2026-05-14T22-43-29-446Z.sql"}', '2026-05-14T22:43:29.481Z');

