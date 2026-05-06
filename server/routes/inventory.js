const express = require('express');
const { pool } = require('../db');
const { authRequired, requirePerfil } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// GET /inventario/hardware
router.get('/inventario/hardware', async (req, res) => {
  const uid = req.user.sub;
  const id_empresa = req.user.id_empresa;
  const perfis = req.user.perfis || [];
  const isAdmin = perfis.includes('ADMIN');
  const isTecnico = perfis.includes('TECNICO');

  try {
    let sql = `
      SELECT h.id_hardware, th.nome AS tipo, fab.nome AS fabricante, e.nome_fantasia as empresa,
             h.modelo, h.numero_serie, h.patrimonio_tag, h.status_patrimonio, h.data_aquisicao
      FROM hardware h
      JOIN tipo_hardware th ON th.id_tipo_hardware = h.id_tipo_hardware
      JOIN fabricante fab ON fab.id_fabricante = h.id_fabricante
      JOIN empresa e ON e.id_empresa = h.id_empresa
      WHERE h.status_patrimonio != 'BAIXADO'
    `;
    const params = [];
    
    if (!isAdmin) {
      if (isTecnico) {
        sql += ` AND h.id_empresa IN (SELECT id_empresa FROM tecnico_empresa te JOIN tecnico t ON t.id_tecnico = te.id_tecnico WHERE t.id_usuario = $1) `;
        params.push(uid);
      } else {
        sql += ` AND h.id_empresa = $1 `;
        params.push(id_empresa);
      }
    }
    
    sql += ` ORDER BY h.id_hardware DESC LIMIT 500`;

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao listar hardware.' });
  }
});

// POST /inventario/hardware
router.post('/inventario/hardware', requirePerfil('ADMIN', 'TECNICO'), async (req, res) => {
  const { id_tipo_hardware, id_fabricante, id_empresa, modelo, numero_serie, patrimonio_tag } = req.body;
  const uid = req.user.sub;
  const perfis = req.user.perfis || [];
  const isAdmin = perfis.includes('ADMIN');

  try {
    if (!isAdmin) {
      // Verifica se o técnico atende essa empresa
      const { rows } = await pool.query(
        'SELECT 1 FROM tecnico_empresa te JOIN tecnico t ON t.id_tecnico = te.id_tecnico WHERE t.id_usuario = $1 AND te.id_empresa = $2',
        [uid, id_empresa]
      );
      if (rows.length === 0) return res.status(403).json({ erro: 'Você não atende esta empresa.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO hardware (id_tipo_hardware, id_fabricante, id_empresa, modelo, numero_serie, patrimonio_tag)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_hardware`,
      [id_tipo_hardware, id_fabricante, id_empresa, modelo, numero_serie, patrimonio_tag]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(400).json({ erro: e.message || 'Falha ao cadastrar hardware.' });
  }
});

// POST /inventario/hardware/:id/baixar
router.post('/inventario/hardware/:id/baixar', requirePerfil('ADMIN', 'TECNICO'), async (req, res) => {
  const idHardware = parseInt(req.params.id, 10);
  const uid = req.user.sub;
  const perfis = req.user.perfis || [];
  const isAdmin = perfis.includes('ADMIN');

  try {
    if (!isAdmin) {
      const hw = await pool.query('SELECT id_empresa FROM hardware WHERE id_hardware = $1', [idHardware]);
      if (hw.rows.length === 0) return res.status(404).json({ erro: 'Hardware não encontrado.' });
      const hw_empresa = hw.rows[0].id_empresa;
      
      const { rows } = await pool.query(
        'SELECT 1 FROM tecnico_empresa te JOIN tecnico t ON t.id_tecnico = te.id_tecnico WHERE t.id_usuario = $1 AND te.id_empresa = $2',
        [uid, hw_empresa]
      );
      if (rows.length === 0) return res.status(403).json({ erro: 'Você não atende a empresa deste hardware.' });
    }

    await pool.query(
      `UPDATE hardware SET status_patrimonio = 'BAIXADO' WHERE id_hardware = $1`,
      [idHardware]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(400).json({ erro: e.message || 'Falha ao baixar hardware.' });
  }
});

// Lookups (Tipo e Fabricante)
router.get('/inventario/tipos', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM tipo_hardware ORDER BY nome');
  res.json(rows);
});
router.get('/inventario/fabricantes', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM fabricante ORDER BY nome');
  res.json(rows);
});

module.exports = router;
