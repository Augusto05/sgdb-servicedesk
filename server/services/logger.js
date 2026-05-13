const { pool } = require('../db');

/**
 * Registra um evento no log do sistema (tabela sistema_log)
 * @param {string} nivel - 'INFO', 'WARN', 'ERROR', 'CRITICAL'
 * @param {string} modulo - 'BACKUP', 'AUTH', 'SYSTEM', 'DATABASE'
 * @param {string} mensagem - Mensagem descritiva
 * @param {object} detalhes - Objeto JSON com detalhes do evento
 */
async function sysLog(nivel, modulo, mensagem, detalhes = {}) {
  try {
    await pool.query(
      `INSERT INTO sistema_log (nivel, modulo, mensagem, detalhes) VALUES ($1, $2, $3, $4)`,
      [nivel, modulo, mensagem, JSON.stringify(detalhes)]
    );
  } catch (e) {
    // Fallback: se o banco estiver fora, logar no console
    console.error(`[FALHA AO LOGAR NO BD] ${nivel} [${modulo}]: ${mensagem}`, e);
  }
}

module.exports = { sysLog };
