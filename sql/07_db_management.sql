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
