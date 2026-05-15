const express = require('express');
const { pool } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.get('/categorias', async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT id_categoria, nome, sla_horas_padrao FROM categoria_chamado ORDER BY nome'
  );
  res.json(rows);
});

router.get('/prioridades', async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT id_prioridade, nome, peso, fator_sla FROM prioridade ORDER BY peso'
  );
  res.json(rows);
});

router.get('/status', async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT id_status, codigo, descricao FROM status_chamado ORDER BY id_status'
  );
  res.json(rows);
});

module.exports = router;
