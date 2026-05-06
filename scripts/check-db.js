/**
 * Testa a ligação ao PostgreSQL usando DATABASE_URL do .env
 * Uso: npm run check-db
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Client } = require('pg');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL não está definido no ficheiro .env');
  process.exit(1);
}

function redact(u) {
  try {
    const x = new URL(u.replace(/^postgres(ql)?:/i, 'http:'));
    if (x.password) x.password = '***';
    return x.toString().replace(/^http:/i, 'postgres:');
  } catch {
    return '(URL inválida)';
  }
}

async function main() {
  console.log('URL (senha oculta):', redact(url));
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    const r = await client.query('SELECT current_database() AS db, current_user AS usr, version() AS v');
    console.log('\nLigação OK.');
    console.log('  Base:', r.rows[0].db);
    console.log('  Utilizador:', r.rows[0].usr);
    console.log('  Versão:', String(r.rows[0].v).split('\n')[0]);
    await client.end();
    process.exit(0);
  } catch (e) {
    console.error('\nFalhou:', e.code || '', e.message);
    console.error('\n--- O que verificar (Windows) ---');
    console.error('1. Serviço PostgreSQL a correr:');
    console.error('   Win+R → services.msc → procure "postgresql" → Iniciar');
    console.error('2. Porta: no .env use a porta real (muitas vezes 5432). Instalador às vezes usa 5433.');
    console.error('3. Em vez de localhost experimente 127.0.0.1 na DATABASE_URL.');
    console.error('4. Utilizador/senha: o role sgdb_app tem de existir e a senha tem de coincidir com o .env');
    console.error('   (ver sql/04_security.sql ou: ALTER ROLE sgdb_app PASSWORD \'...\';)');
    console.error('5. A base "sgdb" tem de existir (CREATE DATABASE sgdb;) e os scripts sql/*.sql aplicados.\n');
    process.exit(1);
  }
}

main();
