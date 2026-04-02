import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFetch = jest.fn();
const mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };

const mockConfig = {
  EVOLUTION_API_URL: 'http://evolution.test',
  EVOLUTION_API_KEY: 'test-key',
  EVOLUTION_INSTANCE: 'test-instance',
  EVOLUTION_TIMEOUT_MS: 8000,
  EVOLUTION_MAX_RETRIES: 2,
};

jest.unstable_mockModule('../../../config/env.js', () => ({
  config: mockConfig,
}));

jest.unstable_mockModule('../../../logger.js', () => ({
  default: mockLogger,
}));

global.fetch = mockFetch;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a minimal Response-like object.
 */
function makeResponse(status, body = null, headers = {}) {
  const responseHeaders = new Map(Object.entries(headers));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => responseHeaders.get(name) ?? null },
    json: jest.fn().mockResolvedValue(body),
  };
}

// ---------------------------------------------------------------------------
// Module under test (loaded after mocks)
// ---------------------------------------------------------------------------

let sendText;
let evolutionClient;

beforeAll(async () => {
  const mod = await import('../evolutionClient.js');
  sendText = mod.sendText;
  evolutionClient = mod.evolutionClient;
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  // Restore default config values
  mockConfig.EVOLUTION_API_URL = 'http://evolution.test';
  mockConfig.EVOLUTION_API_KEY = 'test-key';
  mockConfig.EVOLUTION_INSTANCE = 'test-instance';
  mockConfig.EVOLUTION_TIMEOUT_MS = 8000;
  mockConfig.EVOLUTION_MAX_RETRIES = 2;
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('evolutionClient', () => {
  // -------------------------------------------------------------------------
  // Exports
  // -------------------------------------------------------------------------

  test('exports sendText function and evolutionClient object', () => {
    expect(typeof sendText).toBe('function');
    expect(typeof evolutionClient).toBe('object');
    expect(typeof evolutionClient.sendText).toBe('function');
  });

  // -------------------------------------------------------------------------
  // Configuration validation
  // -------------------------------------------------------------------------

  test('throws AppError when EVOLUTION_API_URL is not configured', async () => {
    mockConfig.EVOLUTION_API_URL = undefined;

    await expect(sendText('5511999999999', 'hello')).rejects.toMatchObject({
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('throws AppError when EVOLUTION_API_KEY is not configured', async () => {
    mockConfig.EVOLUTION_API_KEY = undefined;

    await expect(sendText('5511999999999', 'hello')).rejects.toMatchObject({
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('throws AppError when EVOLUTION_INSTANCE is not configured', async () => {
    mockConfig.EVOLUTION_INSTANCE = undefined;

    await expect(sendText('5511999999999', 'hello')).rejects.toMatchObject({
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Success case
  // -------------------------------------------------------------------------

  test('200 — returns parsed JSON body', async () => {
    const responseBody = { key: { id: 'msg_123' }, status: 'PENDING' };
    mockFetch.mockResolvedValueOnce(makeResponse(200, responseBody));

    const promise = sendText('5511999999999', 'hello');
    const expectation = expect(promise).resolves.toEqual(responseBody);
    await jest.runAllTimersAsync();
    await expectation;

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test('sends POST to correct URL with correct headers and body', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, {}));

    const promise = sendText('5511999999999', 'test message');
    await jest.runAllTimersAsync();
    await promise;

    const [calledUrl, init] = mockFetch.mock.calls[0];
    expect(calledUrl).toBe('http://evolution.test/message/sendText/test-instance');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['apikey']).toBe('test-key');
    const body = JSON.parse(init.body);
    expect(body).toEqual({ number: '5511999999999', text: 'test message' });
  });

  // -------------------------------------------------------------------------
  // Non-retryable 4xx errors — fetch called exactly once
  // -------------------------------------------------------------------------

  test.each([400, 401, 403, 404, 422])(
    'HTTP %i — non-retryable, fetch called once and throws AppError',
    async (status) => {
      mockFetch.mockResolvedValue(makeResponse(status, { error: 'bad request' }));

      const promise = sendText('5511999999999', 'hello');
      const expectation = expect(promise).rejects.toMatchObject({ status: 500, code: 'INTERNAL_SERVER_ERROR' });
      await jest.runAllTimersAsync();
      await expectation;

      expect(mockFetch).toHaveBeenCalledTimes(1);
    }
  );

  // -------------------------------------------------------------------------
  // Retryable errors — exhaust all attempts
  // -------------------------------------------------------------------------

  test.each([500, 502, 503, 504])(
    'HTTP %i — retries EVOLUTION_MAX_RETRIES times then throws',
    async (status) => {
      mockFetch.mockResolvedValue(makeResponse(status));

      const promise = sendText('5511999999999', 'hello');
      const expectation = expect(promise).rejects.toMatchObject({ status: 500 });
      await jest.runAllTimersAsync();
      await expectation;

      // 1 initial + 2 retries = 3 calls
      expect(mockFetch).toHaveBeenCalledTimes(3);
    }
  );

  test('HTTP 429 — retries EVOLUTION_MAX_RETRIES times then throws', async () => {
    mockFetch.mockResolvedValue(makeResponse(429));

    const promise = sendText('5511999999999', 'hello');
    const expectation = expect(promise).rejects.toMatchObject({ status: 500 });
    await jest.runAllTimersAsync();
    await expectation;

    // 1 initial + 2 retries = 3 calls
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  // -------------------------------------------------------------------------
  // Network and timeout errors
  // -------------------------------------------------------------------------

  test('TypeError (network failure) — retries EVOLUTION_MAX_RETRIES times then throws', async () => {
    mockFetch.mockRejectedValue(new TypeError('network error'));

    const promise = sendText('5511999999999', 'hello');
    const expectation = expect(promise).rejects.toMatchObject({ status: 500 });
    await jest.runAllTimersAsync();
    await expectation;

    // 1 initial + 2 retries = 3 calls
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  test('AbortError (timeout) — retries EVOLUTION_MAX_RETRIES times then throws', async () => {
    const abortErr = new DOMException('Aborted', 'AbortError');
    mockFetch.mockRejectedValue(abortErr);

    const promise = sendText('5511999999999', 'hello');
    const expectation = expect(promise).rejects.toMatchObject({ status: 500 });
    await jest.runAllTimersAsync();
    await expectation;

    // 1 initial + 2 retries = 3 calls
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  // -------------------------------------------------------------------------
  // Partial retry — fail first, succeed second
  // -------------------------------------------------------------------------

  test('fails on first attempt (500), succeeds on second', async () => {
    const responseBody = { key: { id: 'msg_ok' } };
    mockFetch
      .mockResolvedValueOnce(makeResponse(500))
      .mockResolvedValueOnce(makeResponse(200, responseBody));

    const promise = sendText('5511999999999', 'hello');
    const expectation = expect(promise).resolves.toEqual(responseBody);
    await jest.runAllTimersAsync();
    await expectation;

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  // HTTP 429 with Retry-After header
  // -------------------------------------------------------------------------

  test('HTTP 429 with Retry-After header — respects delay then succeeds', async () => {
    const responseBody = { key: { id: 'msg_retry' } };
    mockFetch
      .mockResolvedValueOnce(makeResponse(429, null, { 'Retry-After': '1' }))
      .mockResolvedValueOnce(makeResponse(200, responseBody));

    const promise = sendText('5511999999999', 'hello');
    const expectation = expect(promise).resolves.toEqual(responseBody);
    await jest.runAllTimersAsync();
    await expectation;

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  // AbortController timeout per attempt
  // -------------------------------------------------------------------------

  test('uses AbortController with timeout for each attempt', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, { ok: true }));

    const promise = sendText('5511999999999', 'hello');
    await jest.runAllTimersAsync();
    await promise;

    const [, init] = mockFetch.mock.calls[0];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  // -------------------------------------------------------------------------
  // Exhaust retries — AppError thrown
  // -------------------------------------------------------------------------

  test('exhausts all retries and throws AppError', async () => {
    mockFetch.mockRejectedValue(new TypeError('connection refused'));

    const promise = sendText('5511999999999', 'hello');
    const expectation = expect(promise).rejects.toMatchObject({
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
    });
    await jest.runAllTimersAsync();
    await expectation;

    // With EVOLUTION_MAX_RETRIES=2: 1 initial + 2 retries = 3 total
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
