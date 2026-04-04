import { ipKeyGenerator } from 'express-rate-limit';
import { getRedisClient } from './redisClient.js';
import { config } from '../config/env.js';

/**
 * Builds an express-rate-limit compatible store backed by Redis when
 * RATE_LIMIT_STORE=redis, or returns undefined (MemoryStore default) otherwise.
 *
 * Falls back gracefully when Redis is unavailable: increment() returns
 * totalHits=0 so the request is allowed through (fail-open), preventing
 * Redis outages from blocking legitimate traffic.
 *
 * @param {number} windowMs - Window duration in milliseconds.
 * @returns {object|undefined}
 */
export function buildStore(windowMs) {
  if (config.NODE_ENV === 'development') return undefined;
  if (config.RATE_LIMIT_STORE !== 'redis') return undefined;

  const windowSeconds = Math.ceil(windowMs / 1000);

  return {
    async increment(key) {
      let redis;
      try {
        redis = await getRedisClient();
      } catch {
        return { totalHits: 0, resetTime: new Date(Date.now() + windowMs) };
      }
      const value = await redis.incr(key);
      if (value === 1) await redis.expire(key, windowSeconds);
      return { totalHits: value, resetTime: new Date(Date.now() + windowMs) };
    },
    async decrement(key) {
      try {
        const redis = await getRedisClient();
        await redis.decr(key);
      } catch {
        // ignore
      }
    },
    async resetKey(key) {
      try {
        const redis = await getRedisClient();
        await redis.del(key);
      } catch {
        // ignore
      }
    },
  };
}

/**
 * Key generator for authenticated rate limiters.
 * Uses the JWT subject (user UUID) when available, falls back to IP.
 * @param {import('express').Request} req
 * @returns {string}
 */
export function userOrIpKeyGenerator(req) {
  return req.user?.sub || ipKeyGenerator(req);
}
