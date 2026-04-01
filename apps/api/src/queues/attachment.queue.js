import { Queue } from 'bullmq';
import { config } from '../config/env.js';

export const ATTACHMENT_QUEUE_NAME = 'attachment-processing';

const connection = { url: config.REDIS_URL };

export const attachmentQueue = new Queue(ATTACHMENT_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: config.ATTACHMENT_JOB_ATTEMPTS,
    backoff: {
      type: 'exponential',
      delay: config.ATTACHMENT_JOB_BACKOFF_DELAY_MS,
    },
  },
});

/**
 * Enfileira um job de processamento de anexo.
 *
 * @param {{ attachmentId: string, triggeredBy?: string, requestedAt?: string, storagePath?: string, mimeType?: string }} data
 * @returns {Promise<import('bullmq').Job>}
 */
export async function addAttachmentJob(data) {
  return attachmentQueue.add('process-attachment', data);
}
