const express = require('express');
const { pool } = require('../db');
const { authRequired, requirePerfil } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

router.get('/inventario/software', async (req, res) => {
  const uid = req.user.sub;
  const id_empresa = req.user.id_empresa;
  const perfis = req.user.perfis || [];
  const isAdmin = perfis.includes('ADMIN');
  const isTecnico = perfis.includes('TECNICO');

  try {
    let sql = `
      SELECT s.id_software, fab.nome AS fabricante, e.nome_fantasia as empresa,
             s.nome, s.versao, s.chave_licenca, s.data_expiracao, s.status_software
      FROM software s
      JOIN fabricante fab ON fab.id_fabricante = s.id_fabricante
      JOIN empresa e ON e.id_empresa = s.id_empresa
      WHERE s.status_software != 'BAIXADO'
    `;
    const params = [];
    
    if (!isAdmin) {
      if (isTecnico) {
        sql += ` AND s.id_empresa IN (SELECT id_empresa FROM tecnico_empresa te JOIN tecnico t ON t.id_tecnico = te.id_tecnico WHERE t.id_usuario = $1) `;
        params.push(uid);
      } else {
        sql += ` AND s.id_empresa = $1 `;
        params.push(id_empresa);
      }
    }
    
    sql += ` ORDER BY s.id_software DESC LIMIT 500`;

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao listar software.' });
  }
});

router.post('/inventario/software', requirePerfil('ADMIN', 'TECNICO'), async (req, res) => {
  const { id_fabricante, id_empresa, nome, versao, chave_licenca, data_expiracao } = req.body;
  const uid = req.user.sub;
  const perfis = req.user.perfis || [];
  const isAdmin = perfis.includes('ADMIN');

  try {
    if (!isAdmin) {
      const { rows } = await pool.query(
        'SELECT 1 FROM tecnico_empresa te JOIN tecnico t ON t.id_tecnico = te.id_tecnico WHERE t.id_usuario = $1 AND te.id_empresa = $2',
        [uid, id_empresa]
      );
      if (rows.length === 0) return res.status(403).json({ erro: 'Você não atende esta empresa.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO software (id_fabricante, id_empresa, nome, versao, chave_licenca, data_expiracao)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_software`,
      [id_fabricante, id_empresa, nome, versao, chave_licenca, data_expiracao || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(400).json({ erro: e.message || 'Falha ao cadastrar software.' });
  }
});

module.exports = router;
