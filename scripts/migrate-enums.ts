/**
 * migrate-enums.ts
 * Adds the 10 new JobFunction enum values to the MySQL/MariaDB production database.
 * Run: npx tsx scripts/migrate-enums.ts
 */

import mariadb from 'mariadb';

const DB_HOST = 'd7.my-control-panel.com';
const DB_PORT = 3306;
const DB_USER = 'jobready_intel_admin';
const DB_PASS = 'Admincyber';
const DB_NAME = 'jobready_intel';

// Tables that have a `function` column with the JobFunction enum
const ENUM_TABLES = ['Job', 'WorkExperienceCluster'];

// The full expanded enum
const NEW_ENUM_VALUES = [
  'engineering', 'finance', 'marketing', 'sales', 'operations',
  'human_resources', 'technology', 'design', 'customer_service',
  'healthcare', 'education', 'legal',
  // Kenya-market expansions
  'agriculture', 'construction', 'hospitality', 'transport',
  'security', 'community_social', 'manufacturing', 'government',
  'consulting', 'environment',
];

async function migrate() {
  let conn: mariadb.Connection | null = null;

  try {
    console.log(`Connecting to ${DB_HOST}:${DB_PORT}/${DB_NAME}...`);
    conn = await mariadb.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASS,
      database: DB_NAME,
      connectTimeout: 15000,
    });
    console.log('Connected.\n');

    // 1. Check current enum values
    for (const table of ENUM_TABLES) {
      const rows = await conn.query(
        `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'function'`,
        [DB_NAME, table],
      ) as any[];

      if (rows.length === 0) {
        console.log(`Table ${table}: no 'function' column found — skipping.`);
        continue;
      }

      const currentEnum = (rows[0].COLUMN_TYPE as string);
      console.log(`Table ${table}: current type = ${currentEnum}`);

      // Check if already has the new values
      if (currentEnum.includes('agriculture')) {
        console.log(`  → Already migrated. Skipping.\n`);
        continue;
      }

      // 2. ALTER TABLE to add new enum values
      const enumStr = NEW_ENUM_VALUES.map(v => `'${v}'`).join(', ');
      const sql = `ALTER TABLE \`${table}\` MODIFY COLUMN \`function\` ENUM(${enumStr}) NOT NULL`;
      console.log(`  → Running ALTER TABLE...`);

      await conn.query(sql);
      console.log(`  → Done. ${table}.function now has ${NEW_ENUM_VALUES.length} values.\n`);
    }

    // 3. Verify
    console.log('Verification:');
    for (const table of ENUM_TABLES) {
      const rows = await conn.query(
        `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = 'function'`,
        [DB_NAME, table],
      ) as any[];
      if (rows.length > 0) {
        console.log(`  ${table}.function: ${rows[0].COLUMN_TYPE}`);
      }
    }

    console.log('\nMigration complete.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

migrate();
