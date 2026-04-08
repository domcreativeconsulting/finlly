/**
 * Security headers middleware.
 * Adds hardened HTTP headers to every response to protect against common
 * browser-side attacks (MIME sniffing, clickjacking, XSS, cross-origin leaks, etc.).
 *
 * Headers applied:
 *   - X-Content-Type-Options: nosniff                         — prevent MIME sniffing
 *   - X-Frame-Options: DENY                                   — prevent clickjacking
 *   - X-XSS-Protection: 0                                     — disable legacy filter (deprecated, can introduce vulnerabilities; CSP replaces it)
 *   - Strict-Transport-Security: max-age=31536000; includeSubDomains; preload — force HTTPS
 *   - Content-Security-Policy: default-src 'self'             — minimal CSP
 *   - Referrer-Policy: strict-origin-when-cross-origin        — limit referrer leakage
 *   - Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=() — disable sensitive APIs
 *   - Cross-Origin-Opener-Policy: same-origin                 — prevent cross-origin window access
 *   - Cross-Origin-Resource-Policy: same-origin               — prevent cross-origin resource reads
 *   - Cross-Origin-Embedder-Policy: require-corp              — enable cross-origin isolation
 * Also removes the X-Powered-By header to avoid disclosing server technology.
 *
 * @type {import('express').RequestHandler}
 */
export function securityHeaders(req, res, next) {
  res.removeHeader('X-Powered-By');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
}
