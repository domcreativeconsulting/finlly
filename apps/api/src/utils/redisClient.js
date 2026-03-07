import { createClient } from 'redis';
import { config } from '../config/env.js';
import logger from '../logger.js';

let client = null;
let connectPromise = null;

function onError(err) {
  logger.error({ msg: 'Redis client error', err: err.message });
}

/**
 * Returns a connected Redis client (singleton).
 * @returns {Promise<import('redis').RedisClientType>}
 */
export async function getRedisClient() {
  if (client && client.isReady) return client;

  if (connectPromise) return connectPromise;

  client = createClient({ url: config.REDIS_URL });
  client.on('error', onError);

  connectPromise = client.connect().then(() => {
    connectPromise = null;
    return client;
  });

  return connectPromise;
}

/**
 * Disconnects the Redis client (for graceful shutdown / tests).
 */
export async function disconnectRedisClient() {
  if (client) {
    client.off('error', onError);
    try {
      await client.disconnect();
    } catch {
      // ignore
    }
    client = null;
    connectPromise = null;
  }
}
