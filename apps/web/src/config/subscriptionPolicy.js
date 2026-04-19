/**
 * User statuses that indicate an active subscription.
 * Mirrors the `ALLOWED_STATUSES` list in `apps/api/src/config/accessPolicy.js`.
 *
 * @type {readonly string[]}
 */
export const ALLOWED_STATUSES = Object.freeze(['ativo', 'trial', 'pendente', 'ativo_restrito']);

/**
 * Returns `true` when the given user status indicates an active subscription.
 *
 * @param {string | undefined | null} status
 * @returns {boolean}
 */
export function hasActiveSubscription(status) {
  return status != null && ALLOWED_STATUSES.includes(status);
}
