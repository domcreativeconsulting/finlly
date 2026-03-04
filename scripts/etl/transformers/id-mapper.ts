import { v5 as uuidv5 } from 'uuid';

/**
 * DNS namespace UUID used as the base namespace for all MySQL INT → Postgres UUID mappings.
 * Using a fixed, well-known namespace guarantees idempotent (deterministic) UUID generation:
 * running the ETL twice for the same MySQL ID will always produce the same UUID.
 */
const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/** In-memory cache for already-mapped IDs to avoid repeated hashing */
const cache = new Map<string, string>();

/**
 * Maps a MySQL integer ID to a deterministic UUID v5.
 * Format of the input key: "<tableName>:<mysqlId>"
 */
export function mapId(mysqlId: number, tableName: string): string {
  const key = `${tableName}:${mysqlId}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const uuid = uuidv5(key, NAMESPACE);
  cache.set(key, uuid);
  return uuid;
}

/**
 * Maps an optional MySQL ID, returning undefined when the source value is null/undefined/0.
 */
export function mapIdOptional(
  mysqlId: number | null | undefined,
  tableName: string,
): string | undefined {
  if (mysqlId == null || mysqlId === 0) return undefined;
  return mapId(mysqlId, tableName);
}

/** Returns the number of IDs currently cached (useful for reporting) */
export function getMappedCount(): number {
  return cache.size;
}

/** Clears the cache — call between runs if needed */
export function clearCache(): void {
  cache.clear();
}
