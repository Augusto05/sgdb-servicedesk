require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

async function check() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'chamado'");
    console.log('Columns in table "chamado":');
    res.rows.forEach(r => console.log('- ' + r.column_name));
    await client.end();
  } catch (e) {
    console.error(e);
  }
}
check();
