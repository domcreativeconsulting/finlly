import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };

jest.unstable_mockModule('../../logger.js', () => ({ default: mockLogger }));
jest.unstable_mockModule('../../errors/AppError.js', () => ({
  AppError: {
    internal: (msg) => ({ code: 'INTERNAL_SERVER_ERROR', status: 500, message: msg }),
  },
}));

// ---------------------------------------------------------------------------
// Module under test (loaded after mocks)
// ---------------------------------------------------------------------------

let CircuitBreaker;

beforeAll(async () => {
  const mod = await import('../circuitBreaker.js');
  CircuitBreaker = mod.CircuitBreaker;
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBreaker(opts = {}) {
  return new CircuitBreaker({ name: 'test', failureThreshold: 3, resetTimeoutMs: 1000, ...opts });
}

async function failN(cb, n) {
  for (let i = 0; i < n; i++) {
    await expect(cb.execute(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CircuitBreaker', () => {
  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  test('starts in closed state', () => {
    const cb = makeBreaker();
    expect(cb.state).toBe('closed');
  });

  // -------------------------------------------------------------------------
  // Closed state — normal operation
  // -------------------------------------------------------------------------

  test('closed: execute returns the result of fn', async () => {
    const cb = makeBreaker();
    const result = await cb.execute(() => Promise.resolve(42));
    expect(result).toBe(42);
    expect(cb.state).toBe('closed');
  });

  test('closed: execute propagates rejection from fn', async () => {
    const cb = makeBreaker();
    await expect(cb.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow('fail');
    expect(cb.state).toBe('closed'); // below threshold
  });

  test('closed: failure count increments but circuit stays closed below threshold', async () => {
    const cb = makeBreaker({ failureThreshold: 3 });
    await failN(cb, 2); // 2 failures < threshold of 3
    expect(cb.state).toBe('closed');
  });

  // -------------------------------------------------------------------------
  // Threshold — closed → open
  // -------------------------------------------------------------------------

  test('opens after failureThreshold consecutive failures', async () => {
    const cb = makeBreaker({ failureThreshold: 3 });
    await failN(cb, 3);
    expect(cb.state).toBe('open');
  });

  test('success resets failure count so threshold restarts', async () => {
    const cb = makeBreaker({ failureThreshold: 3 });
    await failN(cb, 2);
    await cb.execute(() => Promise.resolve('ok')); // success resets count
    await failN(cb, 2); // 2 more failures — still below threshold
    expect(cb.state).toBe('closed');
  });

  // -------------------------------------------------------------------------
  // Open state — fast fail
  // -------------------------------------------------------------------------

  test('open: execute throws AppError immediately without calling fn', async () => {
    const cb = makeBreaker({ failureThreshold: 1 });
    await failN(cb, 1); // open the circuit

    const fn = jest.fn();
    await expect(cb.execute(fn)).rejects.toMatchObject({ status: 500, code: 'INTERNAL_SERVER_ERROR' });
    expect(fn).not.toHaveBeenCalled();
  });

  test('open: logs a warning on each rejected request', async () => {
    const cb = makeBreaker({ failureThreshold: 1 });
    await failN(cb, 1);

    await expect(cb.execute(() => Promise.resolve())).rejects.toBeDefined();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'test', state: 'open' }),
      expect.any(String)
    );
  });

  // -------------------------------------------------------------------------
  // open → half_open after reset timeout
  // -------------------------------------------------------------------------

  test('transitions to half_open after resetTimeoutMs elapses', async () => {
    const cb = makeBreaker({ failureThreshold: 1, resetTimeoutMs: 1000 });
    await failN(cb, 1); // open
    expect(cb.state).toBe('open');

    jest.advanceTimersByTime(1001); // past the timeout

    // Attempting a call transitions to half_open and executes fn
    const fn = jest.fn().mockResolvedValue('probe-ok');
    await cb.execute(fn);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(cb.state).toBe('closed');
  });

  test('does NOT transition to half_open if timeout has not elapsed', async () => {
    const cb = makeBreaker({ failureThreshold: 1, resetTimeoutMs: 1000 });
    await failN(cb, 1);

    jest.advanceTimersByTime(500); // not enough time

    const fn = jest.fn();
    await expect(cb.execute(fn)).rejects.toMatchObject({ status: 500 });
    expect(fn).not.toHaveBeenCalled();
    expect(cb.state).toBe('open');
  });

  // -------------------------------------------------------------------------
  // Half-open state
  // -------------------------------------------------------------------------

  test('half_open: success → closed, failure count reset', async () => {
    const cb = makeBreaker({ failureThreshold: 1, resetTimeoutMs: 1000 });
    await failN(cb, 1);
    jest.advanceTimersByTime(1001);

    await cb.execute(() => Promise.resolve('recovered'));

    expect(cb.state).toBe('closed');
  });

  test('half_open: failure → open again', async () => {
    const cb = makeBreaker({ failureThreshold: 1, resetTimeoutMs: 1000 });
    await failN(cb, 1);
    jest.advanceTimersByTime(1001);

    // Probe fails → back to open
    await expect(cb.execute(() => Promise.reject(new Error('still down')))).rejects.toThrow('still down');
    expect(cb.state).toBe('open');
  });

  // -------------------------------------------------------------------------
  // reset()
  // -------------------------------------------------------------------------

  test('reset() returns circuit to closed state', async () => {
    const cb = makeBreaker({ failureThreshold: 1 });
    await failN(cb, 1);
    expect(cb.state).toBe('open');

    cb.reset();

    expect(cb.state).toBe('closed');
    const result = await cb.execute(() => Promise.resolve('after-reset'));
    expect(result).toBe('after-reset');
  });

  test('reset() clears failure count so threshold restarts from zero', async () => {
    const cb = makeBreaker({ failureThreshold: 3 });
    await failN(cb, 2); // 2 failures
    cb.reset();
    await failN(cb, 2); // 2 failures again after reset — still below threshold
    expect(cb.state).toBe('closed');
  });
});
