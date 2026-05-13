require('dotenv').config();
const { pool } = require('../server/db');

async function check() {
  try {
    console.log('--- USERS ---');
    const users = await pool.query(`
      SELECT u.id_usuario, u.nome_usuario, u.email, 
             array_agg(p.codigo) as perfis
      FROM usuario u
      LEFT JOIN usuario_perfil up ON up.id_usuario = u.id_usuario
      LEFT JOIN perfil p ON p.id_perfil = up.id_perfil
      GROUP BY u.id_usuario
    `);
    console.table(users.rows);

    console.log('--- CHAMADOS ---');
    const chamados = await pool.query(`SELECT id_chamado, titulo, id_solicitante FROM chamado`);
    console.table(chamados.rows);

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit();
  }
}

check();
