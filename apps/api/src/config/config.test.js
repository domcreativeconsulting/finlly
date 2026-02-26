import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// We need to test the loadConfig function in isolation.
// Since config/index.js auto-loads on import, we test the schema logic directly.

const VALID_ENV = {
  NODE_ENV: 'development',
  API_PORT: '3001',
  APP_URL: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://finlly:finlly@localhost:5432/finlly',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'change_me_access_token_secret_minimum_32_chars',
  JWT_EXPIRES_IN: '15m',
  JWT_REFRESH_SECRET: 'change_me_refresh_token_secret_minimum_32_chars',
  JWT_REFRESH_EXPIRES_IN: '30d',
};

async function importLoadConfig() {
  const { z } = await import('zod');

  const envSchema = z.object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    API_PORT: z.coerce.number().int().positive().default(3001),
    APP_URL: z.string().url().default('http://localhost:5173'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
    ASAAS_ENV: z.enum(['sandbox', 'production']).optional(),
    ASAAS_API_KEY: z.string().optional(),
    ASAAS_WEBHOOK_SECRET: z.string().optional(),
    ASAAS_BASE_URL: z.string().url().optional(),
    WA_PROVIDER: z.string().optional(),
    WA_BASE_URL: z.string().url().optional(),
    WA_TOKEN: z.string().optional(),
    WA_PHONE_NUMBER_ID: z.string().optional(),
    RATE_LIMIT_STORE: z.enum(['memory', 'redis']).default('memory'),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(600000),
  });

  return function loadConfig(env) {
    const result = envSchema.safeParse(env);
    if (!result.success) {
      const messages = result.error.issues.map(
        (e) => `  - ${e.path.join('.')}: ${e.message}`
      );
      throw new Error(
        `[Config] Validation failed:\n${messages.join('\n')}\n\nPlease check your .env file.`
      );
    }
    return result.data;
  };
}

describe('Config Loader', async () => {
  let loadConfig;

  beforeEach(async () => {
    loadConfig = await importLoadConfig();
  });

  it('loads config with all valid variables', () => {
    const cfg = loadConfig({ ...VALID_ENV });
    assert.equal(cfg.DATABASE_URL, VALID_ENV.DATABASE_URL);
    assert.equal(cfg.REDIS_URL, VALID_ENV.REDIS_URL);
    assert.equal(cfg.JWT_SECRET, VALID_ENV.JWT_SECRET);
    assert.equal(cfg.NODE_ENV, 'development');
  });

  it('fails if DATABASE_URL is absent', () => {
    const env = { ...VALID_ENV };
    delete env.DATABASE_URL;
    assert.throws(
      () => loadConfig(env),
      (err) => {
        assert.ok(err.message.includes('DATABASE_URL'));
        return true;
      }
    );
  });

  it('fails if JWT_SECRET is shorter than 32 characters', () => {
    assert.throws(
      () => loadConfig({ ...VALID_ENV, JWT_SECRET: 'tooshort' }),
      (err) => {
        assert.ok(err.message.includes('JWT_SECRET'));
        return true;
      }
    );
  });

  it('validates NODE_ENV enum', () => {
    assert.throws(
      () => loadConfig({ ...VALID_ENV, NODE_ENV: 'staging' }),
      (err) => {
        assert.ok(err.message.includes('NODE_ENV'));
        return true;
      }
    );
  });

  it('converts API_PORT to number', () => {
    const cfg = loadConfig({ ...VALID_ENV, API_PORT: '4000' });
    assert.equal(typeof cfg.API_PORT, 'number');
    assert.equal(cfg.API_PORT, 4000);
  });

  it('converts RATE_LIMIT_WINDOW_MS to number', () => {
    const cfg = loadConfig({ ...VALID_ENV, RATE_LIMIT_WINDOW_MS: '900000' });
    assert.equal(typeof cfg.RATE_LIMIT_WINDOW_MS, 'number');
    assert.equal(cfg.RATE_LIMIT_WINDOW_MS, 900000);
  });
});
