import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFetch = jest.fn();
const mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };

const mockConfig = {
  EVOLUTION_API_URL: 'https://evolution.test',
  EVOLUTION_API_KEY: 'test-api-key',
  EVOLUTION_INSTANCE: 'test-instance',
  EVOLUTION_TIMEOUT_MS: 8000,
  EVOLUTION_MAX_RETRIES: 2,
  EVOLUTION_CB_FAILURE_THRESHOLD: 3,
  EVOLUTION_CB_RESET_TIMEOUT_MS: 100,
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

let evo;
let evolutionCircuitBreaker;

beforeAll(async () => {
  const mod = await import('../evolutionClient.js');
  evo = mod.evolutionClient;
  evolutionCircuitBreaker = mod.evolutionCircuitBreaker;
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  // Restore valid defaults before each test
  mockConfig.EVOLUTION_API_URL = 'https://evolution.test';
  mockConfig.EVOLUTION_API_KEY = 'test-api-key';
  mockConfig.EVOLUTION_INSTANCE = 'test-instance';
  mockConfig.EVOLUTION_TIMEOUT_MS = 8000;
  mockConfig.EVOLUTION_MAX_RETRIES = 2;
  // Reset circuit breaker so tests are independent
  evolutionCircuitBreaker.reset();
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('evolutionClient', () => {
  // -------------------------------------------------------------------------
  // Missing config — throw immediately without fetching
  // -------------------------------------------------------------------------

  test.each([
    ['EVOLUTION_API_URL', { EVOLUTION_API_URL: undefined }],
    ['EVOLUTION_API_KEY', { EVOLUTION_API_KEY: undefined }],
    ['EVOLUTION_INSTANCE', { EVOLUTION_INSTANCE: undefined }],
  ])('missing %s — throws AppError without fetching', async (_field, overrides) => {
    Object.assign(mockConfig, overrides);

    const promise = evo.sendText('5511999999999', 'hello');
    const expectation = expect(promise).rejects.toMatchObject({ status: 500 });
    await jest.runAllTimersAsync();
    await expectation;

    expect(mockFetch).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Success cases
  // -------------------------------------------------------------------------

  test('200 — returns parsed JSON', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, { key: { id: 'msg_123' } }));

    const promise = evo.sendText('5511999999999', 'hello');
    const expectation = expect(promise).resolves.toEqual({ key: { id: 'msg_123' } });
    await jest.runAllTimersAsync();
    await expectation;

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Non-retryable 4xx errors — fetch called exactly once
  // -------------------------------------------------------------------------

  test.each([400, 401, 403, 404, 422])(
    'HTTP %i — non-retryable, fetch called once and throws AppError',
    async (status) => {
      mockFetch.mockResolvedValue(makeResponse(status, { error: 'bad request' }));

      const promise = evo.sendText('5511999999999', 'hello');
      const expectation = expect(promise).rejects.toMatchObject({ status: 500, code: 'INTERNAL_SERVER_ERROR' });
      await jest.runAllTimersAsync();
      await expectation;

      expect(mockFetch).toHaveBeenCalledTimes(1);
    }
  );

  // -------------------------------------------------------------------------
  // Retryable errors — exhaust all attempts
  // -------------------------------------------------------------------------

  test.each([429, 500, 502, 503, 504])(
    'HTTP %i — retries MAX_RETRIES times then throws',
    async (status) => {
      mockFetch.mockResolvedValue(makeResponse(status));

      const promise = evo.sendText('5511999999999', 'hello');
      const expectation = expect(promise).rejects.toMatchObject({ status: 500 });
      await jest.runAllTimersAsync();
      await expectation;

      // 1 initial + 2 retries = 3 calls (EVOLUTION_MAX_RETRIES=2)
      expect(mockFetch).toHaveBeenCalledTimes(3);
    }
  );

  test('TypeError (network failure) — retries MAX_RETRIES times then throws', async () => {
    mockFetch.mockRejectedValue(new TypeError('network error'));

    const promise = evo.sendText('5511999999999', 'hello');
    const expectation = expect(promise).rejects.toMatchObject({ status: 500 });
    await jest.runAllTimersAsync();
    await expectation;

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  test('AbortError — retries MAX_RETRIES times then throws', async () => {
    const abortErr = new DOMException('Aborted', 'AbortError');
    mockFetch.mockRejectedValue(abortErr);

    const promise = evo.sendText('5511999999999', 'hello');
    const expectation = expect(promise).rejects.toMatchObject({ status: 500 });
    await jest.runAllTimersAsync();
    await expectation;

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  // -------------------------------------------------------------------------
  // Partial retry — fail first, succeed second
  // -------------------------------------------------------------------------

  test('fails on first attempt (500), succeeds on second', async () => {
    mockFetch
      .mockResolvedValueOnce(makeResponse(500))
      .mockResolvedValueOnce(makeResponse(200, { key: { id: 'msg_ok' } }));

    const promise = evo.sendText('5511999999999', 'hello');
    const expectation = expect(promise).resolves.toEqual({ key: { id: 'msg_ok' } });
    await jest.runAllTimersAsync();
    await expectation;

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  // HTTP 429 with Retry-After header
  // -------------------------------------------------------------------------

  test('HTTP 429 with Retry-After header — respects delay then succeeds', async () => {
    mockFetch
      .mockResolvedValueOnce(makeResponse(429, null, { 'Retry-After': '1' }))
      .mockResolvedValueOnce(makeResponse(200, { key: { id: 'msg_ok' } }));

    const promise = evo.sendText('5511999999999', 'hello');
    const expectation = expect(promise).resolves.toEqual({ key: { id: 'msg_ok' } });
    await jest.runAllTimersAsync();
    await expectation;

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  // AbortController signal is passed to each fetch attempt
  // -------------------------------------------------------------------------

  test('AbortController signal is passed to each fetch attempt', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, { key: { id: 'msg_sig' } }));

    const promise = evo.sendText('5511999999999', 'hello');
    await jest.runAllTimersAsync();
    await promise;

    const [, init] = mockFetch.mock.calls[0];
    expect(init.signal).toBeDefined();
    expect(init.signal).not.toBeNull();
    expect(typeof init.signal.aborted).toBe('boolean');
  });

  // -------------------------------------------------------------------------
  // Circuit breaker integration
  // -------------------------------------------------------------------------

  describe('circuit breaker', () => {
    test('opens after EVOLUTION_CB_FAILURE_THRESHOLD consecutive retry-exhausting failures', async () => {
      // Each sendText call exhausts all retries (1 initial + 2 retries = 3 fetches)
      // After EVOLUTION_CB_FAILURE_THRESHOLD (3) such failures the circuit opens
      mockFetch.mockResolvedValue(makeResponse(500));

      for (let i = 0; i < mockConfig.EVOLUTION_CB_FAILURE_THRESHOLD; i++) {
        const promise = evo.sendText('5511999999999', 'hello');
        const expectation = expect(promise).rejects.toMatchObject({ status: 500 });
        await jest.runAllTimersAsync();
        await expectation;
      }

      expect(evolutionCircuitBreaker.state).toBe('open');
    });

    test('when open — rejects immediately without calling fetch', async () => {
      // Open the circuit
      mockFetch.mockResolvedValue(makeResponse(500));
      for (let i = 0; i < mockConfig.EVOLUTION_CB_FAILURE_THRESHOLD; i++) {
        const promise = evo.sendText('5511999999999', 'hello');
        const expectation = expect(promise).rejects.toMatchObject({ status: 500 });
        await jest.runAllTimersAsync();
        await expectation;
      }

      mockFetch.mockClear();

      const promise = evo.sendText('5511999999999', 'hello');
      const expectation = expect(promise).rejects.toMatchObject({ status: 500 });
      await jest.runAllTimersAsync();
      await expectation;

      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('half_open — closes circuit on successful probe after reset timeout', async () => {
      // Open the circuit
      mockFetch.mockResolvedValue(makeResponse(500));
      for (let i = 0; i < mockConfig.EVOLUTION_CB_FAILURE_THRESHOLD; i++) {
        const promise = evo.sendText('5511999999999', 'hello');
        const expectation = expect(promise).rejects.toMatchObject({ status: 500 });
        await jest.runAllTimersAsync();
        await expectation;
      }

      // Advance time past EVOLUTION_CB_RESET_TIMEOUT_MS (100ms)
      jest.advanceTimersByTime(101);

      // Probe succeeds → circuit closes
      mockFetch.mockResolvedValueOnce(makeResponse(200, { key: { id: 'msg_recovered' } }));
      const promise = evo.sendText('5511999999999', 'hello');
      const expectation = expect(promise).resolves.toEqual({ key: { id: 'msg_recovered' } });
      await jest.runAllTimersAsync();
      await expectation;

      expect(evolutionCircuitBreaker.state).toBe('closed');
    });
  });
});
