const express = require('express');
const { pool } = require('../db');
const { authRequired, requirePerfil } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// Helper function to check inventory access
async function checkInventoryAccess(req, res, id_empresa_item) {
  const uid = req.user.sub;
  const perfis = req.user.perfis || [];
  const isAdmin = perfis.includes('ADMIN');
  const isEmpresaAdmin = perfis.includes('EMPRESA_ADMIN');
  
  if (isAdmin) return true;
  
  if (isEmpresaAdmin) {
    if (req.user.id_empresa !== parseInt(id_empresa_item, 10)) {
      res.status(403).json({ erro: 'Acesso negado: Item pertence a outra empresa.' });
      return false;
    }
    return true;
  }
  
  // Tecnico
  const { rows } = await pool.query(
    'SELECT 1 FROM tecnico_empresa te JOIN tecnico t ON t.id_tecnico = te.id_tecnico WHERE t.id_usuario = $1 AND te.id_empresa = $2',
    [uid, id_empresa_item]
  );
  if (rows.length === 0) {
    res.status(403).json({ erro: 'Acesso negado: Você não atende esta empresa.' });
    return false;
  }
  return true;
}

// GET /inventario
router.get('/inventario', async (req, res) => {
  const uid = req.user.sub;
  const id_empresa = req.user.id_empresa;
  const perfis = req.user.perfis || [];
  const isAdmin = perfis.includes('ADMIN');
  const isTecnico = perfis.includes('TECNICO');
  const { tipo } = req.query; // HARDWARE or SOFTWARE

  try {
    let sql = `
      SELECT i.id_inventario, i.tipo_item, i.nome_modelo, i.status, i.numero_serie, i.patrimonio_tag, i.versao, i.chave_licenca, i.data_expiracao,
             fab.nome AS fabricante, e.nome_fantasia as empresa, th.nome AS tipo_hardware
      FROM inventario i
      JOIN fabricante fab ON fab.id_fabricante = i.id_fabricante
      JOIN empresa e ON e.id_empresa = i.id_empresa
      LEFT JOIN tipo_hardware th ON th.id_tipo_hardware = i.id_tipo_hardware
      WHERE i.status != 'BAIXADO' AND i.status != 'CANCELADO'
    `;
    const params = [];
    
    if (tipo) {
      params.push(tipo);
      sql += ` AND i.tipo_item = $${params.length}`;
    }

    if (!isAdmin) {
      if (isTecnico) {
        params.push(uid);
        sql += ` AND i.id_empresa IN (SELECT id_empresa FROM tecnico_empresa te JOIN tecnico t ON t.id_tecnico = te.id_tecnico WHERE t.id_usuario = $${params.length}) `;
      } else {
        params.push(id_empresa);
        sql += ` AND i.id_empresa = $${params.length} `;
      }
    }
    
    sql += ` ORDER BY i.id_inventario DESC LIMIT 500`;

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao listar inventário.' });
  }
});

// POST /inventario
router.post('/inventario', requirePerfil('ADMIN', 'TECNICO', 'EMPRESA_ADMIN'), async (req, res) => {
  const { tipo_item, id_empresa, id_fabricante, nome_modelo, id_tipo_hardware, numero_serie, patrimonio_tag, data_aquisicao, valor_aquisicao, versao, chave_licenca, data_expiracao, status } = req.body;
  
  if (!await checkInventoryAccess(req, res, id_empresa)) return;

  try {
    const { rows } = await pool.query(
      `INSERT INTO inventario (tipo_item, id_empresa, id_fabricante, nome_modelo, id_tipo_hardware, numero_serie, patrimonio_tag, data_aquisicao, valor_aquisicao, versao, chave_licenca, data_expiracao, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id_inventario`,
      [tipo_item, id_empresa, id_fabricante, nome_modelo, id_tipo_hardware || null, numero_serie || null, patrimonio_tag || null, data_aquisicao || null, valor_aquisicao || null, versao || null, chave_licenca || null, data_expiracao || null, status || 'ATIVO']
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(400).json({ erro: e.message || 'Falha ao cadastrar item no inventário.' });
  }
});

// PUT /inventario/:id
router.put('/inventario/:id', requirePerfil('ADMIN', 'EMPRESA_ADMIN'), async (req, res) => {
  const idInventario = parseInt(req.params.id, 10);
  const { id_empresa, id_fabricante, nome_modelo, id_tipo_hardware, numero_serie, patrimonio_tag, data_aquisicao, valor_aquisicao, versao, chave_licenca, data_expiracao, status } = req.body;

  try {
    const item = await pool.query('SELECT id_empresa FROM inventario WHERE id_inventario = $1', [idInventario]);
    if (item.rows.length === 0) return res.status(404).json({ erro: 'Item não encontrado.' });
    
    // Check access to the existing item's company
    if (!await checkInventoryAccess(req, res, item.rows[0].id_empresa)) return;
    
    // If changing company, check access to new company
    if (id_empresa && id_empresa !== item.rows[0].id_empresa) {
        if (!await checkInventoryAccess(req, res, id_empresa)) return;
    }

    await pool.query(
      `UPDATE inventario SET 
        id_empresa = COALESCE($1, id_empresa),
        id_fabricante = COALESCE($2, id_fabricante),
        nome_modelo = COALESCE($3, nome_modelo),
        id_tipo_hardware = COALESCE($4, id_tipo_hardware),
        numero_serie = COALESCE($5, numero_serie),
        patrimonio_tag = COALESCE($6, patrimonio_tag),
        data_aquisicao = COALESCE($7, data_aquisicao),
        valor_aquisicao = COALESCE($8, valor_aquisicao),
        versao = COALESCE($9, versao),
        chave_licenca = COALESCE($10, chave_licenca),
        data_expiracao = COALESCE($11, data_expiracao),
        status = COALESCE($12, status)
       WHERE id_inventario = $13`,
      [id_empresa, id_fabricante, nome_modelo, id_tipo_hardware, numero_serie, patrimonio_tag, data_aquisicao, valor_aquisicao, versao, chave_licenca, data_expiracao, status, idInventario]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(400).json({ erro: e.message || 'Falha ao atualizar inventário.' });
  }
});

// DELETE /inventario/:id
router.delete('/inventario/:id', requirePerfil('ADMIN', 'EMPRESA_ADMIN'), async (req, res) => {
  const idInventario = parseInt(req.params.id, 10);

  try {
    const item = await pool.query('SELECT id_empresa FROM inventario WHERE id_inventario = $1', [idInventario]);
    if (item.rows.length === 0) return res.status(404).json({ erro: 'Item não encontrado.' });
    
    if (!await checkInventoryAccess(req, res, item.rows[0].id_empresa)) return;

    await pool.query('DELETE FROM inventario WHERE id_inventario = $1', [idInventario]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(400).json({ erro: e.message || 'Falha ao deletar item. Verifique as dependências.' });
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
