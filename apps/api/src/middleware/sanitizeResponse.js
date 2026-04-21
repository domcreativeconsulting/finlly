/**
 * Response sanitization middleware.
 *
 * Overrides res.json to strip sensitive fields from every JSON response
 * before they are sent to the client.
 *
 * Fields removed: senha_hash, refresh_token_hash, token_hash, senha
 *
 * Applied globally BEFORE routes in index.js.
 *
 * @type {import('express').RequestHandler}
 */

const SENSITIVE_FIELDS = new Set([
  'senha_hash',
  'refresh_token_hash',
  'token_hash',
  'senha',
]);

/**
 * Recursively removes sensitive fields from an object or array.
 * @param {unknown} value
 * @returns {unknown}
 */
function stripSensitiveFields(value) {
  if (Array.isArray(value)) {
    return value.map(stripSensitiveFields);
  }
  // Preserva Date objects — Object.entries(date) retorna [] e viraria {}
  if (value instanceof Date) {
    return value;
  }
  if (value !== null && typeof value === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(value)) {
      if (!SENSITIVE_FIELDS.has(k)) {
        result[k] = stripSensitiveFields(v);
      }
    }
    return result;
  }
  return value;
}

export function sanitizeResponse(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    const sanitized = stripSensitiveFields(body);
    return originalJson(sanitized);
  };
  next();
}
