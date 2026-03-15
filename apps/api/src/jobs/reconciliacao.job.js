import { getRedisClient } from '../utils/redisClient.js';
import { executarReconciliacao } from '../services/reconciliacaoService.js';
import logger from '../logger.js';

const LOCK_KEY = 'jobs:reconciliacao:lock';
const LOCK_TTL_SECONDS = 10 * 60; // 10 minutes

/**
 * Runs the reconciliation job with Redis distributed lock.
 * Safe to call from cron or manually.
 * @returns {Promise<{ skipped?: boolean, result?: object }>}
 */
export async function runReconciliacaoJob() {
  let redis;
  let lockAcquired = false;

  try {
    redis = await getRedisClient();

    // Acquire distributed lock (NX = only set if not exists)
    const acquired = await redis.set(LOCK_KEY, '1', { NX: true, EX: LOCK_TTL_SECONDS });

    if (!acquired) {
      logger.info({ msg: 'Reconciliação já em execução (lock ativo), pulando...' });
      return { skipped: true };
    }

    lockAcquired = true;
    logger.info({ msg: 'Iniciando job de reconciliação' });

    const result = await executarReconciliacao();

    logger.info({ msg: 'Job de reconciliação concluído', result });
    return { result };
  } catch (err) {
    logger.error({ msg: 'Erro no job de reconciliação', err: err.message });
    throw err;
  } finally {
    if (lockAcquired && redis) {
      try {
        await redis.del(LOCK_KEY);
      } catch (err) {
        logger.warn({ msg: 'Falha ao liberar lock de reconciliação', err: err.message });
      }
    }
  }
}
