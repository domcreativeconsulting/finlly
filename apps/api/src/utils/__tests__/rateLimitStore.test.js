import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRedis = {
  incr: jest.fn(),
  expire: jest.fn(),
  decr: jest.fn(),
  del: jest.fn(),
};

const mockGetRedisClient = jest.fn();

const mockConfig = {
  NODE_ENV: 'production',
  RATE_LIMIT_STORE: 'redis',
};

const mockIpKeyGenerator = jest.fn();

jest.unstable_mockModule('../../utils/redisClient.js', () => ({
  getRedisClient: mockGetRedisClient,
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  config: mockConfig,
}));

jest.unstable_mockModule('express-rate-limit', () => ({
  ipKeyGenerator: mockIpKeyGenerator,
}));

// ---------------------------------------------------------------------------
// Module under test (imported after mocks)
// ---------------------------------------------------------------------------

let buildStore;
let userOrIpKeyGenerator;

beforeAll(async () => {
  const mod = await import('../rateLimitStore.js');
  buildStore = mod.buildStore;
  userOrIpKeyGenerator = mod.userOrIpKeyGenerator;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetRedisClient.mockResolvedValue(mockRedis);
  mockRedis.incr.mockResolvedValue(1);
  mockRedis.expire.mockResolvedValue(1);
  mockRedis.decr.mockResolvedValue(0);
  mockRedis.del.mockResolvedValue(1);
  mockConfig.NODE_ENV = 'production';
  mockConfig.RATE_LIMIT_STORE = 'redis';
});

// ---------------------------------------------------------------------------
// buildStore — skip conditions
// ---------------------------------------------------------------------------

describe('buildStore — skip conditions', () => {
  test('returns undefined in development environment', () => {
    mockConfig.NODE_ENV = 'development';
    expect(buildStore(60_000)).toBeUndefined();
  });

  test('returns undefined when RATE_LIMIT_STORE is "memory"', () => {
    mockConfig.RATE_LIMIT_STORE = 'memory';
    expect(buildStore(60_000)).toBeUndefined();
  });

  test('returns a store object when NODE_ENV is production and RATE_LIMIT_STORE is redis', () => {
    const store = buildStore(60_000);
    expect(store).toBeDefined();
    expect(typeof store.increment).toBe('function');
    expect(typeof store.decrement).toBe('function');
    expect(typeof store.resetKey).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// buildStore — increment
// ---------------------------------------------------------------------------

describe('buildStore — increment', () => {
  test('increments the Redis key and returns totalHits', async () => {
    mockRedis.incr.mockResolvedValue(3);
    const store = buildStore(60_000);

    const result = await store.increment('rl:test-key');

    expect(mockRedis.incr).toHaveBeenCalledWith('rl:test-key');
    expect(result.totalHits).toBe(3);
    expect(result.resetTime).toBeInstanceOf(Date);
  });

  test('sets expiry only on the first increment (value === 1)', async () => {
    mockRedis.incr.mockResolvedValue(1);
    const store = buildStore(60_000); // 60s window

    await store.increment('rl:first-key');

    expect(mockRedis.expire).toHaveBeenCalledWith('rl:first-key', 60);
  });

  test('does not set expiry when increment returns value > 1', async () => {
    mockRedis.incr.mockResolvedValue(2);
    const store = buildStore(60_000);

    await store.increment('rl:second-key');

    expect(mockRedis.expire).not.toHaveBeenCalled();
  });

  test('windowSeconds is ceil(windowMs / 1000)', async () => {
    mockRedis.incr.mockResolvedValue(1);
    const store = buildStore(90_500); // 90.5 s → ceil → 91

    await store.increment('rl:ceil-key');

    expect(mockRedis.expire).toHaveBeenCalledWith('rl:ceil-key', 91);
  });

  test('returns totalHits=0 and a future resetTime when Redis is unavailable (fail-open)', async () => {
    mockGetRedisClient.mockRejectedValue(new Error('Redis down'));
    const store = buildStore(60_000);

    const before = Date.now();
    const result = await store.increment('rl:redis-down');
    const after = Date.now();

    expect(result.totalHits).toBe(0);
    expect(result.resetTime.getTime()).toBeGreaterThanOrEqual(before + 60_000);
    expect(result.resetTime.getTime()).toBeLessThanOrEqual(after + 60_000);
  });
});

// ---------------------------------------------------------------------------
// buildStore — decrement
// ---------------------------------------------------------------------------

describe('buildStore — decrement', () => {
  test('decrements the Redis key', async () => {
    const store = buildStore(60_000);

    await store.decrement('rl:dec-key');

    expect(mockRedis.decr).toHaveBeenCalledWith('rl:dec-key');
  });

  test('silently ignores Redis errors', async () => {
    mockGetRedisClient.mockRejectedValue(new Error('Redis down'));
    const store = buildStore(60_000);

    await expect(store.decrement('rl:dec-key')).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// buildStore — resetKey
// ---------------------------------------------------------------------------

describe('buildStore — resetKey', () => {
  test('deletes the Redis key', async () => {
    const store = buildStore(60_000);

    await store.resetKey('rl:reset-key');

    expect(mockRedis.del).toHaveBeenCalledWith('rl:reset-key');
  });

  test('silently ignores Redis errors', async () => {
    mockGetRedisClient.mockRejectedValue(new Error('Redis down'));
    const store = buildStore(60_000);

    await expect(store.resetKey('rl:reset-key')).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// userOrIpKeyGenerator
// ---------------------------------------------------------------------------

describe('userOrIpKeyGenerator', () => {
  beforeEach(() => {
    mockIpKeyGenerator.mockReturnValue('1.2.3.4');
  });

  test('returns req.user.sub when available', () => {
    const req = { user: { sub: 'user-uuid-123' } };
    expect(userOrIpKeyGenerator(req)).toBe('user-uuid-123');
    expect(mockIpKeyGenerator).not.toHaveBeenCalled();
  });

  test('falls back to IP when req.user is undefined', () => {
    const req = { user: undefined };
    expect(userOrIpKeyGenerator(req)).toBe('1.2.3.4');
    expect(mockIpKeyGenerator).toHaveBeenCalledWith(req);
  });

  test('falls back to IP when req.user.sub is null', () => {
    const req = { user: { sub: null } };
    expect(userOrIpKeyGenerator(req)).toBe('1.2.3.4');
    expect(mockIpKeyGenerator).toHaveBeenCalledWith(req);
  });

  test('falls back to IP when req.user.sub is undefined', () => {
    const req = { user: { sub: undefined } };
    expect(userOrIpKeyGenerator(req)).toBe('1.2.3.4');
    expect(mockIpKeyGenerator).toHaveBeenCalledWith(req);
  });
});
