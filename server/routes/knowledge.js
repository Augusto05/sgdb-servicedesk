const express = require('express');
const { pool } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

/**
 * Lista artigos da base de conhecimento
 */
router.get('/', authRequired, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT b.*, u.nome_usuario as autor
      FROM base_conhecimento b
      JOIN usuario u ON u.id_usuario = b.id_autor
      ORDER BY b.criado_em DESC
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

/**
 * Cria novo artigo (Apenas Admin ou Técnico)
 */
router.post('/', authRequired, async (req, res) => {
  const { titulo, conteudo, categoria } = req.body;
  if (!titulo || !conteudo) return res.status(400).json({ erro: 'Título e conteúdo obrigatórios.' });

  try {
    const { rows } = await pool.query(
      'INSERT INTO base_conhecimento (titulo, conteudo, categoria, id_autor) VALUES ($1, $2, $3, $4) RETURNING *',
      [titulo, conteudo, categoria, req.user.sub]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
