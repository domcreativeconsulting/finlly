export const CACHE_PREFIX = 'finlly_offline_';
// Increment CACHE_VERSION on deploys that break the cache schema.
// To invalidate all user data caches after a breaking deploy, increment `CACHE_VERSION`.
export const CACHE_VERSION = 'v1';

// Clears caches from older versions (called at app boot)
export function cleanupLegacyCaches() {
  const currentVersionKey = `${CACHE_PREFIX}schema_version`;
  const storedVersion = localStorage.getItem(currentVersionKey);
  if (storedVersion !== CACHE_VERSION) {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(CACHE_PREFIX) && k !== currentVersionKey)
      .forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(currentVersionKey, CACHE_VERSION);
  }
}

// Clears the offline cache for a specific user (called on logout)
export function clearUserOfflineCache(userId) {
  if (!userId) return;
  Object.keys(localStorage)
    .filter((k) => k.startsWith(`${CACHE_PREFIX}${userId}_`))
    .forEach((k) => localStorage.removeItem(k));
}
