import { Router } from 'express';
import logger from '../logger.js';
import { performHealthChecks } from '../utils/health.js';

const router = Router();

router.get('/health', async (req, res) => {
  const requestId = req.requestId;
  try {
    const result = await performHealthChecks();
    const httpStatus = result.status === 'ok' ? 200 : 503;

    if (result.status === 'down') {
      logger.error({
        requestId,
        status: result.status,
        db: result.db,
        redis: result.redis,
        responseTime: `${result.responseTime}ms`,
        timestamp: result.timestamp,
        msg: 'Health check failed - all dependencies unavailable',
      });
    } else if (result.status === 'degraded') {
      logger.warn({
        requestId,
        status: result.status,
        db: result.db,
        redis: result.redis,
        responseTime: `${result.responseTime}ms`,
        timestamp: result.timestamp,
        msg: 'Health check degraded',
      });
    }

    res.status(httpStatus).json(result);
  } catch {
    const timestamp = new Date().toISOString();
    logger.error({
      requestId,
      status: 'down',
      db: 'down',
      redis: 'down',
      timestamp,
      msg: 'Health check execution failed',
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
