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

module.exports = router;
