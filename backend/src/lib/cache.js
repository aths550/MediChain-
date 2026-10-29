/**
 * backend/src/lib/cache.js
 * In-memory TTL cache for on-chain getBatch / getHistory results.
 *
 * - Default TTL: 45 seconds (configurable)
 * - Invalidation: call invalidate(batchId) when a transfer or recall
 *   is detected, so the next verify call fetches fresh chain data.
 *
 * This keeps verify latency well under 2s for repeat scans by avoiding
 * an RPC call on every request, while still converging to fresh state
 * within one TTL window after any on-chain event.
 */

const DEFAULT_TTL_MS = 45_000; // 45 seconds

// Map<batchId, { data: any, expiresAt: number }>
const cache = new Map();

/**
 * Get a cached value for batchId.
 * Returns undefined if not cached or expired.
 */
export function cacheGet(batchId) {
  const entry = cache.get(batchId);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(batchId);
    return undefined;
  }
  return entry.data;
}

/**
 * Store a value in the cache for batchId.
 * @param {string} batchId
 * @param {any} data
 * @param {number} [ttlMs] — milliseconds to keep; defaults to DEFAULT_TTL_MS
 */
export function cacheSet(batchId, data, ttlMs = DEFAULT_TTL_MS) {
  cache.set(batchId, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * Invalidate the cache for a specific batchId.
 * Call this when a BatchTransferred or BatchRecalled event is observed.
 */
export function invalidate(batchId) {
  cache.delete(batchId);
}

/** Invalidate all cached entries (useful on startup/reconnect). */
export function invalidateAll() {
  cache.clear();
}

/** How many entries are currently cached (for diagnostics). */
export function cacheSize() {
  return cache.size;
}
