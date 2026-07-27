// Verify remote MySQL DB: list all tables and their row counts
import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: '/home/z/my-project/.env' });

const url = new URL(process.env.DATABASE_URL);
const conn = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port),
  user: url.username,
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  connectTimeout: 30000,
});

console.log('Connected to:', url.hostname, '/', url.pathname.slice(1));
console.log('Server version:', (await conn.query('SELECT VERSION() v'))[0][0].v);
console.log('');

const [tables] = await conn.query(
  `SELECT TABLE_NAME, TABLE_ROWS, ENGINE, TABLE_COLLATION
   FROM information_schema.TABLES
   WHERE TABLE_SCHEMA = ?
   ORDER BY TABLE_NAME`,
  [url.pathname.slice(1)]
);

console.log('Tables created:');
for (const t of tables) {
  console.log(`  - ${t.TABLE_NAME.padEnd(28)} rows=${String(t.TABLE_ROWS).padStart(4)}  engine=${t.ENGINE}`);
}
console.log(`\nTotal tables: ${tables.length}`);

// Verify enum columns are real MySQL ENUMs
const [enums] = await conn.query(
  `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE
   FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = ? AND DATA_TYPE = 'enum'
   ORDER BY TABLE_NAME, COLUMN_NAME`,
  [url.pathname.slice(1)]
);
console.log(`\nENUM columns (${enums.length}):`);
for (const e of enums.slice(0, 6)) {
  console.log(`  - ${e.TABLE_NAME}.${e.COLUMN_NAME}  ${e.COLUMN_TYPE}`);
}
if (enums.length > 6) console.log(`  ... and ${enums.length - 6} more`);

// Verify TEXT columns for description / rawInput
const [textCols] = await conn.query(
  `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE
   FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = ? AND DATA_TYPE IN ('text','longtext')
   ORDER BY TABLE_NAME, COLUMN_NAME`,
  [url.pathname.slice(1)]
);
console.log(`\nTEXT/LONGTEXT columns (${textCols.length}):`);
for (const c of textCols) {
  console.log(`  - ${c.TABLE_NAME}.${c.COLUMN_NAME.padEnd(28)}  ${c.COLUMN_TYPE}`);
}

await conn.end();
