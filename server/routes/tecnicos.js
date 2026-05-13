const express = require('express');
const { pool } = require('../db');
const { requirePerfil } = require('../middleware/auth');
const router = express.Router();

router.use(requirePerfil('ADMIN', 'TECNICO'));

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT t.id_tecnico, u.nome_usuario, u.email,
             COALESCE((SELECT array_agg(e.nome_fantasia) FROM tecnico_empresa te JOIN empresa e ON e.id_empresa = te.id_empresa WHERE te.id_tecnico = t.id_tecnico), ARRAY[]::varchar[]) as empresas
      FROM tecnico t
      JOIN usuario u ON u.id_usuario = t.id_usuario
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

router.post('/:id/vincular', requirePerfil('ADMIN'), async (req, res) => {
  const id_tecnico = parseInt(req.params.id);
  const { id_empresa } = req.body;
  try {
    await pool.query('INSERT INTO tecnico_empresa (id_tecnico, id_empresa) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id_tecnico, id_empresa]);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

router.put('/:id', requirePerfil('ADMIN'), async (req, res) => {
  const idTecnico = parseInt(req.params.id, 10);
  const { especialidade, ativo } = req.body;
  try {
    await pool.query(
      `UPDATE tecnico SET 
        especialidade = COALESCE($1, especialidade),
        ativo = COALESCE($2, ativo)
       WHERE id_tecnico = $3`,
      [especialidade, ativo, idTecnico]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

router.delete('/:id', requirePerfil('ADMIN'), async (req, res) => {
  const idTecnico = parseInt(req.params.id, 10);
  try {
    // Delete from tecnico table. The foreign key constraint in usuario profile should be handled.
    // However, maybe it's better to just deactivate or delete from tecnico table
    await pool.query('DELETE FROM tecnico WHERE id_tecnico = $1', [idTecnico]);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ erro: 'Falha ao deletar técnico. Pode haver dependências.' });
  }
});

module.exports = router;
