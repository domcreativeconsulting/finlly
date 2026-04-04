import { z } from 'zod';

const envSchema = z.object({
  // API
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  APP_URL: z.string().url().default('http://localhost:5173'),
  CORS_ORIGINS: z.string().optional(), // ex: "https://app.finlly.com.br,https://finlly.com.br"

  // Database
  DATABASE_URL: z.string().min(1),

  // Redis
  REDIS_URL: z.string().min(1),

  // Auth
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // Billing - Asaas (optional)
  ASAAS_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
  ASAAS_API_KEY: z.string().optional(),
  ASAAS_WEBHOOK_SECRET: z.string().optional(),
  ASAAS_BASE_URL: z.preprocess((v) => v || undefined, z.string().url().optional()),
  ASAAS_TIMEOUT_MS: z.coerce.number().int().positive().default(10000), // 10000ms (10s) per attempt
  ASAAS_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(3), // max retries
  ASAAS_CB_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(5), // open after N consecutive full-retry failures
  ASAAS_CB_RESET_TIMEOUT_MS: z.coerce.number().int().positive().default(30000), // ms to wait before probing

  // WhatsApp Agent (optional)
  WA_PROVIDER: z.string().optional(),
  WA_BASE_URL: z.preprocess((v) => v || undefined, z.string().url().optional()),
  WA_TOKEN: z.string().optional(),
  WA_PHONE_NUMBER_ID: z.string().optional(),

  // Evolution API — WhatsApp (Story 12.1, optional)
  EVOLUTION_API_URL: z.preprocess((v) => v || undefined, z.string().url().optional()),
  EVOLUTION_API_KEY: z.string().optional(),
  EVOLUTION_INSTANCE: z.string().optional(),
  EVOLUTION_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  EVOLUTION_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  EVOLUTION_CB_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(5), // open after N consecutive full-retry failures
  EVOLUTION_CB_RESET_TIMEOUT_MS: z.coerce.number().int().positive().default(30000), // ms to wait before probing

  // Rate Limiting (optional)
  RATE_LIMIT_STORE: z.enum(['memory', 'redis']).default('memory'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(500),        // global limiter: max requests per window
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000), // global limiter: 15 minutes

  // Email (optional — emails are skipped when not configured)
  MAIL_HOST: z.string().optional(),
  MAIL_PORT: z.coerce.number().int().positive().default(587),
  MAIL_USER: z.string().optional(),
  MAIL_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().default('noreply@finlly.com'),

  // Password reset / email verification tokens
  PASSWORD_RESET_EXPIRATION: z.coerce.number().int().positive().default(900), // 15 minutes in seconds
  EMAIL_VERIFICATION_EXPIRATION: z.coerce.number().int().positive().default(86400), // 24 hours in seconds

  // Rate limiting for forgot-password and resend-verification
  FORGOT_PASSWORD_RATE_LIMIT: z.coerce.number().int().positive().default(3),
  FORGOT_PASSWORD_RATE_WINDOW: z.coerce.number().int().positive().default(3600), // 1 hour in seconds
  VERIFY_EMAIL_RATE_LIMIT: z.coerce.number().int().positive().default(3),
  VERIFY_EMAIL_RATE_WINDOW: z.coerce.number().int().positive().default(3600), // 1 hour in seconds

  // Reconciliation job
  RECONCILIACAO_INTERVAL_MS: z.coerce.number().int().positive().default(3600000), // 1 hour in ms

  // Daily bill summary job (Story 12.4)
  CONTAS_DIA_JOB_HOUR_UTC: z.coerce.number().int().min(0).max(23).default(8), // 08:00 UTC

  // Daily WhatsApp summary queue (Story 12.4.1)
  WHATSAPP_DIARIO_JOB_ATTEMPTS: z.coerce.number().int().positive().default(3),
  WHATSAPP_DIARIO_JOB_BACKOFF_DELAY_MS: z.coerce.number().int().positive().default(5000),
  WHATSAPP_DIARIO_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),

  // Billing status cache
  BILLING_STATUS_CACHE_TTL: z.coerce.number().int().positive().default(60), // seconds

  // EPIC 11 — Anexos & OCR
  UPLOADS_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().int().positive().default(10),
  OCR_PROVIDER: z.enum(['mock', 'google_vision', 'aws_textract']).default('mock'),
  OCR_JOB_INTERVAL_MS: z.coerce.number().int().positive().default(5000),

  // BullMQ / Attachment Worker
  ATTACHMENT_QUEUE_CONCURRENCY: z.coerce.number().int().positive().default(5),
  ATTACHMENT_JOB_ATTEMPTS: z.coerce.number().int().positive().default(3),
  ATTACHMENT_JOB_BACKOFF_DELAY_MS: z.coerce.number().int().positive().default(2000),
  ATTACHMENT_DLQ_QUEUE_NAME: z.string().default('attachment-processing-dlq'),

  // Storage — Driver configurável
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),

  // S3 / S3-compatible (obrigatório se STORAGE_DRIVER=s3)
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.preprocess((v) => v || undefined, z.string().min(1).optional()),
  S3_PUBLIC_BASE_URL: z.preprocess((v) => v || undefined, z.string().url().optional()),
});

/**
 * @typedef {z.infer<typeof envSchema>} Env
 */

function loadConfig() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const missing = result.error.issues.map((issue) => `- ${issue.path.join('.')}: ${issue.message}`);
    console.error('[ERROR] Configuration validation failed:');
    missing.forEach((msg) => console.error(msg));
    console.error('\nPlease check your .env file and ensure all required variables are set.');
    process.exit(1);
  }

  return result.data;
}

/** @type {Env} */
export const config = loadConfig();
