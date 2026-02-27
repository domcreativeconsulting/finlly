import { Router } from 'express';
import { randomUUID } from 'crypto';
import { performHealthChecks } from '../utils/health.js';

const router = Router();

router.get('/health', async (req, res) => {
  const requestId = randomUUID();
  try {
    const result = await performHealthChecks();
    const httpStatus = result.status === 'ok' ? 200 : 503;

    if (result.status === 'down') {
      console.error('[ERROR] Health check failed - all dependencies unavailable', {
        requestId,
        status: result.status,
        db: result.db,
        redis: result.redis,
        responseTime: `${result.responseTime}ms`,
        timestamp: result.timestamp,
      });
    } else if (result.status === 'degraded') {
      console.warn('[WARN] Health check degraded', {
        requestId,
        status: result.status,
        db: result.db,
        redis: result.redis,
        responseTime: `${result.responseTime}ms`,
        timestamp: result.timestamp,
      });
    }

    res.status(httpStatus).json(result);
  } catch {
    const timestamp = new Date().toISOString();
    console.error('[ERROR] Health check execution failed', {
      requestId,
      status: 'down',
      db: 'down',
      redis: 'down',
      timestamp,
    });
    res.status(503).json({
      status: 'down',
      db: 'down',
      redis: 'down',
      timestamp,
    });
  }
});

export default router;
