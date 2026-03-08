/**
 * Security headers middleware.
 * Adds defensive HTTP headers to every response to protect against common
 * browser-side attacks (MIME sniffing, clickjacking, XSS, etc.).
 *
 * Headers applied:
 *   - X-Content-Type-Options: nosniff          — prevent MIME sniffing
 *   - X-Frame-Options: DENY                    — prevent clickjacking
 *   - X-XSS-Protection: 1; mode=block          — legacy browser XSS filter
 *   - Strict-Transport-Security                — force HTTPS for 1 year
 *   - Content-Security-Policy: default-src 'self' — minimal CSP
 *
 * @type {import('express').RequestHandler}
 */
export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  next();
}
