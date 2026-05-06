INSERT INTO perfil (codigo, descricao) VALUES
    ('ADMIN', 'Administrador Global do Sistema'),
    ('TECNICO', 'Equipe de Atendimento/Técnico'),
    ('EMPRESA_ADMIN', 'Administrador da Empresa Cliente'),
    ('SOLICITANTE', 'Usuário Comum que abre chamados')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO empresa (nome_fantasia, cnpj) VALUES
    ('Global MSP - Empresa Matriz', '00.000.000/0001-00'),
    ('Cliente Alfa S.A.', '11.111.111/0001-11'),
    ('Cliente Beta S.A.', '22.222.222/0001-22')
ON CONFLICT (cnpj) DO NOTHING;

INSERT INTO categoria_chamado (nome, sla_horas_padrao) VALUES
    ('Incidente', 8),
    ('Requisição', 48),
    ('Problema', 24)
ON CONFLICT (nome) DO NOTHING;

INSERT INTO prioridade (nome, peso, fator_sla) VALUES
    ('Baixa', 1, 1.5),
    ('Média', 2, 1.0),
    ('Alta', 4, 0.5),
    ('Crítica', 5, 0.25)
ON CONFLICT (nome) DO NOTHING;

INSERT INTO status_chamado (codigo, descricao) VALUES
    ('ABERTO', 'Chamado aguardando atendimento'),
    ('EM_ATENDIMENTO', 'Técnico está atuando no chamado'),
    ('AGUARDANDO_USUARIO', 'Aguardando informações do solicitante'),
    ('RESOLVIDO', 'Solução aplicada, aguardando validação'),
    ('FECHADO', 'Encerrado formalmente')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO fabricante (nome) VALUES ('Dell'), ('HP'), ('Lenovo'), ('Apple') ON CONFLICT (nome) DO NOTHING;
INSERT INTO tipo_hardware (nome) VALUES ('Notebook'), ('Desktop'), ('Monitor'), ('Switch') ON CONFLICT (nome) DO NOTHING;

-- Inserir Usuários Iniciais
-- 1. Admin da MSP
INSERT INTO usuario (nome_usuario, cargo, id_empresa, email, senha_hash)
SELECT 'Administrador Global', 'Gestor MSP', e.id_empresa, 'admin@msp.local', crypt('SenhaForte!1', gen_salt('bf'))
FROM empresa e WHERE e.cnpj = '00.000.000/0001-00' LIMIT 1
ON CONFLICT (email) DO NOTHING;

-- 2. Técnico MSP
INSERT INTO usuario (nome_usuario, cargo, id_empresa, email, senha_hash)
SELECT 'Maria Técnica', 'Analista de Suporte', e.id_empresa, 'tecnico@msp.local', crypt('SenhaForte!1', gen_salt('bf'))
FROM empresa e WHERE e.cnpj = '00.000.000/0001-00' LIMIT 1
ON CONFLICT (email) DO NOTHING;

-- 3. Admin do Cliente Alfa
INSERT INTO usuario (nome_usuario, cargo, id_empresa, email, senha_hash)
SELECT 'Carlos Gerente', 'Gerente TI Cliente', e.id_empresa, 'admin@alfa.local', crypt('SenhaForte!1', gen_salt('bf'))
FROM empresa e WHERE e.cnpj = '11.111.111/0001-11' LIMIT 1
ON CONFLICT (email) DO NOTHING;

-- 4. Solicitante do Cliente Alfa
INSERT INTO usuario (nome_usuario, cargo, id_empresa, email, senha_hash)
SELECT 'João Solicitante', 'Analista Financeiro', e.id_empresa, 'joao@alfa.local', crypt('SenhaForte!1', gen_salt('bf'))
FROM empresa e WHERE e.cnpj = '11.111.111/0001-11' LIMIT 1
ON CONFLICT (email) DO NOTHING;

-- Vincular Perfis aos Usuários
INSERT INTO usuario_perfil (id_usuario, id_perfil)
SELECT u.id_usuario, p.id_perfil FROM usuario u JOIN perfil p ON p.codigo = 'ADMIN' WHERE u.email = 'admin@msp.local'
ON CONFLICT (id_usuario, id_perfil) DO NOTHING;

INSERT INTO usuario_perfil (id_usuario, id_perfil)
SELECT u.id_usuario, p.id_perfil FROM usuario u JOIN perfil p ON p.codigo = 'TECNICO' WHERE u.email = 'tecnico@msp.local'
ON CONFLICT (id_usuario, id_perfil) DO NOTHING;

INSERT INTO usuario_perfil (id_usuario, id_perfil)
SELECT u.id_usuario, p.id_perfil FROM usuario u JOIN perfil p ON p.codigo = 'EMPRESA_ADMIN' WHERE u.email = 'admin@alfa.local'
ON CONFLICT (id_usuario, id_perfil) DO NOTHING;

INSERT INTO usuario_perfil (id_usuario, id_perfil)
SELECT u.id_usuario, p.id_perfil FROM usuario u JOIN perfil p ON p.codigo = 'SOLICITANTE' WHERE u.email = 'joao@alfa.local'
ON CONFLICT (id_usuario, id_perfil) DO NOTHING;

-- Criar Registro Técnico
INSERT INTO tecnico (id_usuario, especialidade, matricula)
SELECT u.id_usuario, 'Infraestrutura B2B', 'TEC-001' FROM usuario u WHERE u.email = 'tecnico@msp.local'
ON CONFLICT (id_usuario) DO NOTHING;

-- Vincular Técnico à Empresa Cliente Alfa e Beta
INSERT INTO tecnico_empresa (id_tecnico, id_empresa)
SELECT t.id_tecnico, e.id_empresa FROM tecnico t 
JOIN usuario u ON u.id_usuario = t.id_usuario AND u.email = 'tecnico@msp.local'
CROSS JOIN empresa e WHERE e.cnpj IN ('11.111.111/0001-11', '22.222.222/0001-22')
ON CONFLICT (id_tecnico, id_empresa) DO NOTHING;

-- Hardware Exemplo (Cliente Alfa)
INSERT INTO hardware (id_tipo_hardware, id_fabricante, id_empresa, modelo, numero_serie, patrimonio_tag)
SELECT th.id_tipo_hardware, f.id_fabricante, e.id_empresa, 'Latitude 5440', 'SN-ALFA-001', 'PAT-ALFA-001'
FROM tipo_hardware th, fabricante f, empresa e
WHERE th.nome = 'Notebook' AND f.nome = 'Dell' AND e.cnpj = '11.111.111/0001-11' LIMIT 1
ON CONFLICT (patrimonio_tag) DO NOTHING;

-- Software Exemplo (Cliente Alfa)
INSERT INTO fabricante (nome) VALUES ('Microsoft') ON CONFLICT (nome) DO NOTHING;
INSERT INTO software (id_fabricante, id_empresa, nome, versao, chave_licenca, data_expiracao)
SELECT f.id_fabricante, e.id_empresa, 'Office 365 Business', '2023', 'XXXX-YYYY-ZZZZ', '2027-01-01'
FROM fabricante f, empresa e
WHERE f.nome = 'Microsoft' AND e.cnpj = '11.111.111/0001-11' LIMIT 1;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sgdb_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sgdb_app;
