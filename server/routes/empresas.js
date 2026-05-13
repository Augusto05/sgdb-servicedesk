const express = require('express');
const { pool } = require('../db');
const { requirePerfil, authRequired } = require('../middleware/auth');
const router = express.Router();

router.use(authRequired);

router.get('/', requirePerfil('ADMIN', 'TECNICO', 'EMPRESA_ADMIN'), async (req, res) => {
  const perfis = req.user.perfis || [];
  const isAdmin = perfis.includes('ADMIN');
  const isTecnico = perfis.includes('TECNICO');
  const id_empresa = req.user.id_empresa;

  try {
    let sql = 'SELECT * FROM empresa';
    const params = [];
    if (!isAdmin) {
      if (isTecnico) {
        sql += ' WHERE id_empresa IN (SELECT id_empresa FROM tecnico_empresa WHERE id_tecnico = (SELECT id_tecnico FROM tecnico WHERE id_usuario = $1))';
        params.push(req.user.sub);
      } else {
        sql += ' WHERE id_empresa = $1';
        params.push(id_empresa);
      }
    }
    sql += ' ORDER BY nome_fantasia';
    
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

router.post('/', requirePerfil('ADMIN'), async (req, res) => {
  const { nome_fantasia, cnpj } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO empresa (nome_fantasia, cnpj) VALUES ($1, $2) RETURNING *',
      [nome_fantasia, cnpj]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

router.put('/:id', requirePerfil('ADMIN'), async (req, res) => {
  const idEmpresa = parseInt(req.params.id, 10);
  const { nome_fantasia, cnpj, ativo } = req.body;
  try {
    await pool.query(
      `UPDATE empresa SET 
        nome_fantasia = COALESCE($1, nome_fantasia),
        cnpj = COALESCE($2, cnpj),
        ativo = COALESCE($3, ativo)
       WHERE id_empresa = $4`,
      [nome_fantasia, cnpj, ativo, idEmpresa]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

router.delete('/:id', requirePerfil('ADMIN'), async (req, res) => {
  const idEmpresa = parseInt(req.params.id, 10);
  try {
    await pool.query('DELETE FROM empresa WHERE id_empresa = $1', [idEmpresa]);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ erro: 'Falha ao deletar empresa. Pode haver dependências.' });
  }
});

module.exports = router;
