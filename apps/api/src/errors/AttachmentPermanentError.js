/**
 * Represents a permanent, non-retryable failure during attachment processing.
 *
 * Throwing this error inside the BullMQ processor causes the job to be moved
 * directly to the DLQ without consuming remaining retry attempts.
 *
 * Permanent failure examples:
 *  - Attachment not found / deleted
 *  - Unsupported MIME type
 *  - Corrupted file
 *  - Inconsistent / impossible-to-process metadata
 */
export class AttachmentPermanentError extends Error {
  /**
   * @param {string} message
   * @param {{ attachmentId?: string, reason?: string }} [meta]
   */
  constructor(message, meta = {}) {
    super(message);
    this.name = 'AttachmentPermanentError';
    this.permanent = true;
    this.meta = meta;
  }
}