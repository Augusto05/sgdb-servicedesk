const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { sysLog } = require('./logger');

const backupsDir = path.join(__dirname, '..', '..', 'backups');

// Garantir que a pasta existe
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

const { pool } = require('../db');

/**
 * Executa um backup lógico leve exportando tabelas principais para JSON.
 */
function runBackup(manual = false) {
  return new Promise(async (resolve, reject) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `sgdb_backup_${timestamp}.json`;
    const filePath = path.join(backupsDir, fileName);
    const start = Date.now();
    
    sysLog('INFO', 'BACKUP', `Iniciando backup ${manual ? 'manual' : 'agendado'} (modo JSON leve)`, { arquivo: fileName });

    try {
      const backupData = {
        metadata: { gerado_em: new Date(), versao_sgdb: "1.0.0" },
        data: {}
      };

      const tables = ['empresa', 'usuario', 'inventario', 'chamado', 'sistema_log'];
      
      for (const table of tables) {
        const res = await pool.query(`SELECT * FROM ${table}`);
        backupData.data[table] = res.rows;
      }

      fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));

      const duration = Date.now() - start;
      const stats = fs.statSync(filePath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

      sysLog('INFO', 'BACKUP', 'Backup concluído com sucesso', { arquivo: fileName, tamanho_mb: sizeMB, duration_ms: duration });
      resolve({ fileName, filePath, sizeMB });
    } catch (error) {
      const duration = Date.now() - start;
      console.error('Backup Error:', error);
      sysLog('ERROR', 'BACKUP', 'Falha ao executar backup lógico', { erro: error.message, duration_ms: duration });
      reject(error);
    }
  });
}

/**
 * Executa um backup SQL Nativo extraindo estrutura e dados (DUMP).
 */
function runSqlBackup(manual = false) {
  return new Promise(async (resolve, reject) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `sgdb_backup_${timestamp}.sql`;
    const filePath = path.join(backupsDir, fileName);
    const start = Date.now();
    
    sysLog('INFO', 'BACKUP', `Iniciando backup ${manual ? 'manual' : 'agendado'} (modo Raw SQL)`, { arquivo: fileName });

    try {
      let sqlDump = `-- SGDB Raw SQL Dump\n-- Gerado em: ${new Date().toISOString()}\n\n`;

      // 1. Estrutura das tabelas (Schema)
      const sqlDir = path.join(__dirname, '..', '..', 'sql');
      const schemaFiles = ['01_schema.sql', '02_functions.sql', '03_triggers.sql', '04_security.sql', '06_unified_inventory.sql', '07_db_management.sql'];
      
      sqlDump += `-- ==========================================\n`;
      sqlDump += `-- ESTRUTURA DO BANCO (DDL) E REGRAS (SGBD)\n`;
      sqlDump += `-- ==========================================\n\n`;

      for (const file of schemaFiles) {
        const fullPath = path.join(sqlDir, file);
        if (fs.existsSync(fullPath)) {
           sqlDump += `-- Arquivo: ${file}\n`;
           sqlDump += fs.readFileSync(fullPath, 'utf8') + '\n\n';
        }
      }

      sqlDump += `-- ==========================================\n`;
      sqlDump += `-- EXPORTAÇÃO DE DADOS (DML)\n`;
      sqlDump += `-- ==========================================\n\n`;

      // 2. Extração de Dados
      // A ordem importa devido a chaves estrangeiras (Empresa -> Usuario -> Inventario/Chamado)
      const tables = ['empresa', 'usuario', 'inventario', 'chamado', 'chamado_historico', 'sistema_log'];
      
      for (const table of tables) {
        const res = await pool.query(`SELECT * FROM ${table}`);
        if (res.rows.length === 0) continue;

        sqlDump += `-- Dados da tabela: ${table}\n`;
        const columns = Object.keys(res.rows[0]);
        
        for (const row of res.rows) {
          const values = columns.map(col => {
            const val = row[col];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'number') return val;
            if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
            if (val instanceof Date) return `'${val.toISOString()}'`;
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`; // JSONB
            // Strings: escape single quotes
            return `'${String(val).replace(/'/g, "''")}'`;
          });
          
          sqlDump += `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
        }
        sqlDump += '\n';
      }

      fs.writeFileSync(filePath, sqlDump);

      const duration = Date.now() - start;
      const stats = fs.statSync(filePath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

      sysLog('INFO', 'BACKUP', 'Backup SQL concluído com sucesso', { arquivo: fileName, tamanho_mb: sizeMB, duration_ms: duration });
      resolve({ fileName, filePath, sizeMB });
    } catch (error) {
      const duration = Date.now() - start;
      console.error('Backup Error:', error);
      sysLog('ERROR', 'BACKUP', 'Falha ao executar backup Raw SQL', { erro: error.message, duration_ms: duration });
      reject(error);
    }
  });
}

/**
 * Lista os arquivos de backup
 */
function listBackups() {
  if (!fs.existsSync(backupsDir)) return [];
  const files = fs.readdirSync(backupsDir).filter(f => f.startsWith('sgdb_backup_'));
  return files.map(f => {
    const stats = fs.statSync(path.join(backupsDir, f));
    return {
      name: f,
      sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
      createdAt: stats.mtime
    };
  }).sort((a, b) => b.createdAt - a.createdAt);
}

module.exports = { runBackup, runSqlBackup, listBackups, backupsDir };
