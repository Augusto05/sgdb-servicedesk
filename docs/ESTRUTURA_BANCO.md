# Estrutura de Tabelas (SGBD)

Este documento contém todas as definições de tabelas (DDL) do projeto, consolidando os esquemas iniciais e as evoluções posteriores (como a unificação do inventário e gestão de SLA). Utilize este arquivo para a criação do **DER (Diagrama Entidade-Relacionamento)** e **MER (Modelo Entidade-Relacionamento)**.

---

## 1. Núcleo de Identidade e Multi-Tenancy

### Tabela: `empresa`
Entidade locatária do sistema (Tenant).
```sql
CREATE TABLE empresa (
    id_empresa SERIAL PRIMARY KEY,
    nome_fantasia VARCHAR(120) NOT NULL UNIQUE,
    cnpj VARCHAR(18) UNIQUE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Tabela: `perfil`
Papéis de acesso (RBAC).
```sql
CREATE TABLE perfil (
    id_perfil SERIAL PRIMARY KEY,
    codigo VARCHAR(40) NOT NULL UNIQUE,
    descricao VARCHAR(200) NOT NULL
);
```

### Tabela: `usuario`
Usuários do sistema (Solicitantes e Administradores).
```sql
CREATE TABLE usuario (
    id_usuario SERIAL PRIMARY KEY,
    nome_usuario VARCHAR(120) NOT NULL,
    cargo VARCHAR(120),
    data_ingresso DATE NOT NULL DEFAULT CURRENT_DATE,
    id_empresa INTEGER NOT NULL REFERENCES empresa (id_empresa),
    email VARCHAR(180) NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    perfis VARCHAR(40)[] DEFAULT ARRAY[]::VARCHAR[], -- Array de códigos de perfil (ex: {'ADMIN'})
    foto_url TEXT,
    data_nascimento DATE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_email_format CHECK (email ~* '^[^@]+@[^@]+\.[^@]+$')
);
```

---

## 2. Corpo Técnico

### Tabela: `tecnico`
Extensão da entidade usuário para papéis técnicos.
```sql
CREATE TABLE tecnico (
    id_tecnico SERIAL PRIMARY KEY,
    id_usuario INTEGER NOT NULL UNIQUE REFERENCES usuario (id_usuario) ON DELETE CASCADE,
    especialidade VARCHAR(200),
    matricula VARCHAR(40) UNIQUE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE
);
```

### Tabela: `tecnico_empresa`
Relacionamento N:N que define quais empresas um técnico pode atender (Isolamento Multi-tenant).
```sql
CREATE TABLE tecnico_empresa (
    id_tecnico INTEGER NOT NULL REFERENCES tecnico (id_tecnico) ON DELETE CASCADE,
    id_empresa INTEGER NOT NULL REFERENCES empresa (id_empresa) ON DELETE CASCADE,
    PRIMARY KEY (id_tecnico, id_empresa)
);
```

---

## 3. Gestão de Ativos (CMDB)

### Tabela: `fabricante`
```sql
CREATE TABLE fabricante (
    id_fabricante SERIAL PRIMARY KEY,
    nome VARCHAR(120) NOT NULL UNIQUE
);
```

### Tabela: `inventario`
Tabela unificada que gerencia tanto Hardware quanto Software.
```sql
CREATE TABLE inventario (
    id_inventario SERIAL PRIMARY KEY,
    tipo_item VARCHAR(20) NOT NULL CHECK (tipo_item IN ('HARDWARE', 'SOFTWARE')),
    id_empresa INTEGER NOT NULL REFERENCES empresa (id_empresa) ON DELETE CASCADE,
    id_fabricante INTEGER NOT NULL REFERENCES fabricante (id_fabricante),
    nome_modelo VARCHAR(120) NOT NULL,
    tipo_hardware_nome VARCHAR(80), -- Nome direto do tipo (ex: Notebook, Desktop)
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
```

---

## 4. Operação de Service Desk (Chamados)

### Tabela: `categoria_chamado`
```sql
CREATE TABLE categoria_chamado (
    id_categoria SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    sla_horas_padrao INTEGER NOT NULL DEFAULT 24 CHECK (sla_horas_padrao > 0)
);
```

### Tabela: `prioridade`
```sql
CREATE TABLE prioridade (
    id_prioridade SERIAL PRIMARY KEY,
    nome VARCHAR(40) NOT NULL UNIQUE,
    peso INTEGER NOT NULL DEFAULT 1 CHECK (peso BETWEEN 1 AND 5),
    fator_sla NUMERIC(4,2) NOT NULL DEFAULT 1.00 CHECK (fator_sla > 0)
);
```

### Tabela: `status_chamado`
```sql
CREATE TABLE status_chamado (
    id_status SERIAL PRIMARY KEY,
    codigo VARCHAR(40) NOT NULL UNIQUE,
    descricao VARCHAR(120) NOT NULL
);
```

### Tabela: `chamado`
Entidade central de transações.
```sql
CREATE TABLE chamado (
    id_chamado SERIAL PRIMARY KEY,
    id_solicitante INTEGER NOT NULL REFERENCES usuario (id_usuario),
    id_categoria INTEGER NOT NULL REFERENCES categoria_chamado (id_categoria),
    id_prioridade INTEGER NOT NULL REFERENCES prioridade (id_prioridade),
    id_status INTEGER NOT NULL REFERENCES status_chamado (id_status),
    id_tecnico INTEGER REFERENCES tecnico (id_tecnico),
    id_inventario_rel INTEGER REFERENCES inventario (id_inventario), -- Vínculo com Ativo
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
```

### Tabela: `chamado_historico`
Timeline e trilha de auditoria dos chamados.
```sql
CREATE TABLE chamado_historico (
    id_historico BIGSERIAL PRIMARY KEY,
    id_chamado INTEGER NOT NULL REFERENCES chamado (id_chamado) ON DELETE CASCADE,
    id_autor INTEGER REFERENCES usuario (id_usuario),
    mensagem TEXT NOT NULL,
    tipo_evento VARCHAR(40) NOT NULL DEFAULT 'COMENTARIO',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Tabela: `solicitacao_sla`
Gestão de mudanças em prazos de atendimento.
```sql
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
```

---

## 5. Manutenção e Governança

### Tabela: `manutencao`
Histórico de intervenções em ativos.
```sql
CREATE TABLE manutencao (
    id_manutencao SERIAL PRIMARY KEY,
    id_inventario INTEGER NOT NULL REFERENCES inventario (id_inventario),
    id_tecnico INTEGER REFERENCES tecnico (id_tecnico),
    tipo VARCHAR(40) NOT NULL CHECK (tipo IN ('PREVENTIVA','CORRETIVA','UPGRADE')),
    descricao TEXT NOT NULL,
    custo NUMERIC(12, 2),
    data_execucao DATE NOT NULL DEFAULT CURRENT_DATE,
    id_chamado INTEGER REFERENCES chamado (id_chamado)
);
```

### Tabela: `sistema_log`
Log de auditoria do sistema (Backup, Segurança, Performance).
```sql
CREATE TABLE sistema_log (
    id_log SERIAL PRIMARY KEY,
    nivel VARCHAR(20) NOT NULL CHECK (nivel IN ('INFO', 'WARN', 'ERROR', 'CRITICAL')),
    modulo VARCHAR(50) NOT NULL,
    mensagem TEXT NOT NULL,
    detalhes JSONB,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
