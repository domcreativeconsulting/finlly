import { jest } from '@jest/globals';

// Mock the logger before importing the middleware
const mockWarn = jest.fn();
jest.unstable_mockModule('../../logger.js', () => ({
  default: {
    warn: mockWarn,
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

let requestIdMiddleware;
let isValidRequestId;

beforeAll(async () => {
  const mod = await import('../requestId.js');
  requestIdMiddleware = mod.requestIdMiddleware;
  isValidRequestId = mod.isValidRequestId;
});

describe('isValidRequestId', () => {
  test('accepts valid alphanumeric value', () => {
    expect(isValidRequestId('abc123')).toBe(true);
  });

  test('accepts value with hyphens and underscores', () => {
    expect(isValidRequestId('my-request_id')).toBe(true);
  });

  test('accepts exactly 64 characters', () => {
    expect(isValidRequestId('a'.repeat(64))).toBe(true);
  });

  test('rejects empty string', () => {
    expect(isValidRequestId('')).toBe(false);
  });

  test('rejects value longer than 64 characters', () => {
    expect(isValidRequestId('a'.repeat(65))).toBe(false);
  });

  test('rejects value with special characters', () => {
    expect(isValidRequestId('bad value!')).toBe(false);
  });

  test('rejects value with spaces', () => {
    expect(isValidRequestId('has space')).toBe(false);
  });
});

describe('requestIdMiddleware', () => {
  function makeReq(headers = {}) {
    return { headers };
  }

  function makeRes() {
    const headers = {};
    return {
      setHeader(name, value) {
        headers[name] = value;
      },
      _headers: headers,
    };
  }

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  beforeEach(() => {
    mockWarn.mockClear();
  });

  test('generates UUID when no header is present', () => {
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toMatch(UUID_REGEX);
    expect(res._headers['x-request-id']).toBe(req.requestId);
    expect(next).toHaveBeenCalled();
  });

  test('reuses valid x-request-id from header', () => {
    const req = makeReq({ 'x-request-id': 'my-valid-id' });
    const res = makeRes();
    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toBe('my-valid-id');
    expect(res._headers['x-request-id']).toBe('my-valid-id');
    expect(mockWarn).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  test('regenerates UUID when x-request-id is too long', () => {
    const req = makeReq({ 'x-request-id': 'a'.repeat(65) });
    const res = makeRes();
    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toMatch(UUID_REGEX);
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({ msg: expect.stringContaining('Invalid x-request-id') })
    );
    expect(next).toHaveBeenCalled();
  });

  test('regenerates UUID when x-request-id has invalid characters', () => {
    const req = makeReq({ 'x-request-id': 'bad value!' });
    const res = makeRes();
    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toMatch(UUID_REGEX);
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({ msg: expect.stringContaining('Invalid x-request-id') })
    );
    expect(next).toHaveBeenCalled();
  });

  test('falls back to valid x-correlation-id when x-request-id is absent', () => {
    const req = makeReq({ 'x-correlation-id': 'corr-id-123' });
    const res = makeRes();
    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toBe('corr-id-123');
    expect(res._headers['x-request-id']).toBe('corr-id-123');
    expect(mockWarn).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  test('regenerates UUID when x-correlation-id is invalid', () => {
    const req = makeReq({ 'x-correlation-id': 'bad value!' });
    const res = makeRes();
    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toMatch(UUID_REGEX);
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({ msg: expect.stringContaining('Invalid x-correlation-id') })
    );
    expect(next).toHaveBeenCalled();
  });

  test('response header always includes x-request-id', () => {
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    expect(res._headers['x-request-id']).toBeDefined();
    expect(res._headers['x-request-id']).toBe(req.requestId);
  });
});
