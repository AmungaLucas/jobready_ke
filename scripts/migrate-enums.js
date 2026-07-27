/**
 * migrate-enums.js
 * Adds the 10 new JobFunction enum values to the production MySQL/MariaDB database.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ENUM_TABLES = ['Job', 'WorkExperienceCluster'];

const NEW_ENUM_VALUES = [
  'engineering', 'finance', 'marketing', 'sales', 'operations',
  'human_resources', 'technology', 'design', 'customer_service',
  'healthcare', 'education', 'legal',
  'agriculture', 'construction', 'hospitality', 'transport',
  'security', 'community_social', 'manufacturing', 'government',
  'consulting', 'environment',
];

async function migrate() {
  try {
    await prisma.$connect();
    console.log('Connected to database.\n');

    for (const table of ENUM_TABLES) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'function'`,
        table,
      );

      if (rows.length === 0) {
        console.log(`Table ${table}: no 'function' column found — skipping.`);
        continue;
      }

      const currentEnum = rows[0].COLUMN_TYPE;
      console.log(`Table ${table}: current type = ${currentEnum}`);

      if (currentEnum.includes('agriculture')) {
        console.log(`  → Already migrated. Skipping.\n`);
        continue;
      }

      const enumStr = NEW_ENUM_VALUES.map(v => `'${v}'`).join(', ');
      const sql = `ALTER TABLE \`${table}\` MODIFY COLUMN \`function\` ENUM(${enumStr}) NOT NULL`;
      console.log(`  → Running ALTER TABLE...`);

      await prisma.$executeRawUnsafe(sql);
      console.log(`  → Done. ${table}.function now has ${NEW_ENUM_VALUES.length} values.\n`);
    }

    // Verify
    console.log('Verification:');
    for (const table of ENUM_TABLES) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'function'`,
        table,
      );
      if (rows.length > 0) {
        console.log(`  ${table}.function: ${rows[0].COLUMN_TYPE}`);
      }
    }

    console.log('\n✅ Migration complete.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
