import { Worker } from 'bullmq';
import { config } from '../config/env.js';
import logger from '../logger.js';
import { processAttachment } from '../services/attachmentProcessingService.js';
import { ATTACHMENT_QUEUE_NAME } from '../queues/attachment.queue.js';

const connection = { url: config.REDIS_URL };

const worker = new Worker(
  ATTACHMENT_QUEUE_NAME,
  async (job) => {
    const { attachmentId, triggeredBy, requestedAt, storagePath, mimeType } = job.data;
    const jobId = String(job.id);

    logger.info({ attachmentId, jobId, triggeredBy, requestedAt }, 'Worker: iniciando processamento do job.');

    const startTime = Date.now();

    try {
      const resultado = await processAttachment({
        attachmentId,
        storagePath,
        mimeType,
        jobId,
      });

      const durationMs = Date.now() - startTime;
      logger.info({ attachmentId, jobId, durationMs, status: 'PROCESSED' }, 'Worker: job concluído com sucesso.');

      return resultado;
    } catch (err) {
      const durationMs = Date.now() - startTime;
      logger.error({ attachmentId, jobId, durationMs, err }, 'Worker: erro no processamento do job.');
      throw err;
    }
  },
  {
    connection,
    concurrency: config.ATTACHMENT_QUEUE_CONCURRENCY,
  },
);

worker.on('error', (err) => {
  logger.error({ err }, 'Worker: erro interno do BullMQ.');
});

async function shutdown() {
  logger.info('Worker encerrando...');
  await worker.close();
  logger.info('Worker encerrado.');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

logger.info({ queue: ATTACHMENT_QUEUE_NAME, concurrency: config.ATTACHMENT_QUEUE_CONCURRENCY }, 'Worker de anexos iniciado.');
