-- 10_knowledge_base_and_dashboard.sql
-- Criação da tabela de base de conhecimento e ajustes para dashboard

BEGIN;

-- Tabela para Artigos da Base de Conhecimento
CREATE TABLE IF NOT EXISTS base_conhecimento (
    id_artigo SERIAL PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    conteudo TEXT NOT NULL,
    categoria VARCHAR(100),
    id_autor INTEGER REFERENCES usuario(id_usuario),
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para atualizar o timestamp de 'atualizado_em'
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_base_conhecimento
BEFORE UPDATE ON base_conhecimento
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Inserir alguns dados de exemplo (Seed)
INSERT INTO base_conhecimento (titulo, conteudo, categoria, id_autor)
VALUES 
('Como resetar senha de usuário', 'Para resetar a senha, vá em Usuários, selecione o usuário e clique em Resetar Senha...', 'Suporte', 1),
('Configuração de E-mail Corporativo', 'Siga os passos abaixo para configurar o Outlook...', 'TI', 1),
('Política de Uso de Hardware', 'Todos os equipamentos devem ser devolvidos em caso de desligamento...', 'RH / TI', 1);

COMMIT;
