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
