import { jest } from '@jest/globals';

let requestContextMiddleware;

beforeAll(async () => {
  const mod = await import('../requestContext.js');
  requestContextMiddleware = mod.requestContextMiddleware;
});

describe('requestContextMiddleware', () => {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  function makeReq(overrides = {}) {
    return {
      headers: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      ...overrides,
    };
  }

  function makeRes() {
    const headers = {};
    return {
      locals: {},
      setHeader(name, value) {
        headers[name.toLowerCase()] = value;
      },
      _headers: headers,
    };
  }

  test('generates requestId when x-request-id header is absent', () => {
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    requestContextMiddleware(req, res, next);

    expect(req.requestId).toMatch(UUID_REGEX);
    expect(res.locals.requestId).toBe(req.requestId);
    expect(next).toHaveBeenCalled();
  });

  test('uses x-request-id from header when present', () => {
    const req = makeReq({ headers: { 'x-request-id': 'my-request-id' } });
    const res = makeRes();
    const next = jest.fn();

    requestContextMiddleware(req, res, next);

    expect(req.requestId).toBe('my-request-id');
    expect(res.locals.requestId).toBe('my-request-id');
    expect(next).toHaveBeenCalled();
  });

  test('uses req.requestId when already set (e.g. by requestIdMiddleware)', () => {
    const req = makeReq({ requestId: 'pre-set-id', headers: { 'x-request-id': 'other-id' } });
    const res = makeRes();
    const next = jest.fn();

    requestContextMiddleware(req, res, next);

    expect(req.requestId).toBe('pre-set-id');
    expect(res.locals.requestId).toBe('pre-set-id');
    expect(next).toHaveBeenCalled();
  });

  test('sets res.locals.requestId', () => {
    const req = makeReq({ headers: { 'x-request-id': 'test-id' } });
    const res = makeRes();
    const next = jest.fn();

    requestContextMiddleware(req, res, next);

    expect(res.locals.requestId).toBe('test-id');
  });

  test('sets res.locals.ip from req.ip', () => {
    const req = makeReq({ ip: '192.168.1.1', socket: { remoteAddress: '10.0.0.1' } });
    const res = makeRes();
    const next = jest.fn();

    requestContextMiddleware(req, res, next);

    expect(res.locals.ip).toBe('192.168.1.1');
  });

  test('falls back to req.socket.remoteAddress when req.ip is absent', () => {
    const req = makeReq({ ip: undefined, socket: { remoteAddress: '10.0.0.2' } });
    const res = makeRes();
    const next = jest.fn();

    requestContextMiddleware(req, res, next);

    expect(res.locals.ip).toBe('10.0.0.2');
  });

  test('sets res.locals.userAgent from headers', () => {
    const req = makeReq({ headers: { 'user-agent': 'Mozilla/5.0' } });
    const res = makeRes();
    const next = jest.fn();

    requestContextMiddleware(req, res, next);

    expect(res.locals.userAgent).toBe('Mozilla/5.0');
  });

  test('sets res.locals.userAgent to undefined when header is absent', () => {
    const req = makeReq({ headers: {} });
    const res = makeRes();
    const next = jest.fn();

    requestContextMiddleware(req, res, next);

    expect(res.locals.userAgent).toBeUndefined();
  });

  test('sets X-Request-Id response header', () => {
    const req = makeReq({ headers: { 'x-request-id': 'resp-header-id' } });
    const res = makeRes();
    const next = jest.fn();

    requestContextMiddleware(req, res, next);

    expect(res._headers['x-request-id']).toBe('resp-header-id');
  });

  test('calls next()', () => {
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    requestContextMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });
});
