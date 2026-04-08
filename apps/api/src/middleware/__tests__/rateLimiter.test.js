import { jest } from '@jest/globals';

// Capture the options object passed to each rateLimit() call so we can test the handler directly.
const capturedOptions = [];

jest.unstable_mockModule('express-rate-limit', () => ({
  rateLimit: jest.fn((opts) => {
    capturedOptions.push(opts);
    return jest.fn();
  }),
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  config: {
    NODE_ENV: 'test',
    RATE_LIMIT_STORE: 'memory',
    RATE_LIMIT_AUTH_MAX: 30,
    RATE_LIMIT_AUTH_WINDOW_MS: 900000,
    RATE_LIMIT_SENSITIVE_MAX: 30,
    RATE_LIMIT_SENSITIVE_WINDOW_MS: 60000,
    RATE_LIMIT_ADMIN_MAX: 20,
    RATE_LIMIT_ADMIN_WINDOW_MS: 60000,
  },
}));

jest.unstable_mockModule('../../utils/rateLimitStore.js', () => ({
  buildStore: jest.fn(() => undefined),
  userOrIpKeyGenerator: jest.fn((req) => req.ip || '127.0.0.1'),
}));

let authLimiter, sensitiveWriteLimiter, adminLimiter;

beforeAll(async () => {
  const mod = await import('../rateLimiter.js');
  authLimiter = mod.authLimiter;
  sensitiveWriteLimiter = mod.sensitiveWriteLimiter;
  adminLimiter = mod.adminLimiter;
});

/**
 * Helper that simulates the rateLimit handler being invoked directly,
 * as express-rate-limit does when the limit is exceeded.
 * Returns the mocked `next` function so callers can inspect the arguments.
 */
function invokeHandler(opts) {
  const req = { ip: '127.0.0.1' };
  const res = {};
  const next = jest.fn();
  opts.handler(req, res, next, opts);
  return next;
}

describe('rateLimiter middleware exports', () => {
  test('authLimiter is a function', () => {
    expect(typeof authLimiter).toBe('function');
  });

  test('sensitiveWriteLimiter is a function', () => {
    expect(typeof sensitiveWriteLimiter).toBe('function');
  });

  test('adminLimiter is a function', () => {
    expect(typeof adminLimiter).toBe('function');
  });
});

describe('rateLimiter handler behaviour', () => {
  test('authLimiter handler calls next with AppError status 429', () => {
    // capturedOptions[0] = authLimiter (first rateLimit() call in rateLimiter.js)
    const next = invokeHandler(capturedOptions[0]);
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeTruthy();
    expect(err.status).toBe(429);
  });

  test('authLimiter handler passes an error with code TOO_MANY_REQUESTS', () => {
    const next = invokeHandler(capturedOptions[0]);
    const err = next.mock.calls[0][0];
    expect(err.code).toBe('TOO_MANY_REQUESTS');
  });

  test('sensitiveWriteLimiter handler calls next with AppError status 429', () => {
    // capturedOptions[1] = sensitiveWriteLimiter (second rateLimit() call)
    const next = invokeHandler(capturedOptions[1]);
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.status).toBe(429);
  });

  test('sensitiveWriteLimiter handler passes an error with code TOO_MANY_REQUESTS', () => {
    const next = invokeHandler(capturedOptions[1]);
    const err = next.mock.calls[0][0];
    expect(err.code).toBe('TOO_MANY_REQUESTS');
  });

  test('adminLimiter handler calls next with AppError status 429', () => {
    // capturedOptions[2] = adminLimiter (third rateLimit() call)
    const next = invokeHandler(capturedOptions[2]);
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.status).toBe(429);
  });

  test('adminLimiter handler passes an error with code TOO_MANY_REQUESTS', () => {
    const next = invokeHandler(capturedOptions[2]);
    const err = next.mock.calls[0][0];
    expect(err.code).toBe('TOO_MANY_REQUESTS');
  });
});
