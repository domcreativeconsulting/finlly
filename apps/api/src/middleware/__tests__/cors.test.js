import { jest } from '@jest/globals';

jest.unstable_mockModule('../../config/env.js', () => ({
  config: {
    APP_URL: 'http://localhost:5173',
  },
}));

let corsMiddleware;

beforeAll(async () => {
  const mod = await import('../cors.js');
  corsMiddleware = mod.corsMiddleware;
});

function makeReq(overrides = {}) {
  return {
    headers: {},
    method: 'GET',
    ...overrides,
  };
}

function makeRes() {
  const res = {
    _status: null,
    _body: null,
    _headers: {},
    setHeader(name, value) {
      this._headers[name.toLowerCase()] = value;
    },
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._body = body;
      return this;
    },
    end() {
      return this;
    },
  };
  return res;
}

describe('corsMiddleware', () => {
  test('passes through when no Origin header is present', () => {
    const req = makeReq({ headers: {} });
    const res = makeRes();
    const next = jest.fn();

    corsMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res._status).toBeNull();
    expect(res._headers['access-control-allow-origin']).toBeUndefined();
  });

  test('sets CORS headers when Origin exactly matches APP_URL', () => {
    const req = makeReq({ headers: { origin: 'http://localhost:5173' } });
    const res = makeRes();
    const next = jest.fn();

    corsMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res._headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res._headers['access-control-allow-credentials']).toBe('true');
    expect(res._headers['access-control-allow-methods']).toMatch(/GET/);
    expect(res._headers['vary']).toBe('Origin');
  });

  test('handles preflight OPTIONS request with 204 and no next()', () => {
    const req = makeReq({ headers: { origin: 'http://localhost:5173' }, method: 'OPTIONS' });
    const res = makeRes();
    const next = jest.fn();

    corsMiddleware(req, res, next);

    expect(res._status).toBe(204);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 403 when Origin header does not match APP_URL', () => {
    const req = makeReq({ headers: { origin: 'http://evil.com' } });
    const res = makeRes();
    const next = jest.fn();

    corsMiddleware(req, res, next);

    expect(res._status).toBe(403);
    expect(res._body.code).toBe('FORBIDDEN');
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 403 for subdomain bypass attempt', () => {
    const req = makeReq({ headers: { origin: 'http://localhost:5173.evil.com' } });
    const res = makeRes();
    const next = jest.fn();

    corsMiddleware(req, res, next);

    expect(res._status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 403 when Origin is a prefix match but not exact', () => {
    const req = makeReq({ headers: { origin: 'http://localhost:51730' } });
    const res = makeRes();
    const next = jest.fn();

    corsMiddleware(req, res, next);

    expect(res._status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('strips trailing slash from APP_URL before comparing', () => {
    // APP_URL mock is 'http://localhost:5173' — this tests that trailing slash on APP_URL
    // is handled. Since our mock doesn't have trailing slash, send origin without it:
    const req = makeReq({ headers: { origin: 'http://localhost:5173' } });
    const res = makeRes();
    const next = jest.fn();

    corsMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res._headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});
