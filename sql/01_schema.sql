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
