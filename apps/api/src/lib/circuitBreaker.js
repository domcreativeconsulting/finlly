import logger from '../logger.js';
import { AppError } from '../errors/AppError.js';

const STATE_CLOSED = 'closed';
const STATE_OPEN = 'open';
const STATE_HALF_OPEN = 'half_open';

/**
 * A lightweight circuit breaker that wraps async operations.
 *
 * State machine:
 *   closed    → open:      after `failureThreshold` consecutive failures
 *   open      → half_open: after `resetTimeoutMs` milliseconds have elapsed
 *   half_open → closed:    first probe call succeeds
 *   half_open → open:      probe call fails
 *
 * @example
 * const cb = new CircuitBreaker({ name: 'myService', failureThreshold: 5, resetTimeoutMs: 30_000 });
 * const result = await cb.execute(() => callMyService());
 */
export class CircuitBreaker {
  #name;
  #failureThreshold;
  #resetTimeoutMs;
  #state = STATE_CLOSED;
  #failureCount = 0;
  #lastFailureTime = null;

  /**
   * @param {{ name: string, failureThreshold?: number, resetTimeoutMs?: number }} options
   */
  constructor({ name, failureThreshold = 5, resetTimeoutMs = 30_000 }) {
    this.#name = name;
    this.#failureThreshold = failureThreshold;
    this.#resetTimeoutMs = resetTimeoutMs;
  }

  /** Current state: 'closed' | 'open' | 'half_open' */
  get state() {
    return this.#state;
  }

  /**
   * Resets the circuit breaker to its initial closed state.
   * Primarily intended for use in tests to ensure a clean slate between cases.
   */
  reset() {
    this.#state = STATE_CLOSED;
    this.#failureCount = 0;
    this.#lastFailureTime = null;
  }

  /**
   * Executes `fn` guarded by the circuit breaker.
   *
   * - **open** (within reset timeout):  rejects immediately without calling `fn`.
   * - **open** (timeout elapsed):       transitions to half_open and allows one probe.
   * - **closed** / **half_open**:       calls `fn` and tracks the outcome.
   *   - Success → closes the circuit and resets the failure counter.
   *   - Failure → increments the counter; opens the circuit when the threshold is reached.
   *
   * @template T
   * @param {() => Promise<T>} fn - The async operation to protect.
   * @returns {Promise<T>}
   * @throws {AppError} If the circuit is open, or if `fn` itself throws.
   */
  async execute(fn) {
    if (this.#state === STATE_OPEN) {
      const elapsed = Date.now() - this.#lastFailureTime;
      if (elapsed < this.#resetTimeoutMs) {
        logger.warn({ name: this.#name, state: this.#state }, 'Circuit breaker open — request rejected');
        throw AppError.internal(`Serviço temporariamente indisponível (${this.#name})`);
      }
      this.#state = STATE_HALF_OPEN;
      logger.info({ name: this.#name }, 'Circuit breaker half-open — probing service');
    }

    try {
      const result = await fn();
      this.#onSuccess();
      return result;
    } catch (err) {
      this.#onFailure();
      throw err;
    }
  }

  #onSuccess() {
    if (this.#state === STATE_HALF_OPEN) {
      logger.info({ name: this.#name }, 'Circuit breaker closed — service recovered');
    }
    this.#state = STATE_CLOSED;
    this.#failureCount = 0;
    this.#lastFailureTime = null;
  }

  #onFailure() {
    this.#failureCount += 1;
    this.#lastFailureTime = Date.now();
    if (this.#state === STATE_HALF_OPEN || this.#failureCount >= this.#failureThreshold) {
      this.#state = STATE_OPEN;
      logger.error(
        { name: this.#name, failures: this.#failureCount, threshold: this.#failureThreshold },
        'Circuit breaker opened'
      );
    }
  }
}
