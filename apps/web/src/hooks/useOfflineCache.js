import { useCallback } from 'react';
import { CACHE_PREFIX } from '../utils/offlineCacheManager.js';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

export function useOfflineCache(userId) {
  const key = (name) => `${CACHE_PREFIX}${userId}_${name}`;

  const saveCache = useCallback(
    (name, data) => {
      if (!userId) return;
      try {
        localStorage.setItem(
          key(name),
          JSON.stringify({ data, savedAt: Date.now() }),
        );
      } catch {
        // quota exceeded — ignore
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId],
  );

  const readCache = useCallback(
    (name) => {
      if (!userId) return null;
      try {
        const raw = localStorage.getItem(key(name));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (Date.now() - parsed.savedAt > CACHE_TTL_MS) {
          localStorage.removeItem(key(name));
          return null;
        }
        return { data: parsed.data, savedAt: new Date(parsed.savedAt) };
      } catch {
        return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId],
  );

  const clearUserCache = useCallback(() => {
    if (!userId) return;
    Object.keys(localStorage)
      .filter((k) => k.startsWith(`${CACHE_PREFIX}${userId}_`))
      .forEach((k) => localStorage.removeItem(k));
  }, [userId]);

  return { saveCache, readCache, clearUserCache };
}
