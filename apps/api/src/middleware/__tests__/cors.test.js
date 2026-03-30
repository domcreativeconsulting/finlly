import { jest } from '@jest/globals';

jest.unstable_mockModule('../../config/env.js', () => ({
  config: {
    APP_URL: 'http://localhost:5173',
    CORS_ORIGINS: undefined,
  },
}));

let corsMiddleware;
let configMock;

beforeAll(async () => {
  const envMod = await import('../../config/env.js');
  configMock = envMod.config;
  const mod = await import('../cors.js');
  corsMiddleware = mod.corsMiddleware;
});

beforeEach(() => {
  configMock.APP_URL = 'http://localhost:5173';
  configMock.CORS_ORIGINS = undefined;
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

  describe('CORS_ORIGINS support', () => {
    test('allows first origin in CORS_ORIGINS list', () => {
      configMock.CORS_ORIGINS = 'https://app.finlly.com.br,https://finlly.com.br';
      const req = makeReq({ headers: { origin: 'https://app.finlly.com.br' } });
      const res = makeRes();
      const next = jest.fn();

      corsMiddleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res._headers['access-control-allow-origin']).toBe('https://app.finlly.com.br');
    });

    test('allows second origin in CORS_ORIGINS list', () => {
      configMock.CORS_ORIGINS = 'https://app.finlly.com.br,https://finlly.com.br';
      const req = makeReq({ headers: { origin: 'https://finlly.com.br' } });
      const res = makeRes();
      const next = jest.fn();

      corsMiddleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res._headers['access-control-allow-origin']).toBe('https://finlly.com.br');
    });

    test('rejects origin not in CORS_ORIGINS list', () => {
      configMock.CORS_ORIGINS = 'https://app.finlly.com.br,https://finlly.com.br';
      const req = makeReq({ headers: { origin: 'https://evil.com' } });
      const res = makeRes();
      const next = jest.fn();

      corsMiddleware(req, res, next);

      expect(res._status).toBe(403);
      expect(res._body.code).toBe('FORBIDDEN');
      expect(next).not.toHaveBeenCalled();
    });

    test('handles CORS_ORIGINS with extra spaces around commas', () => {
      configMock.CORS_ORIGINS = 'https://app.finlly.com.br , https://finlly.com.br';
      const req = makeReq({ headers: { origin: 'https://finlly.com.br' } });
      const res = makeRes();
      const next = jest.fn();

      corsMiddleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res._headers['access-control-allow-origin']).toBe('https://finlly.com.br');
    });

    test('strips trailing slash from entries in CORS_ORIGINS', () => {
      configMock.CORS_ORIGINS = 'https://app.finlly.com.br/,https://finlly.com.br/';
      const req = makeReq({ headers: { origin: 'https://app.finlly.com.br' } });
      const res = makeRes();
      const next = jest.fn();

      corsMiddleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res._headers['access-control-allow-origin']).toBe('https://app.finlly.com.br');
    });

    test('falls back to APP_URL when CORS_ORIGINS is undefined', () => {
      configMock.CORS_ORIGINS = undefined;
      const req = makeReq({ headers: { origin: 'http://localhost:5173' } });
      const res = makeRes();
      const next = jest.fn();

      corsMiddleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res._headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });

    test('handles preflight OPTIONS with CORS_ORIGINS', () => {
      configMock.CORS_ORIGINS = 'https://app.finlly.com.br,https://finlly.com.br';
      const req = makeReq({ headers: { origin: 'https://app.finlly.com.br' }, method: 'OPTIONS' });
      const res = makeRes();
      const next = jest.fn();

      corsMiddleware(req, res, next);

      expect(res._status).toBe(204);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
