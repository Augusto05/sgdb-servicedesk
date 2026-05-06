const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, senha } = req.body || {};
  if (!email || !senha) {
    return res.status(400).json({ erro: 'Informe email e senha.' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT u.id_usuario, u.nome_usuario, u.email, u.id_empresa, u.ativo,
              COALESCE(
                (SELECT array_agg(p.codigo ORDER BY p.codigo)
                 FROM usuario_perfil up
                 JOIN perfil p ON p.id_perfil = up.id_perfil
                 WHERE up.id_usuario = u.id_usuario),
                ARRAY[]::varchar[]
              ) AS perfis
       FROM usuario u
       WHERE lower(trim(u.email)) = lower(trim($1))
         AND u.senha_hash = crypt($2::text, u.senha_hash)
         AND u.ativo = TRUE`,
      [email, senha]
    );

    if (rows.length === 0) {
      return res.status(401).json({ erro: 'Credenciais inválidas.' });
    }

    const u = rows[0];
    const token = jwt.sign(
      {
        sub: u.id_usuario,
        email: u.email,
        nome: u.nome_usuario,
        perfis: u.perfis,
        id_empresa: u.id_empresa
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      token,
      usuario: {
        id_usuario: u.id_usuario,
        nome_usuario: u.nome_usuario,
        email: u.email,
        perfis: u.perfis,
        id_empresa: u.id_empresa
      },
    });
  } catch (e) {
    console.error('Erro no login:', e);
    return res.status(500).json({ erro: 'Falha ao autenticar.' });
  }
});

module.exports = router;
