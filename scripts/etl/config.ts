import 'dotenv/config';
import { config as configDotenv } from 'dotenv';

configDotenv({
  path: '.env.local', // ← EXPLICITAMENTE CARREGAR .env.local
});

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
  },
};

export type EtlConfig = typeof config;
