import { jest } from '@jest/globals';

let securityHeaders;

beforeAll(async () => {
  const mod = await import('../securityHeaders.js');
  securityHeaders = mod.securityHeaders;
});

function makeReq() {
  return {};
}

function makeRes() {
  const res = {
    _headers: {},
    _removed: [],
    setHeader(name, value) {
      this._headers[name.toLowerCase()] = value;
    },
    removeHeader(name) {
      this._removed.push(name.toLowerCase());
    },
  };
  return res;
}

describe('securityHeaders', () => {
  test('sets X-Content-Type-Options: nosniff', () => {
    const res = makeRes();
    const next = jest.fn();
    securityHeaders(makeReq(), res, next);
    expect(res._headers['x-content-type-options']).toBe('nosniff');
  });

  test('sets X-Frame-Options: DENY', () => {
    const res = makeRes();
    const next = jest.fn();
    securityHeaders(makeReq(), res, next);
    expect(res._headers['x-frame-options']).toBe('DENY');
  });

  test('sets X-XSS-Protection: 0 (deprecated legacy filter disabled)', () => {
    const res = makeRes();
    const next = jest.fn();
    securityHeaders(makeReq(), res, next);
    expect(res._headers['x-xss-protection']).toBe('0');
  });

  test('sets Strict-Transport-Security with max-age=31536000, includeSubDomains and preload', () => {
    const res = makeRes();
    const next = jest.fn();
    securityHeaders(makeReq(), res, next);
    const hsts = res._headers['strict-transport-security'];
    expect(hsts).toContain('max-age=31536000');
    expect(hsts).toContain('includeSubDomains');
    expect(hsts).toContain('preload');
  });

  test("sets Content-Security-Policy: default-src 'self'", () => {
    const res = makeRes();
    const next = jest.fn();
    securityHeaders(makeReq(), res, next);
    expect(res._headers['content-security-policy']).toBe("default-src 'self'");
  });

  test('sets Referrer-Policy: strict-origin-when-cross-origin', () => {
    const res = makeRes();
    const next = jest.fn();
    securityHeaders(makeReq(), res, next);
    expect(res._headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  test('sets Permissions-Policy disabling camera, microphone, geolocation, payment', () => {
    const res = makeRes();
    const next = jest.fn();
    securityHeaders(makeReq(), res, next);
    const pp = res._headers['permissions-policy'];
    expect(pp).toContain('camera=()');
    expect(pp).toContain('microphone=()');
    expect(pp).toContain('geolocation=()');
    expect(pp).toContain('payment=()');
  });

  test('sets Cross-Origin-Opener-Policy: same-origin', () => {
    const res = makeRes();
    const next = jest.fn();
    securityHeaders(makeReq(), res, next);
    expect(res._headers['cross-origin-opener-policy']).toBe('same-origin');
  });

  test('sets Cross-Origin-Resource-Policy: same-origin', () => {
    const res = makeRes();
    const next = jest.fn();
    securityHeaders(makeReq(), res, next);
    expect(res._headers['cross-origin-resource-policy']).toBe('same-origin');
  });

  test('sets Cross-Origin-Embedder-Policy: require-corp', () => {
    const res = makeRes();
    const next = jest.fn();
    securityHeaders(makeReq(), res, next);
    expect(res._headers['cross-origin-embedder-policy']).toBe('require-corp');
  });

  test('removes X-Powered-By header', () => {
    const res = makeRes();
    const next = jest.fn();
    securityHeaders(makeReq(), res, next);
    expect(res._removed).toContain('x-powered-by');
  });

  test('calls next() after setting all headers', () => {
    const res = makeRes();
    const next = jest.fn();
    securityHeaders(makeReq(), res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('sets all ten security headers in a single call', () => {
    const res = makeRes();
    const next = jest.fn();
    securityHeaders(makeReq(), res, next);
    expect(Object.keys(res._headers)).toHaveLength(10);
  });
});
