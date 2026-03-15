import { config } from '../config/env.js';
import { reconciliarAssinaturas } from '../services/reconciliacaoService.js';
import logger from '../logger.js';

let timeoutHandle = null;

/**
 * Runs the reconciliation and schedules the next execution.
 */
async function run() {
  try {
    const result = await reconciliarAssinaturas();
    if (result.skipped) {
      logger.warn({ msg: 'Reconciliação pulada: lock já adquirido por outra instância.' });
    } else {
      logger.info({ result }, 'Job de reconciliação executado com sucesso.');
    }
  } catch (err) {
    logger.error({ err }, 'Erro no job de reconciliação.');
  } finally {
    scheduleNext();
  }
}

/**
 * Schedules the next reconciliation run.
 */
function scheduleNext() {
  const intervalMs = config.RECONCILIACAO_INTERVAL_MS;
  timeoutHandle = setTimeout(run, intervalMs);
}

/**
 * Starts the reconciliation job.
 */
export function startReconciliacaoJob() {
  logger.info(
    { intervalMs: config.RECONCILIACAO_INTERVAL_MS },
    'Job de reconciliação iniciado.',
  );
  run();
}

/**
 * Stops the reconciliation job (clears pending timeout).
 */
export function stopReconciliacaoJob() {
  if (timeoutHandle !== null) {
    clearTimeout(timeoutHandle);
    timeoutHandle = null;
    logger.info({ msg: 'Job de reconciliação parado.' });
  }
}
