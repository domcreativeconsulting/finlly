import pg from 'pg';
import { createClient } from 'redis';
import { config } from '../config/env.js';

const HEALTH_CHECK_TIMEOUT_MS = 300;

function withTimeout(promise, ms) {
  let timerId;
  const timeout = new Promise((_, reject) => {
    timerId = setTimeout(() => reject(new Error('Timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timerId));
}

export async function checkDatabase() {
  const client = new pg.Client({ connectionString: config.DATABASE_URL });
  try {
    await withTimeout(client.connect(), HEALTH_CHECK_TIMEOUT_MS);
    await withTimeout(client.query('SELECT 1'), HEALTH_CHECK_TIMEOUT_MS);
    return 'ok';
  } catch {
    return 'down';
  } finally {
    try {
      await client.end();
    } catch {
      // ignore disconnect errors
    }
  }
}

export async function checkRedis() {
  const client = createClient({ url: config.REDIS_URL });
  try {
    await withTimeout(client.connect(), HEALTH_CHECK_TIMEOUT_MS);
    await withTimeout(client.ping(), HEALTH_CHECK_TIMEOUT_MS);
    return 'ok';
  } catch {
    return 'down';
  } finally {
    try {
      await client.disconnect();
    } catch {
      // ignore disconnect errors
    }
  }
}

export function calculateOverallStatus(db, redis) {
  if (db === 'ok' && redis === 'ok') return 'ok';
  if (db === 'down' && redis === 'down') return 'down';
  return 'degraded';
}

export async function performHealthChecks() {
  const startTime = Date.now();
  const [db, redis] = await Promise.all([checkDatabase(), checkRedis()]);
  return {
    status: calculateOverallStatus(db, redis),
    db,
    redis,
    timestamp: new Date().toISOString(),
    responseTime: Date.now() - startTime,
  };
}
