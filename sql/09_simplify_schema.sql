-- 09_simplify_schema.sql
-- Simplificação do esquema: Unificação de tabelas e uso de Arrays para perfis.

BEGIN;

-- 1. Preparar a tabela de usuários
ALTER TABLE usuario ADD COLUMN foto_url TEXT;
ALTER TABLE usuario ADD COLUMN data_nascimento DATE;
ALTER TABLE usuario ADD COLUMN perfis VARCHAR(40)[] DEFAULT ARRAY[]::VARCHAR[];

-- 2. Migrar dados de usuario_detalhes
UPDATE usuario u
SET foto_url = ud.foto_url,
    data_nascimento = ud.data_nascimento
FROM usuario_detalhes ud
WHERE ud.id_usuario = u.id_usuario;

-- 3. Migrar perfis para o array
UPDATE usuario u
SET perfis = (
    SELECT array_agg(p.codigo ORDER BY p.codigo)
    FROM usuario_perfil up
    JOIN perfil p ON p.id_perfil = up.id_perfil
    WHERE up.id_usuario = u.id_usuario
);

-- 4. Preparar a tabela de inventário
ALTER TABLE inventario ADD COLUMN tipo_hardware_nome VARCHAR(80);

-- 5. Migrar nomes de tipos de hardware
UPDATE inventario i
SET tipo_hardware_nome = th.nome
FROM tipo_hardware th
WHERE th.id_tipo_hardware = i.id_tipo_hardware;

-- 6. Remover tabelas e colunas redundantes
ALTER TABLE inventario DROP COLUMN id_tipo_hardware CASCADE;
DROP TABLE usuario_detalhes CASCADE;
DROP TABLE usuario_perfil CASCADE;
DROP TABLE tipo_hardware CASCADE;
DROP TABLE perfil CASCADE;

COMMIT;
