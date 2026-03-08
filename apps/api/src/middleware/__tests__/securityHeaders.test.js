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
    setHeader(name, value) {
      this._headers[name.toLowerCase()] = value;
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

  test('sets X-XSS-Protection: 1; mode=block', () => {
    const res = makeRes();
    const next = jest.fn();
    securityHeaders(makeReq(), res, next);
    expect(res._headers['x-xss-protection']).toBe('1; mode=block');
  });

  test('sets Strict-Transport-Security with max-age=31536000 and includeSubDomains', () => {
    const res = makeRes();
    const next = jest.fn();
    securityHeaders(makeReq(), res, next);
    const hsts = res._headers['strict-transport-security'];
    expect(hsts).toContain('max-age=31536000');
    expect(hsts).toContain('includeSubDomains');
  });

  test("sets Content-Security-Policy: default-src 'self'", () => {
    const res = makeRes();
    const next = jest.fn();
    securityHeaders(makeReq(), res, next);
    expect(res._headers['content-security-policy']).toBe("default-src 'self'");
  });

  test('calls next() after setting all headers', () => {
    const res = makeRes();
    const next = jest.fn();
    securityHeaders(makeReq(), res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('sets all five security headers in a single call', () => {
    const res = makeRes();
    const next = jest.fn();
    securityHeaders(makeReq(), res, next);
    expect(Object.keys(res._headers)).toHaveLength(5);
  });
});
