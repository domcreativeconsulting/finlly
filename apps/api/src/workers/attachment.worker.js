import { Worker } from 'bullmq';
import { config } from '../config/env.js';
import logger from '../logger.js';
import { processAttachment } from '../services/attachmentProcessingService.js';
import { ATTACHMENT_QUEUE_NAME } from '../queues/attachment.queue.js';
import { addToDlq } from '../queues/attachment-dlq.queue.js';
import prisma from '../utils/database.js';

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

      if (err?.permanent === true) {
        logger.warn({ attachmentId, jobId }, 'Worker: erro permanente detectado — movendo direto para DLQ sem retry.');
        const SKIP_RETRY = true;
        await job.moveToFailed(err, job.token, SKIP_RETRY);
      }

      throw err;
    }
  },
  {
    connection,
    concurrency: config.ATTACHMENT_QUEUE_CONCURRENCY,
  },
);

worker.on('failed', async (job, err) => {
  // attemptsMade equals opts.attempts on the last attempt, so >= safely identifies the final failure
  const isFinalFailure = job.attemptsMade >= job.opts.attempts;
  const attachmentId = job?.data?.attachmentId;
  const jobId = String(job?.id ?? '');

  logger.error(
    { attachmentId, jobId, attempts: job.attemptsMade, err },
    isFinalFailure
      ? 'Worker: job falhou definitivamente — enviando para DLQ.'
      : 'Worker: job falhou, será reprocessado.',
  );

  if (isFinalFailure && attachmentId) {
    try {
      await prisma.anexoOcrResultado.update({
        where: { anexo_id: attachmentId },
        data: {
          status: 'FAILED',
          error_message: (err?.message ?? 'Erro desconhecido').slice(0, 500),
          failed_at: new Date(),
          updated_at: new Date(),
        },
      });
    } catch (persistErr) {
      logger.error({ attachmentId, jobId, err: persistErr }, 'Worker: falha ao persistir status FAILED no banco.');
    }

    try {
      await addToDlq({
        attachmentId,
        jobId,
        attempts: job.attemptsMade,
        errorMessage: (err?.message ?? 'Erro desconhecido').slice(0, 500),
        failedAt: new Date().toISOString(),
      });
    } catch (dlqErr) {
      logger.error({ attachmentId, jobId, err: dlqErr }, 'Worker: falha ao enfileirar job na DLQ.');
    }
  }
});

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
