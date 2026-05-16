require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    console.log('Connected to DB. Applying migration...');
    const sql = fs.readFileSync(path.join(__dirname, '..', 'sql', '09_simplify_schema.sql'), 'utf8');
    await client.query(sql);
    console.log('Migration applied successfully.');
    await client.end();
  } catch (e) {
    console.error('Migration failed:', e);
    process.exit(1);
  }
}
migrate();
