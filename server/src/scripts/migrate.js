import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../db/pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSqlFile(filePath) {
  const sql = await fs.readFile(filePath, 'utf8');
  await pool.query(sql);
  console.log(`Applied: ${path.basename(filePath)}`);
}

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGSERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function migrationApplied(filename) {
  const result = await pool.query(
    'SELECT 1 FROM schema_migrations WHERE filename = $1',
    [filename]
  );
  return Boolean(result.rowCount);
}

async function recordMigration(filename) {
  await pool.query(
    'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
    [filename]
  );
}

async function main() {
  const sqlDir = path.resolve(__dirname, '../../sql');
  await runSqlFile(path.join(sqlDir, 'schema.sql'));
  await ensureMigrationsTable();

  const migrationsDir = path.join(sqlDir, 'migrations');
  const migrationFiles = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  for (const filename of migrationFiles) {
    if (await migrationApplied(filename)) {
      console.log(`Skipped: ${filename}`);
      continue;
    }
    await runSqlFile(path.join(migrationsDir, filename));
    await recordMigration(filename);
  }

  console.log('All migrations applied');
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
