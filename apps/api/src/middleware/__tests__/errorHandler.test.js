import { jest } from '@jest/globals';

const mockError = jest.fn();
const mockWarn = jest.fn();

jest.unstable_mockModule('../../logger.js', () => ({
  default: {
    error: mockError,
    warn: mockWarn,
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  config: { NODE_ENV: 'test' },
}));

let errorHandler;
let AppError;
let toValidationError;

beforeAll(async () => {
  const mod = await import('../errorHandler.js');
  errorHandler = mod.errorHandler;
  const appErrMod = await import('../../errors/AppError.js');
  AppError = appErrMod.AppError;
  const valErrMod = await import('../../errors/toValidationError.js');
  toValidationError = valErrMod.toValidationError;
});

function makeReq(overrides = {}) {
  return {
    requestId: 'test-request-id',
    method: 'GET',
    path: '/test',
    ...overrides,
  };
}

function makeRes() {
  const res = {
    _status: null,
    _body: null,
    headersSent: false,
    status(code) {
      res._status = code;
      return res;
    },
    json(body) {
      res._body = body;
      return res;
    },
  };
  return res;
}

beforeEach(() => {
  mockError.mockClear();
  mockWarn.mockClear();
});

describe('errorHandler', () => {
  test('returns 500 with INTERNAL_SERVER_ERROR for generic errors', () => {
    const err = new Error('Something broke');
    const req = makeReq();
    const res = makeRes();

    errorHandler(err, req, res, jest.fn());

    expect(res._status).toBe(500);
    expect(res._body.code).toBe('INTERNAL_SERVER_ERROR');
    expect(res._body.requestId).toBe('test-request-id');
  });

  test('logs 5xx errors with logger.error', () => {
    const err = new Error('Server failure');
    err.status = 500;

    errorHandler(err, makeReq(), makeRes(), jest.fn());

    expect(mockError).toHaveBeenCalledTimes(1);
    expect(mockWarn).not.toHaveBeenCalled();
  });

  test('returns 401 for AppError.unauthorized', () => {
    const err = AppError.unauthorized();
    const req = makeReq();
    const res = makeRes();

    errorHandler(err, req, res, jest.fn());

    expect(res._status).toBe(401);
    expect(res._body.code).toBe('UNAUTHORIZED');
    expect(res._body.message).toBe('Unauthorized');
    expect(res._body.requestId).toBe('test-request-id');
  });

  test('logs 4xx errors with logger.warn', () => {
    const err = AppError.unauthorized();

    errorHandler(err, makeReq(), makeRes(), jest.fn());

    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(mockError).not.toHaveBeenCalled();
  });

  test('returns 404 for AppError.notFound', () => {
    const err = AppError.notFound('Resource not found');
    const req = makeReq();
    const res = makeRes();

    errorHandler(err, req, res, jest.fn());

    expect(res._status).toBe(404);
    expect(res._body.code).toBe('NOT_FOUND');
    expect(res._body.message).toBe('Resource not found');
  });

  test('returns 422 with details for validation errors', () => {
    const zodError = {
      errors: [
        { path: ['email'], message: 'Invalid email format' },
        { path: ['password'], message: 'Must be at least 8 characters' },
      ],
    };
    const err = toValidationError(zodError);
    const req = makeReq();
    const res = makeRes();

    errorHandler(err, req, res, jest.fn());

    expect(res._status).toBe(422);
    expect(res._body.code).toBe('VALIDATION_ERROR');
    expect(res._body.message).toBe('Validation failed');
    expect(res._body.details).toEqual({
      fields: {
        email: 'Invalid email format',
        password: 'Must be at least 8 characters',
      },
    });
    expect(res._body.requestId).toBe('test-request-id');
  });

  test('logs 422 validation error with logger.warn (not error)', () => {
    const zodError = { errors: [{ path: ['name'], message: 'Required' }] };
    const err = toValidationError(zodError);

    errorHandler(err, makeReq(), makeRes(), jest.fn());

    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(mockError).not.toHaveBeenCalled();
  });

  test('does not include details field when not present', () => {
    const err = AppError.forbidden();
    const req = makeReq();
    const res = makeRes();

    errorHandler(err, req, res, jest.fn());

    expect(res._body).not.toHaveProperty('details');
  });

  test('does not send response when headers are already sent', () => {
    const err = new Error('Too late');
    const req = makeReq();
    const res = makeRes();
    res.headersSent = true;

    errorHandler(err, req, res, jest.fn());

    expect(res._status).toBeNull();
    expect(res._body).toBeNull();
  });

  test('includes requestId in log entry', () => {
    const err = AppError.notFound();
    const req = makeReq({ requestId: 'my-trace-123' });

    errorHandler(err, req, makeRes(), jest.fn());

    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'my-trace-123' })
    );
  });

  test('uses null requestId when req.requestId is missing', () => {
    const err = new Error('Oops');
    const req = makeReq({ requestId: undefined });
    const res = makeRes();

    errorHandler(err, req, res, jest.fn());

    expect(res._body.requestId).toBeNull();
  });

  test('includes stack in 5xx error log outside production', () => {
    const err = new Error('crash');
    err.status = 500;

    errorHandler(err, makeReq(), makeRes(), jest.fn());

    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({ stack: expect.any(String) })
    );
  });
});
