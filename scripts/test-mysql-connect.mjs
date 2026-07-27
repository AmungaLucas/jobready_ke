// Direct MySQL connection test using mysql2
import mysql from 'mysql2/promise';

const baseOpts = {
  host: 'd7.my-control-panel.com',
  port: 3306,
  user: 'jobready_intel_admin',
  password: 'Admincyber',
  database: 'jobready_intel',
  connectTimeout: 15000,
};

async function tryConnection(label, extra = {}) {
  const opts = { ...baseOpts, ...extra };
  console.log(`\n[${label}] trying...`);
  const conn = await mysql.createConnection(opts);
  try {
    const [v] = await conn.query('SELECT VERSION() AS v, CURRENT_USER() AS u, DATABASE() AS d');
    console.log(`[${label}] OK:`, JSON.stringify(v));
    const [tables] = await conn.query("SHOW TABLES");
    console.log(`[${label}] existing tables:`, tables.length);
    if (tables.length) console.log(`[${label}] first table:`, JSON.stringify(tables[0]));
  } finally {
    await conn.end();
  }
}

(async () => {
  // 1. Plain (no SSL)
  try {
    await tryConnection('plain');
  } catch (e) {
    console.log('[plain] FAIL:', e.code || e.name, '-', e.message);
  }

  // 2. With SSL, accept invalid certs (self-signed)
  try {
    await tryConnection('ssl-accept-invalid', { ssl: { rejectUnauthorized: false } });
  } catch (e) {
    console.log('[ssl-accept-invalid] FAIL:', e.code || e.name, '-', e.message);
  }

  // 3. With SSL required
  try {
    await tryConnection('ssl-required', { ssl: { rejectUnauthorized: true } });
  } catch (e) {
    console.log('[ssl-required] FAIL:', e.code || e.name, '-', e.message);
  }
})().catch(e => { console.error('top-level error:', e); process.exit(1); });
