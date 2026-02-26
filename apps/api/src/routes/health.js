import { Router } from 'express';
import { performHealthChecks } from '../utils/health.js';

const router = Router();

router.get('/health', async (req, res) => {
  try {
    const result = await performHealthChecks();
    const httpStatus = result.status === 'ok' ? 200 : 503;
    res.status(httpStatus).json(result);
  } catch {
    res.status(503).json({
      status: 'down',
      db: 'down',
      redis: 'down',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
