import { z } from 'zod';

const SENSITIVE_KEYS = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'ASAAS_API_KEY',
  'ASAAS_WEBHOOK_SECRET',
  'WA_TOKEN',
  'DATABASE_URL',
];

function maskValue(key, value) {
  if (!value) return value;
  if (key === 'DATABASE_URL') {
    return value.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
  }
  return `${value.slice(0, 4)}****`;
}

const envSchema = z.object({
  // API
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  APP_URL: z.string().url().default('http://localhost:5173'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // Auth - JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // Billing - Asaas (optional)
  ASAAS_ENV: z.enum(['sandbox', 'production']).optional(),
  ASAAS_API_KEY: z.string().optional(),
  ASAAS_WEBHOOK_SECRET: z.string().optional(),
  ASAAS_BASE_URL: z.string().url().optional(),

  // WhatsApp Agent (optional)
  WA_PROVIDER: z.string().optional(),
  WA_BASE_URL: z.string().url().optional(),
  WA_TOKEN: z.string().optional(),
  WA_PHONE_NUMBER_ID: z.string().optional(),

  // Rate Limiting (optional)
  RATE_LIMIT_STORE: z.enum(['memory', 'redis']).default('memory'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(600000),
});

function loadConfig(env = process.env) {
  const result = envSchema.safeParse(env);

  if (!result.success) {
    const messages = result.error.issues.map((e) => {
      const key = e.path.join('.');
      const isSensitive = SENSITIVE_KEYS.includes(key);
      return isSensitive
        ? `  - ${key}: ${e.message}`
        : `  - ${key}: ${e.message}`;
    });
    throw new Error(
      `[Config] Validation failed:\n${messages.join('\n')}\n\nPlease check your .env file.`
    );
  }

  return result.data;
}

export function getMaskedConfig(cfg) {
  return Object.fromEntries(
    Object.entries(cfg).map(([key, value]) => [
      key,
      SENSITIVE_KEYS.includes(key) && typeof value === 'string'
        ? maskValue(key, value)
        : value,
    ])
  );
}

export const config = loadConfig();
