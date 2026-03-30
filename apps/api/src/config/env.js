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

  // WhatsApp Agent (optional)
  WA_PROVIDER: z.string().optional(),
  WA_BASE_URL: z.preprocess((v) => v || undefined, z.string().url().optional()),
  WA_TOKEN: z.string().optional(),
  WA_PHONE_NUMBER_ID: z.string().optional(),

  // Rate Limiting (optional)
  RATE_LIMIT_STORE: z.enum(['memory', 'redis']).default('memory'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(600000),

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

  // Billing status cache
  BILLING_STATUS_CACHE_TTL: z.coerce.number().int().positive().default(60), // seconds
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
