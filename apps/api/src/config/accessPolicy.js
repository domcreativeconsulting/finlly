/**
 * @fileoverview Centralized access policy for the Finlly API.
 * ...
 */

export const ALLOWED_STATUSES = Object.freeze(['ativo', 'trial', 'pendente', 'ativo_restrito']);

/** @deprecated Use {@link ALLOWED_STATUSES} instead. */
export const BLOCKED_STATUSES = Object.freeze(['bloqueado_inadimplencia']);

export const PAID_GUARD_DESCRIPTION =
  'Acesso restrito a usuários com assinatura ativa. ' +
  'Apenas usuários com status ativo, trial ou pendente podem acessar rotas pagas.';

export const PUBLIC_ROUTES = Object.freeze([
  { method: 'GET',  path: '/health',                          description: 'Health check endpoint.' },
  { method: 'POST', path: '/auth/register',                   description: 'Register a new user account.' },
  { method: 'POST', path: '/auth/login',                      description: 'Authenticate with email and password.' },
  { method: 'POST', path: '/auth/refresh',                    description: 'Refresh access token using refresh token.' },
  { method: 'POST', path: '/auth/forgot-password',            description: 'Request a password reset e-mail.' },
  { method: 'POST', path: '/auth/reset-password',             description: 'Reset password using a token from e-mail.' },
  { method: 'POST', path: '/auth/verify-email',               description: 'Verify e-mail address using a token.' },
  { method: 'POST', path: '/auth/resend-verification-email',  description: 'Resend the e-mail verification message.' },
  { method: 'POST', path: '/webhooks/asaas',                  description: 'Asaas payment gateway webhook — authenticated via HMAC, not JWT.' },
]);

export const FREE_ROUTES = Object.freeze([
  { method: 'POST', path: '/auth/logout',                   description: 'Invalidate the current session.' },
  { method: 'GET',  path: '/auth/me',                       description: 'Return the currently authenticated user.' },
  { method: 'GET',  path: '/perfil',                        description: "Read the authenticated user's profile." },
  { method: 'GET',  path: '/users/me',                      description: 'Alias for GET /perfil.' },
  { method: 'GET',  path: '/billing/status',                description: 'Return the subscription status. Free so overdue users can always check their status.' },
  { method: 'POST', path: '/billing/cancel',                description: 'Cancel the active subscription. Free so overdue (inadimplente) users can cancel without being blocked.' },
  { method: 'POST', path: '/billing/admin/reconciliar',     description: 'Trigger a manual billing reconciliation. Restricted by role=admin, not by plan.' },
  {
    method: 'POST',
    path: '/billing/subscribe',
    description: 'Create a new subscription. Requires only a valid JWT — new users (inativo) must be able to subscribe.',
  },
]);

export const PAID_ROUTES = Object.freeze([
  { method: 'PATCH', path: '/perfil',    description: "Partially update the authenticated user's profile. Requires an active account." },
  { method: 'PUT',   path: '/users/me',  description: "Replace the authenticated user's profile. Requires an active account." },
]);

export function hasActiveSubscription(status) {
  return status != null && ALLOWED_STATUSES.includes(status);
}

/** @deprecated Use {@link hasActiveSubscription} instead. */
export function isStatusBlocked(status) {
  return !hasActiveSubscription(status);
}
