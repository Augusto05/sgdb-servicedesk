require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../server/db');

async function runMigration() {
  const sqlPath = path.join(__dirname, '../sql/06_unified_inventory.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  try {
    console.log('Running migration...');
    await pool.query(sql);
    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    pool.end();
  }
}

runMigration();
