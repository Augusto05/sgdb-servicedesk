require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    console.log('Connected to DB. Re-applying knowledge base migration...');
    await client.query("DROP TABLE IF EXISTS base_conhecimento CASCADE;");
    const sql = fs.readFileSync(path.join(__dirname, '..', 'sql', '10_knowledge_base_and_dashboard.sql'), 'utf8');
    await client.query(sql);
    console.log('Migration re-applied successfully with UTF-8.');
    await client.end();
  } catch (e) {
    console.error('Migration failed:', e);
    process.exit(1);
  }
}
migrate();
