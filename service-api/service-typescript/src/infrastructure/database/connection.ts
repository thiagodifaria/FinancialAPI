import postgres from 'postgres';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function postgresOptions(): postgres.Options<Record<string, postgres.PostgresType>> {
  const options: postgres.Options<Record<string, postgres.PostgresType>> = {
    max: Number(process.env.DB_POOL_MAX) || 10,
  };

  if (process.env.DB_SSL === 'true' || process.env.DATABASE_URL?.includes('sslmode=require')) {
    options.ssl = 'require';
  }

  return options;
}

// Configuração central da conexão com o PostgreSQL.
const sql = process.env.DATABASE_URL
  ? postgres(process.env.DATABASE_URL, postgresOptions())
  : postgres({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'financial_api',
      username: process.env.DB_USER || 'ledger_runtime',
      password: process.env.DB_PASSWORD || 'ledger_runtime_password',
      ...postgresOptions(),
    });

export type SqlExecutor = postgres.Sql | postgres.TransactionSql;

/**
 * Sistema simples de migração automática
 * Deve ser usado apenas em desenvolvimento local ou por um job com credenciais de migration.
 */
export async function runMigrations() {
  const migrationsPath = resolveMigrationsPath();
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      duration_ms INTEGER NOT NULL
    )
  `;

  const files = fs
    .readdirSync(migrationsPath)
    .filter((file) => file.endsWith('.sql'))
    .sort((left, right) => left.localeCompare(right));

  for (const file of files) {
    const schemaPath = path.join(migrationsPath, file);
    const schema = fs.readFileSync(schemaPath, 'utf8');
    const checksum = crypto.createHash('sha256').update(schema).digest('hex');
    const [applied] = await sql<{ checksum: string }[]>`
      SELECT checksum FROM schema_migrations WHERE version = ${file}
    `;

    if (applied) {
      if (applied.checksum !== checksum) {
        throw new Error(`Migration ${file} foi alterada depois de aplicada`);
      }
      continue;
    }

    const started = Date.now();
    await sql.begin(async (sqlTx) => {
      await sqlTx.unsafe(schema);
      await sqlTx`
        INSERT INTO schema_migrations (version, name, checksum, duration_ms)
        VALUES (${file}, ${file.replace(/^\d+_?/, '').replace(/\.sql$/, '')}, ${checksum}, ${Date.now() - started})
      `;
    });
  }
}

function resolveMigrationsPath(): string {
  const candidates = [
    process.env.MIGRATIONS_PATH,
    path.resolve(__dirname, '../../../../service-postgresql/migrations'),
    path.resolve(process.cwd(), 'service-postgresql/migrations'),
    path.resolve(process.cwd(), 'migrations'),
  ].filter((candidate): candidate is string => Boolean(candidate));

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error('Diretório de migrations não encontrado');
  return found;
}

export async function checkDatabase(): Promise<void> {
  await sql`SELECT 1`;
}

export default sql;
