const express = require('express');
const { pool } = require('../db');
const { requirePerfil } = require('../middleware/auth');

const router = express.Router();

/**
 * Retorna estatísticas resumidas para o Dashboard Home (Admin Global)
 */
router.get('/stats', requirePerfil('ADMIN'), async (req, res) => {
  try {
    const stats = {};

    // 1. Totais básicos
    const totals = await pool.query(`
      SELECT 
        (SELECT count(*) FROM chamado) as chamados_total,
        (SELECT count(*) FROM chamado c JOIN status_chamado s ON s.id_status = c.id_status WHERE s.codigo = 'ABERTO') as chamados_abertos,
        (SELECT count(*) FROM chamado c JOIN status_chamado s ON s.id_status = c.id_status WHERE s.codigo = 'EM_ATENDIMENTO') as chamados_em_atendimento,
        (SELECT count(*) FROM usuario) as usuarios_total,
        (SELECT count(*) FROM empresa) as empresas_total,
        (SELECT count(*) FROM inventario) as ativos_total,
        (SELECT count(*) FROM chamado_historico WHERE tipo_evento = 'SLA_CHANGE_REQ') as sla_pendentes
    `);
    stats.totals = totals.rows[0];

    // 2. Chamados por Status (para gráfico)
    const byStatus = await pool.query(`
      SELECT s.codigo as label, count(*) as value 
      FROM chamado c
      JOIN status_chamado s ON s.id_status = c.id_status
      GROUP BY s.codigo
    `);
    stats.byStatus = byStatus.rows;

    // 3. Técnicos com carga de trabalho
    const technicians = await pool.query(`
      SELECT u.nome_usuario as nome, t.especialidade, count(c.id_chamado) as chamados_ativos
      FROM tecnico t
      JOIN usuario u ON u.id_usuario = t.id_usuario
      LEFT JOIN chamado c ON c.id_tecnico = t.id_tecnico AND c.id_status IN (SELECT id_status FROM status_chamado WHERE codigo IN ('ABERTO', 'EM_ATENDIMENTO'))
      WHERE t.ativo = TRUE
      GROUP BY u.nome_usuario, t.especialidade
      ORDER BY chamados_ativos DESC
      LIMIT 5
    `);
    stats.technicians = technicians.rows;

    // 4. Patrimônios em Manutenção ou Críticos
    const assets = await pool.query(`
      SELECT i.nome_modelo as modelo, e.nome_fantasia as empresa, i.status
      FROM inventario i
      JOIN empresa e ON e.id_empresa = i.id_empresa
      WHERE i.status = 'MANUTENCAO' OR i.status = 'REPARO'
      ORDER BY i.criado_em DESC
      LIMIT 5
    `);
    stats.criticalAssets = assets.rows;

    // 5. Últimos Chamados Abertos
    const recent = await pool.query(`
      SELECT c.id_chamado, c.titulo, s.codigo as status_codigo, u.nome_usuario as solicitante, e.nome_fantasia as empresa, c.data_abertura
      FROM chamado c
      JOIN status_chamado s ON s.id_status = c.id_status
      JOIN usuario u ON u.id_usuario = c.id_solicitante
      JOIN empresa e ON e.id_empresa = u.id_empresa
      ORDER BY c.data_abertura DESC
      LIMIT 8
    `);
    stats.recentTickets = recent.rows;

    res.json(stats);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
