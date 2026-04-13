/**
 * @fileoverview Centralized access policy for the Finlly API.
 *
 * This module declares the formal access rules for all API routes, separating
 * them into three categories: public, free (authenticated) and paid (authenticated
 * with an active subscription). It also exports the utility function used by
 * {@link module:middleware/requireAtivo} to decide whether a user's subscription
 * status allows access to paid routes.
 *
 * @module config/accessPolicy
 */

// ============================================================
// Status constants
// ============================================================

/**
 * User statuses that are **allowed** to access PAID_ROUTES.
 *
 * Only statuses listed here will be accepted by {@link hasActiveSubscription}.
 * All other statuses (including `inativo`, `cancelado`, `bloqueado_inadimplencia`
 * and absent/undefined statuses) are blocked.
 *
 * @type {readonly string[]}
 */
export const ALLOWED_STATUSES = Object.freeze(['ativo', 'trial', 'pendente']);

/**
 * @deprecated Use {@link ALLOWED_STATUSES} instead.
 *
 * Kept for backwards compatibility. Previously only `bloqueado_inadimplencia`
 * was blocked; now all statuses not in {@link ALLOWED_STATUSES} are blocked.
 *
 * @type {readonly string[]}
 */
export const BLOCKED_STATUSES = Object.freeze(['bloqueado_inadimplencia']);

/**
 * Human-readable description of the paid-route guard rule, used for logging
 * and documentation purposes.
 *
 * @type {string}
 */
export const PAID_GUARD_DESCRIPTION =
  'Acesso restrito a usuários com assinatura ativa. ' +
  'Apenas usuários com status ativo, trial ou pendente podem acessar rotas pagas.';

// ============================================================
// Route lists
// ============================================================

/**
 * @typedef {Object} RouteEntry
 * @property {'GET'|'POST'|'PATCH'|'PUT'|'DELETE'} method - HTTP method.
 * @property {string} path - Route path (relative to API root, without base prefix).
 * @property {string} description - Short human-readable description of the route.
 */

/**
 * Routes that are fully public — no authentication required.
 *
 * The webhook route uses HMAC signature verification instead of JWT.
 *
 * @type {readonly RouteEntry[]}
 */
export const PUBLIC_ROUTES = Object.freeze([
  { method: 'GET', path: '/health', description: 'Health check endpoint.' },
  { method: 'POST', path: '/auth/register', description: 'Register a new user account.' },
  { method: 'POST', path: '/auth/login', description: 'Authenticate with email and password.' },
  { method: 'POST', path: '/auth/refresh', description: 'Refresh access token using refresh token.' },
  { method: 'POST', path: '/auth/forgot-password', description: 'Request a password reset e-mail.' },
  { method: 'POST', path: '/auth/reset-password', description: 'Reset password using a token from e-mail.' },
  { method: 'POST', path: '/auth/verify-email', description: 'Verify e-mail address using a token.' },
  {
    method: 'POST',
    path: '/auth/resend-verification-email',
    description: 'Resend the e-mail verification message.',
  },
  {
    method: 'POST',
    path: '/webhooks/asaas',
    description: 'Asaas payment gateway webhook — authenticated via HMAC, not JWT.',
  },
]);

/**
 * Routes that require a valid JWT but impose no subscription-plan restriction.
 *
 * Notable exceptions documented here:
 * - `POST /billing/cancel` — an overdue user must still be able to cancel their subscription.
 * - `GET /billing/status` — a user must be able to see their own billing status at any time.
 * - `GET /perfil` / `GET /users/me` — read access to the profile is always allowed.
 * - `POST /billing/admin/reconciliar` — restricted by `role === 'admin'`, not by plan.
 *
 * @type {readonly RouteEntry[]}
 */
export const FREE_ROUTES = Object.freeze([
  { method: 'POST', path: '/auth/logout', description: 'Invalidate the current session.' },
  { method: 'GET', path: '/auth/me', description: 'Return the currently authenticated user.' },
  { method: 'GET', path: '/perfil', description: "Read the authenticated user's profile." },
  { method: 'GET', path: '/users/me', description: 'Alias for GET /perfil.' },
  {
    method: 'GET',
    path: '/billing/status',
    description: 'Return the subscription status. Free so overdue users can always check their status.',
  },
  {
    method: 'POST',
    path: '/billing/cancel',
    description:
      'Cancel the active subscription. Free so overdue (inadimplente) users can cancel without being blocked.',
  },
  {
    method: 'POST',
    path: '/billing/admin/reconciliar',
    description: 'Trigger a manual billing reconciliation. Restricted by role=admin, not by plan.',
  },
]);

/**
 * Routes that require a valid JWT **and** an active subscription (i.e. a status
 * that is in {@link ALLOWED_STATUSES}).
 *
 * These routes are protected by both `jwtAuthMiddleware` and `requireAtivo`.
 *
 * @type {readonly RouteEntry[]}
 */
export const PAID_ROUTES = Object.freeze([
  {
    method: 'POST',
    path: '/billing/subscribe',
    description: 'Create a new subscription. Requires an active account.',
  },
  {
    method: 'PATCH',
    path: '/perfil',
    description: "Partially update the authenticated user's profile. Requires an active account.",
  },
  {
    method: 'PUT',
    path: '/users/me',
    description: "Replace the authenticated user's profile. Requires an active account.",
  },
]);

// ============================================================
// Utility functions
// ============================================================

/**
 * Returns `true` when the given user status grants access to PAID_ROUTES,
 * or `false` when the user should be blocked.
 *
 * This is the authoritative check and must be used everywhere subscription
 * access is evaluated (e.g. in {@link module:middleware/requireAtivo}).
 *
 * Statuses that are **allowed** (have an active subscription):
 * - `ativo`
 * - `trial`
 * - `pendente`
 *
 * All other statuses (including `inativo`, `cancelado`,
 * `bloqueado_inadimplencia` and `undefined`/`null`) are **blocked**.
 *
 * @param {string | undefined | null} status - The user's subscription status from `req.user.status`.
 * @returns {boolean} `true` if the user has an active subscription, `false` otherwise.
 *
 * @example
 * import { hasActiveSubscription } from '../config/accessPolicy.js';
 *
 * if (!hasActiveSubscription(req.user?.status)) {
 *   // deny access
 * }
 */
export function hasActiveSubscription(status) {
  return status != null && ALLOWED_STATUSES.includes(status);
}

/**
 * @deprecated Use {@link hasActiveSubscription} instead.
 *
 * Returns `true` when the given user status should be **blocked** from
 * accessing PAID_ROUTES. Kept for backwards compatibility only.
 *
 * @param {string | undefined} status - The user's subscription status from `req.user.status`.
 * @returns {boolean} `true` if the status is blocked, `false` otherwise.
 */
export function isStatusBlocked(status) {
  return !hasActiveSubscription(status);
}
