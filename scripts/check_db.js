require('dotenv').config();
const { pool } = require('../server/db');

async function check() {
  try {
    const res = await pool.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
    console.log('Tables:', res.rows.map(r => r.tablename));
    
    const invCount = await pool.query("SELECT COUNT(*) FROM inventario").catch(() => ({rows:[{count: 'Table missing'}]}));
    console.log('Inventario count:', invCount.rows[0].count);

    const userCount = await pool.query("SELECT COUNT(*) FROM usuario").catch(() => ({rows:[{count: 'Table missing'}]}));
    console.log('Usuario count:', userCount.rows[0].count);

    const chamadoCount = await pool.query("SELECT COUNT(*) FROM chamado").catch(() => ({rows:[{count: 'Table missing'}]}));
    console.log('Chamado count:', chamadoCount.rows[0].count);

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    process.exit();
  }
}

check();
