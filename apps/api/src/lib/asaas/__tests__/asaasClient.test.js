import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFetch = jest.fn();
const mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };

const mockConfig = {
  ASAAS_ENV: 'sandbox',
  ASAAS_API_KEY: 'test-key',
  ASAAS_BASE_URL: undefined,
  ASAAS_TIMEOUT_MS: 10000,
  ASAAS_MAX_RETRIES: 3,
  ASAAS_CB_FAILURE_THRESHOLD: 3,
  ASAAS_CB_RESET_TIMEOUT_MS: 100,
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

let asaas;
let asaasCircuitBreaker;

beforeAll(async () => {
  const mod = await import('../asaasClient.js');
  asaas = mod.asaas;
  asaasCircuitBreaker = mod.asaasCircuitBreaker;
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  // Reset circuit breaker so tests are independent
  asaasCircuitBreaker.reset();
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('asaasClient', () => {
  // -------------------------------------------------------------------------
  // Success cases
  // -------------------------------------------------------------------------

  test('200 — returns parsed JSON', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, { id: 'sub_123' }));

    const promise = asaas.getSubscription('sub_123');
    const expectation = expect(promise).resolves.toEqual({ id: 'sub_123' });
    await jest.runAllTimersAsync();
    await expectation;

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test('204 — returns null', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(204));

    const promise = asaas.cancelSubscription('sub_123');
    const expectation = expect(promise).resolves.toBeNull();
    await jest.runAllTimersAsync();
    await expectation;

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Non-retryable 4xx errors — fetch called exactly once
  // -------------------------------------------------------------------------

  test.each([400, 401, 403, 404, 422])(
    '%i — non-retryable, fetch called once and throws AppError',
    async (status) => {
      mockFetch.mockResolvedValue(makeResponse(status, { errors: ['err'] }));

      const promise = asaas.getSubscription('sub_abc');
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
    'HTTP %i — retries MAX_RETRIES times then throws',
    async (status) => {
      mockFetch.mockResolvedValue(makeResponse(status));

      const promise = asaas.getSubscription('sub_abc');
      const expectation = expect(promise).rejects.toMatchObject({ status: 500 });
      await jest.runAllTimersAsync();
      await expectation;

      // 1 initial + 3 retries = 4 calls
      expect(mockFetch).toHaveBeenCalledTimes(4);
    }
  );

  test('TypeError (network failure) — retries MAX_RETRIES times then throws', async () => {
    mockFetch.mockRejectedValue(new TypeError('network error'));

    const promise = asaas.getSubscription('sub_abc');
    const expectation = expect(promise).rejects.toMatchObject({ status: 500 });
    await jest.runAllTimersAsync();
    await expectation;

    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  test('AbortError — retries MAX_RETRIES times then throws', async () => {
    const abortErr = new DOMException('Aborted', 'AbortError');
    mockFetch.mockRejectedValue(abortErr);

    const promise = asaas.getSubscription('sub_abc');
    const expectation = expect(promise).rejects.toMatchObject({ status: 500 });
    await jest.runAllTimersAsync();
    await expectation;

    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  // -------------------------------------------------------------------------
  // Partial retry — fail first, succeed second
  // -------------------------------------------------------------------------

  test('fails on first attempt (500), succeeds on second', async () => {
    mockFetch
      .mockResolvedValueOnce(makeResponse(500))
      .mockResolvedValueOnce(makeResponse(200, { id: 'sub_ok' }));

    const promise = asaas.getSubscription('sub_abc');
    const expectation = expect(promise).resolves.toEqual({ id: 'sub_ok' });
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
      .mockResolvedValueOnce(makeResponse(200, { id: 'cus_ok' }));

    const promise = asaas.getSubscription('sub_abc');
    const expectation = expect(promise).resolves.toEqual({ id: 'cus_ok' });
    await jest.runAllTimersAsync();
    await expectation;

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  // Public API — getCustomerByEmail
  // -------------------------------------------------------------------------

  test('getCustomerByEmail — returns first item from data array', async () => {
    const customer = { id: 'cus_1', email: 'a@b.com' };
    mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [customer] }));

    const promise = asaas.getCustomerByEmail('a@b.com');
    const expectation = expect(promise).resolves.toEqual(customer);
    await jest.runAllTimersAsync();
    await expectation;

    const [calledUrl] = mockFetch.mock.calls[0];
    expect(calledUrl).toMatch('/customers?email=');
  });

  test('getCustomerByEmail — returns null when data array is empty', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }));

    const promise = asaas.getCustomerByEmail('notfound@example.com');
    const expectation = expect(promise).resolves.toBeNull();
    await jest.runAllTimersAsync();
    await expectation;
  });

  // -------------------------------------------------------------------------
  // Public API — createCustomer
  // -------------------------------------------------------------------------

  test('createCustomer — sends correct fields', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, { id: 'cus_new' }));

    const promise = asaas.createCustomer({ nome: 'Alice', email: 'alice@example.com', cpfCnpj: '123', telefone: '999' });
    await jest.runAllTimersAsync();
    await promise;

    const [, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body).toEqual({ name: 'Alice', email: 'alice@example.com', cpfCnpj: '123', mobilePhone: '999' });
  });

  // -------------------------------------------------------------------------
  // Public API — createSubscription
  // -------------------------------------------------------------------------

  test('createSubscription — sends correct fields', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, { id: 'sub_new' }));

    const params = {
      customer: 'cus_1',
      billingType: 'CREDIT_CARD',
      cycle: 'MONTHLY',
      value: 49.9,
      nextDueDate: '2026-04-01',
      description: 'Plano Pro',
      externalReference: 'ref_123',
    };
    const promise = asaas.createSubscription(params);
    await jest.runAllTimersAsync();
    await promise;

    const [calledUrl, init] = mockFetch.mock.calls[0];
    expect(calledUrl).toMatch('/subscriptions');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject(params);
  });

  // -------------------------------------------------------------------------
  // Public API — cancelSubscription
  // -------------------------------------------------------------------------

  test('cancelSubscription — sends DELETE to /subscriptions/:id', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(204));

    const promise = asaas.cancelSubscription('sub_del');
    await jest.runAllTimersAsync();
    await promise;

    const [calledUrl, init] = mockFetch.mock.calls[0];
    expect(calledUrl).toMatch('/subscriptions/sub_del');
    expect(init.method).toBe('DELETE');
  });

  // -------------------------------------------------------------------------
  // Public API — getSubscription
  // -------------------------------------------------------------------------

  test('getSubscription — sends GET to /subscriptions/:id', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, { id: 'sub_get' }));

    const promise = asaas.getSubscription('sub_get');
    const expectation = expect(promise).resolves.toEqual({ id: 'sub_get' });
    await jest.runAllTimersAsync();
    await expectation;

    const [calledUrl, init] = mockFetch.mock.calls[0];
    expect(calledUrl).toMatch('/subscriptions/sub_get');
    expect(init.method).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Public API — getPaymentsBySubscription
  // -------------------------------------------------------------------------

  test('getPaymentsBySubscription — GET with query string', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }));

    const promise = asaas.getPaymentsBySubscription('sub_pay');
    await jest.runAllTimersAsync();
    await promise;

    const [calledUrl] = mockFetch.mock.calls[0];
    expect(calledUrl).toMatch('/payments?subscription=');
    expect(calledUrl).toMatch('sub_pay');
  });

  // -------------------------------------------------------------------------
  // Circuit breaker integration
  // -------------------------------------------------------------------------

  describe('circuit breaker', () => {
    test('opens after ASAAS_CB_FAILURE_THRESHOLD consecutive retry-exhausting failures', async () => {
      // Each getSubscription call exhausts all retries (1 initial + 3 retries = 4 fetches)
      // After ASAAS_CB_FAILURE_THRESHOLD (3) such failures the circuit opens
      mockFetch.mockResolvedValue(makeResponse(500));

      for (let i = 0; i < mockConfig.ASAAS_CB_FAILURE_THRESHOLD; i++) {
        const promise = asaas.getSubscription('sub_abc');
        const expectation = expect(promise).rejects.toMatchObject({ status: 500 });
        await jest.runAllTimersAsync();
        await expectation;
      }

      expect(asaasCircuitBreaker.state).toBe('open');
    });

    test('when open — rejects immediately without calling fetch', async () => {
      // Open the circuit
      mockFetch.mockResolvedValue(makeResponse(500));
      for (let i = 0; i < mockConfig.ASAAS_CB_FAILURE_THRESHOLD; i++) {
        const promise = asaas.getSubscription('sub_abc');
        const expectation = expect(promise).rejects.toMatchObject({ status: 500 });
        await jest.runAllTimersAsync();
        await expectation;
      }

      mockFetch.mockClear();

      const promise = asaas.getSubscription('sub_abc');
      const expectation = expect(promise).rejects.toMatchObject({ status: 500 });
      await jest.runAllTimersAsync();
      await expectation;

      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('half_open — closes circuit on successful probe after reset timeout', async () => {
      // Open the circuit
      mockFetch.mockResolvedValue(makeResponse(500));
      for (let i = 0; i < mockConfig.ASAAS_CB_FAILURE_THRESHOLD; i++) {
        const promise = asaas.getSubscription('sub_abc');
        const expectation = expect(promise).rejects.toMatchObject({ status: 500 });
        await jest.runAllTimersAsync();
        await expectation;
      }

      // Advance time past ASAAS_CB_RESET_TIMEOUT_MS (100ms)
      jest.advanceTimersByTime(101);

      // Probe succeeds → circuit closes
      mockFetch.mockResolvedValueOnce(makeResponse(200, { id: 'sub_recovered' }));
      const promise = asaas.getSubscription('sub_recovered');
      const expectation = expect(promise).resolves.toEqual({ id: 'sub_recovered' });
      await jest.runAllTimersAsync();
      await expectation;

      expect(asaasCircuitBreaker.state).toBe('closed');
    });
  });
});

