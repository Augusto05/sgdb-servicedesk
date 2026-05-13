const express = require('express');
const { pool } = require('../db');
const { requirePerfil } = require('../middleware/auth');
const router = express.Router();

// List users
router.get('/', requirePerfil('ADMIN', 'EMPRESA_ADMIN'), async (req, res) => {
  const perfis = req.user.perfis || [];
  const isAdmin = perfis.includes('ADMIN');
  const id_empresa = req.user.id_empresa;

  let sql = `
    SELECT u.id_usuario, u.nome_usuario, u.email, u.cargo, e.nome_fantasia as empresa,
           COALESCE((SELECT array_agg(p.codigo) FROM usuario_perfil up JOIN perfil p ON p.id_perfil = up.id_perfil WHERE up.id_usuario = u.id_usuario), ARRAY[]::varchar[]) as perfis
    FROM usuario u
    JOIN empresa e ON e.id_empresa = u.id_empresa
  `;
  const params = [];
  if (!isAdmin) {
    sql += ' WHERE u.id_empresa = $1 ';
    params.push(id_empresa);
  }
  try {
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Create user
router.post('/', requirePerfil('ADMIN', 'EMPRESA_ADMIN'), async (req, res) => {
  const perfis = req.user.perfis || [];
  const isAdmin = perfis.includes('ADMIN');
  let { nome_usuario, email, senha, id_empresa, cargo, perfil_codigo } = req.body;

  if (!isAdmin) {
    id_empresa = req.user.id_empresa;
    perfil_codigo = 'SOLICITANTE';
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: uRows } = await client.query(
      `INSERT INTO usuario (nome_usuario, email, senha_hash, id_empresa, cargo)
       VALUES ($1, $2, crypt($3, gen_salt('bf')), $4, $5) RETURNING id_usuario`,
      [nome_usuario, email, senha, id_empresa, cargo || '']
    );
    const userId = uRows[0].id_usuario;

    const { rows: pRows } = await client.query('SELECT id_perfil FROM perfil WHERE codigo = $1', [perfil_codigo]);
    if (pRows.length) {
      await client.query('INSERT INTO usuario_perfil (id_usuario, id_perfil) VALUES ($1, $2)', [userId, pRows[0].id_perfil]);
    }

    if (perfil_codigo === 'TECNICO') {
      await client.query('INSERT INTO tecnico (id_usuario, especialidade) VALUES ($1, $2)', [userId, 'Geral']);
    }

    await client.query('COMMIT');
    res.status(201).json({ id_usuario: userId });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ erro: e.message });
  } finally {
    client.release();
  }
});

// Update user
router.put('/:id', requirePerfil('ADMIN', 'EMPRESA_ADMIN'), async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const perfis = req.user.perfis || [];
  const isAdmin = perfis.includes('ADMIN');
  const { nome_usuario, email, cargo } = req.body; // Prevent updating id_empresa or password here for simplicity

  try {
    const userResult = await pool.query('SELECT id_empresa FROM usuario WHERE id_usuario = $1', [userId]);
    if (userResult.rows.length === 0) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    
    if (!isAdmin && userResult.rows[0].id_empresa !== req.user.id_empresa) {
      return res.status(403).json({ erro: 'Você só pode editar usuários da sua empresa.' });
    }

    await pool.query(
      `UPDATE usuario SET 
        nome_usuario = COALESCE($1, nome_usuario),
        email = COALESCE($2, email),
        cargo = COALESCE($3, cargo)
       WHERE id_usuario = $4`,
      [nome_usuario, email, cargo, userId]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

// Delete user
router.delete('/:id', requirePerfil('ADMIN', 'EMPRESA_ADMIN'), async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const perfis = req.user.perfis || [];
  const isAdmin = perfis.includes('ADMIN');

  try {
    const userResult = await pool.query('SELECT id_empresa FROM usuario WHERE id_usuario = $1', [userId]);
    if (userResult.rows.length === 0) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    
    if (!isAdmin && userResult.rows[0].id_empresa !== req.user.id_empresa) {
      return res.status(403).json({ erro: 'Você só pode excluir usuários da sua empresa.' });
    }

    await pool.query('DELETE FROM usuario WHERE id_usuario = $1', [userId]);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ erro: 'Falha ao deletar usuário. Pode haver dependências.' });
  }
});

module.exports = router;
