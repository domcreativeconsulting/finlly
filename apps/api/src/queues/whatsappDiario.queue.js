/**
 * BullMQ queue for daily WhatsApp bill summary (Story 12.4.1).
 */
import { Queue } from 'bullmq';
import { config } from '../config/env.js';

export const WHATSAPP_DIARIO_QUEUE_NAME = 'whatsapp-diario';

const connection = { url: config.REDIS_URL };

export const whatsappDiarioQueue = new Queue(WHATSAPP_DIARIO_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: config.WHATSAPP_DIARIO_JOB_ATTEMPTS,
    backoff: {
      type: 'exponential',
      delay: config.WHATSAPP_DIARIO_JOB_BACKOFF_DELAY_MS,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

/**
 * Enqueues a daily summary job for one user.
 *
 * @param {{ usuarioId: string, nome: string, whatsapp: string }} data
 * @returns {Promise<import('bullmq').Job>}
 */
export async function addWhatsappDiarioJob(data) {
  return whatsappDiarioQueue.add('send-resumo-diario', data, {
    jobId: `resumo-diario-${data.usuarioId}-${new Date().toISOString().slice(0, 10)}`,
    // jobId deduplica: mesmo usuário não recebe duplicado no mesmo dia
  });
}
