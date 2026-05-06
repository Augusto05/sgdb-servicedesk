const express = require('express');
const { pool } = require('../db');
const { authRequired, requirePerfil } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

router.get('/:id(\\d+)', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const uid = req.user.sub;
  const id_empresa = req.user.id_empresa;
  const perfis = req.user.perfis || [];
  const isAdmin = perfis.includes('ADMIN');
  const isTecnico = perfis.includes('TECNICO');

  try {
    const main = await pool.query(
      `SELECT c.*, sc.codigo AS status_codigo, sc.descricao AS status_descricao,
              pr.nome AS prioridade, cc.nome AS categoria,
              sol.nome_usuario AS solicitante_nome, sol.email AS solicitante_email, sol.id_empresa as sol_empresa,
              tu.nome_usuario AS tecnico_nome
       FROM chamado c
       JOIN status_chamado sc ON sc.id_status = c.id_status
       JOIN prioridade pr ON pr.id_prioridade = c.id_prioridade
       JOIN categoria_chamado cc ON cc.id_categoria = c.id_categoria
       JOIN usuario sol ON sol.id_usuario = c.id_solicitante
       LEFT JOIN tecnico t ON t.id_tecnico = c.id_tecnico
       LEFT JOIN usuario tu ON tu.id_usuario = t.id_usuario
       WHERE c.id_chamado = $1`,
      [id]
    );
    if (main.rows.length === 0) return res.status(404).json({ erro: 'Chamado não encontrado.' });
    const row = main.rows[0];

    // Access control
    if (!isAdmin) {
      if (isTecnico) {
        const { rows: tr } = await pool.query('SELECT 1 FROM tecnico_empresa te JOIN tecnico t ON t.id_tecnico = te.id_tecnico WHERE t.id_usuario = $1 AND te.id_empresa = $2', [uid, row.sol_empresa]);
        if (tr.length === 0 && row.id_solicitante !== uid) return res.status(403).json({ erro: 'Sem permissão.' });
      } else {
        if (row.sol_empresa !== id_empresa) return res.status(403).json({ erro: 'Sem permissão.' });
      }
    }

    const hist = await pool.query(
      `SELECT h.id_historico, h.mensagem, h.tipo_evento, h.criado_em, u.nome_usuario AS autor_nome
       FROM chamado_historico h LEFT JOIN usuario u ON u.id_usuario = h.id_autor
       WHERE h.id_chamado = $1 ORDER BY h.criado_em ASC`, [id]
    );
    return res.json({ chamado: row, historico: hist.rows });
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
});

router.get('/', async (req, res) => {
  const uid = req.user.sub;
  const id_empresa = req.user.id_empresa;
  const perfis = req.user.perfis || [];
  const isAdmin = perfis.includes('ADMIN');
  const isTecnico = perfis.includes('TECNICO');

  try {
    let sql = `
      SELECT c.id_chamado, c.titulo, c.data_abertura, c.data_prazo_sla,
             sc.codigo AS status_codigo, pr.nome AS prioridade,
             u.nome_usuario AS solicitante, e.nome_fantasia as empresa
      FROM chamado c
      JOIN status_chamado sc ON sc.id_status = c.id_status
      JOIN prioridade pr ON pr.id_prioridade = c.id_prioridade
      JOIN usuario u ON u.id_usuario = c.id_solicitante
      JOIN empresa e ON e.id_empresa = u.id_empresa
    `;
    const params = [];
    if (!isAdmin) {
      if (isTecnico) {
        sql += ` WHERE u.id_empresa IN (SELECT te.id_empresa FROM tecnico_empresa te JOIN tecnico t ON t.id_tecnico = te.id_tecnico WHERE t.id_usuario = $1) `;
        params.push(uid);
      } else {
        sql += ` WHERE u.id_empresa = $1 `;
        params.push(id_empresa);
      }
    }
    sql += ' ORDER BY c.data_abertura DESC LIMIT 200';
    const { rows } = await pool.query(sql, params);
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ erro: e.message });
  }
});

router.post('/', async (req, res) => {
  const uid = req.user.sub;
  const { titulo, descricao, id_categoria, id_prioridade, id_hardware_rel, id_software_rel } = req.body || {};
  if (!titulo || !descricao || !id_categoria || !id_prioridade) return res.status(400).json({ erro: 'Campos obrigatórios faltando.' });

  const client = await pool.connect();
  try {
    const st = await client.query("SELECT id_status FROM status_chamado WHERE codigo = 'ABERTO' LIMIT 1");
    const { rows } = await client.query(
      `SELECT sp_abrir_chamado($1::int, $2::int, $3::int, $4::int, $5::varchar, $6::text, $7::int, $8::int) AS id_chamado`,
      [uid, id_categoria, id_prioridade, st.rows[0].id_status, titulo, descricao, id_hardware_rel || null, id_software_rel || null]
    );
    return res.status(201).json({ id_chamado: rows[0].id_chamado });
  } catch (e) {
    return res.status(400).json({ erro: e.message });
  } finally {
    client.release();
  }
});

router.post('/:id/resolver', requirePerfil('ADMIN', 'TECNICO'), async (req, res) => {
  const idChamado = parseInt(req.params.id, 10);
  const { solucao } = req.body || {};
  try {
    const st = await pool.query("SELECT id_status FROM status_chamado WHERE codigo = 'RESOLVIDO' LIMIT 1");
    await pool.query(`SELECT sp_registrar_resolucao($1::int, $2::text, $3::int, $4::int)`, [idChamado, solucao, st.rows[0].id_status, req.user.sub]);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(400).json({ erro: e.message });
  }
});

router.post('/:id/fechar', requirePerfil('ADMIN', 'TECNICO', 'EMPRESA_ADMIN', 'SOLICITANTE'), async (req, res) => {
  const idChamado = parseInt(req.params.id, 10);
  try {
    const st = await pool.query("SELECT id_status FROM status_chamado WHERE codigo = 'FECHADO' LIMIT 1");
    await pool.query(`SELECT sp_fechar_chamado($1::int, $2::int, $3::int)`, [idChamado, st.rows[0].id_status, req.user.sub]);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(400).json({ erro: e.message });
  }
});

router.post('/:id/atribuir', requirePerfil('ADMIN', 'TECNICO'), async (req, res) => {
  const idChamado = parseInt(req.params.id, 10);
  let { id_tecnico } = req.body || {};
  const uid = req.user.sub;
  const isAdmin = (req.user.perfis || []).includes('ADMIN');

  try {
    const ch = await pool.query('SELECT id_tecnico FROM chamado WHERE id_chamado = $1', [idChamado]);
    if (ch.rows.length === 0) return res.status(404).json({erro: 'Chamado não encontrado.'});
    
    if (!isAdmin && ch.rows[0].id_tecnico != null && ch.rows[0].id_tecnico != id_tecnico) {
      return res.status(403).json({erro: 'Este chamado já está atribuído. Apenas administradores podem alterar ou remover a atribuição.'});
    }

    if (!isAdmin) {
      const tec = await pool.query('SELECT id_tecnico FROM tecnico WHERE id_usuario = $1', [uid]);
      if (tec.rows.length === 0) return res.status(403).json({erro: 'Você não tem registro de técnico ativo.'});
      id_tecnico = tec.rows[0].id_tecnico;
    }

    await pool.query(`SELECT sp_atribuir_tecnico($1::int, $2::int, $3::int)`, [idChamado, id_tecnico, uid]);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(400).json({ erro: e.message });
  }
});

module.exports = router;
