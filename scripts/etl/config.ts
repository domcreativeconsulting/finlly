import 'dotenv/config';
import { config as configDotenv } from 'dotenv';

configDotenv({
  path: '.env.local', // ← EXPLICITAMENTE CARREGAR .env.local
});

// ---------------------------------------------------------------------------
// CLI flag parsing
// ---------------------------------------------------------------------------

export interface CliFlags {
  /** Run only these tables (comma-separated via --tables=a,b,c). */
  tables?: string[];
  /** Only migrate records created/updated on or after this date (--since=YYYY-MM-DD). */
  since?: Date;
  /** Reset (truncate) the target schema before migrating (--reset). */
  reset: boolean;
  /** Required companion to --reset to prevent accidental data loss (--force). */
  force: boolean;
}

function parseCliFlags(): CliFlags {
  const args = process.argv.slice(2);
  const flags: CliFlags = { reset: false, force: false };

  for (const arg of args) {
    if (arg.startsWith('--tables=')) {
      flags.tables = arg
        .slice('--tables='.length)
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    } else if (arg.startsWith('--since=')) {
      const dateStr = arg.slice('--since='.length);
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        flags.since = d;
      } else {
        console.warn(`   ⚠️  --since value "${dateStr}" is not a valid date — ignoring`);
      }
    } else if (arg === '--reset') {
      flags.reset = true;
    } else if (arg === '--force') {
      flags.force = true;
    }
  }

  return flags;
}

export const cliFlags = parseCliFlags();

export const config = {
  mysql: {
    host: process.env['LEGACY_MYSQL_HOST'] ?? 'localhost',
    port: parseInt(process.env['LEGACY_MYSQL_PORT'] ?? '3306', 10),
    user: process.env['LEGACY_MYSQL_USER'] ?? 'finlly_go',
    password: process.env['LEGACY_MYSQL_PASSWORD'],
    database: process.env['LEGACY_MYSQL_DATABASE'] ?? 'finlly_go',
    connectTimeout: 10000,
  },
  postgres: {
    connectionString: process.env['DATABASE_URL'] ?? '',
  },
  etl: {
    batchSize: parseInt(process.env['ETL_BATCH_SIZE'] ?? '1000', 10),
    dryRun: process.env['ETL_DRY_RUN'] === 'true',
    validateSamples: process.env['ETL_VALIDATE_SAMPLES'] !== 'false',
    sampleSize: 15,
    transactionTimeout: parseInt(process.env['ETL_TRANSACTION_TIMEOUT_MS'] ?? '120000', 10),
  },
};

export type EtlConfig = typeof config;
