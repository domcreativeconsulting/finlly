import { Queue } from 'bullmq';
import { config } from '../config/env.js';

export const ATTACHMENT_DLQ_QUEUE_NAME = config.ATTACHMENT_DLQ_QUEUE_NAME;

const connection = { url: config.REDIS_URL };

export const attachmentDlqQueue = new Queue(ATTACHMENT_DLQ_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: false,
    removeOnFail: false,
  },
});

/**
 * Enfileira um job na DLQ de anexos com rastreabilidade completa.
 *
 * @param {{ attachmentId: string, jobId: string, attempts: number, errorMessage: string, failedAt: string }} data
 */
export async function addToDlq(data) {
  return attachmentDlqQueue.add('dlq-attachment', data, {
    jobId: `dlq-${data.attachmentId}-${Date.now()}`,
  });
}
