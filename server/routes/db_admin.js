const express = require('express');
const { pool } = require('../db');
const { requirePerfil } = require('../middleware/auth');
const { runBackup, listBackups, backupsDir } = require('../services/backup');
const path = require('path');
const fs = require('fs');

const router = express.Router();
router.use(requirePerfil('ADMIN')); // Apenas admin global tem acesso ao BD

// Retorna as métricas do BD (Painel)
router.get('/metrics', async (req, res) => {
  try {
    const metrics = {};

    // 1. Tamanho do Banco
    const sizeRes = await pool.query("SELECT pg_size_pretty(pg_database_size('sgdb')) as size");
    metrics.tamanho = sizeRes.rows[0].size;

    // 2. Conexões Ativas
    const connRes = await pool.query("SELECT count(*) as count FROM pg_stat_activity WHERE datname = 'sgdb'");
    metrics.conexoes_ativas = connRes.rows[0].count;

    // 3. Status
    metrics.status = 'Online';

    // 4. Último Backup
    const files = listBackups();
    metrics.ultimo_backup = files.length > 0 ? files[0].createdAt : null;

    // 5. Total de Registros nas tabelas principais
    const chamadosCount = await pool.query('SELECT count(*) FROM chamado');
    const logsCount = await pool.query('SELECT count(*) FROM sistema_log');
    metrics.total_chamados = chamadosCount.rows[0].count;
    metrics.total_logs = logsCount.rows[0].count;

    // 6. Cache Hit Ratio
    try {
      const cacheRes = await pool.query(`SELECT sum(blks_hit)*100/nullif(sum(blks_hit+blks_read), 0) as ratio FROM pg_stat_database WHERE datname='sgdb'`);
      metrics.cache_hit_ratio = cacheRes.rows[0].ratio ? parseFloat(cacheRes.rows[0].ratio).toFixed(2) : '100.00';
    } catch(e) { metrics.cache_hit_ratio = 'N/A'; }

    // 7. Dead Tuples (Top 5)
    try {
      const deadRes = await pool.query(`SELECT relname, n_dead_tup FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 5`);
      metrics.dead_tuples = deadRes.rows;
    } catch(e) { metrics.dead_tuples = []; }

    // 8. Últimas Queries (Ativas ou recentes)
    try {
      const queriesRes = await pool.query(`
        SELECT pid, state, query, extract(epoch from (now() - query_start)) as duration 
        FROM pg_stat_activity 
        WHERE state != 'idle' AND query NOT ILIKE '%pg_stat_activity%' AND datname='sgdb'
        ORDER BY duration DESC LIMIT 5
      `);
      metrics.ultimas_queries = queriesRes.rows;
    } catch(e) { metrics.ultimas_queries = []; }

    res.json(metrics);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Retorna os últimos logs do sistema
router.get('/logs', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id_log, nivel, modulo, mensagem, criado_em 
      FROM sistema_log 
      ORDER BY criado_em DESC 
      LIMIT 100
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Lista Backups
router.get('/backups', (req, res) => {
  try {
    const files = listBackups();
    res.json(files);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Dispara Backup JSON
router.post('/backup/trigger', async (req, res) => {
  try {
    const result = await runBackup(true);
    res.json({ ok: true, file: result.fileName });
  } catch (e) {
    res.status(500).json({ erro: 'Falha ao gerar backup JSON. Verifique os logs.' });
  }
});

// Dispara Backup SQL Nativo
router.post('/backup/sql/trigger', async (req, res) => {
  try {
    // A função runSqlBackup() foi exportada no 'backup.js'
    const { runSqlBackup } = require('../services/backup');
    const result = await runSqlBackup(true);
    res.json({ ok: true, file: result.fileName });
  } catch (e) {
    res.status(500).json({ erro: 'Falha ao gerar backup SQL. Verifique os logs.' });
  }
});

// Download de Backup
router.get('/backup/download/:file', (req, res) => {
  const file = req.params.file;
  if (!file.startsWith('sgdb_backup_')) {
    return res.status(400).send('Invalid file');
  }
  const filePath = path.join(backupsDir, file);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Backup not found');
  }
  res.download(filePath);
});

module.exports = router;
