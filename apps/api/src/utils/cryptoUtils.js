import { createHash } from 'crypto';

/**
 * Hashes a string using SHA-256.
 * @param {string} value
 * @returns {string}
 */
export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
