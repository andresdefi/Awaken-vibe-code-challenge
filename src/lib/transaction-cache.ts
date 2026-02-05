/**
 * LocalStorage-backed transaction cache with TTL and LRU eviction
 */

import type { NormalizedTransaction, PerpsTransaction, TransactionSummary } from "./types";

const CACHE_KEY = "awaken_tx_cache";
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_ENTRIES = 50;

type Transaction = NormalizedTransaction | PerpsTransaction;

interface CacheEntry {
  transactions: Transaction[];
  summary: TransactionSummary | null;
  cachedAt: number; // timestamp for LRU
  ttl: number;
}

interface CacheStore {
  [key: string]: CacheEntry;
}

/**
 * Build a cache key from the request parameters
 * Format: {chainId}:{address}:{startDate}:{endDate}
 */
export function buildCacheKey(
  chainId: string,
  address: string,
  startDate?: string,
  endDate?: string
): string {
  const normalizedChain = chainId.toLowerCase().trim();
  const normalizedAddress = address.trim();
  const start = startDate?.trim() || "";
  const end = endDate?.trim() || "";
  return `${normalizedChain}:${normalizedAddress}:${start}:${end}`;
}

/**
 * Get the cache store from localStorage
 */
function getCacheStore(): CacheStore {
  if (typeof window === "undefined") return {};

  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as CacheStore;
  } catch {
    // Corrupted localStorage - clear and return empty
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      // Ignore
    }
    return {};
  }
}

/**
 * Save the cache store to localStorage
 */
function saveCacheStore(store: CacheStore): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch {
    // localStorage full or unavailable - ignore
  }
}

/**
 * Evict oldest entries to stay under MAX_ENTRIES (LRU)
 */
function evictOldEntries(store: CacheStore): CacheStore {
  const entries = Object.entries(store);
  if (entries.length <= MAX_ENTRIES) return store;

  // Sort by cachedAt ascending (oldest first)
  entries.sort((a, b) => a[1].cachedAt - b[1].cachedAt);

  // Remove oldest entries
  const toRemove = entries.length - MAX_ENTRIES;
  const keysToRemove = entries.slice(0, toRemove).map(([key]) => key);

  const newStore = { ...store };
  for (const key of keysToRemove) {
    delete newStore[key];
  }

  return newStore;
}

/**
 * Deserialize dates from ISO strings back to Date objects
 */
function deserializeTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.map((tx) => {
    const result = { ...tx };

    if ("timestamp" in result && result.timestamp) {
      result.timestamp = new Date(result.timestamp);
    }
    if ("date" in result && result.date) {
      result.date = new Date(result.date);
    }

    return result;
  });
}

interface CacheResult {
  transactions: Transaction[];
  summary: TransactionSummary | null;
}

/**
 * Get cached transactions for a given key
 * Returns null if not found or expired
 */
export function getCachedTransactions(key: string): CacheResult | null {
  if (typeof window === "undefined") return null;

  const store = getCacheStore();
  const entry = store[key];

  if (!entry) return null;

  // Check if expired
  const now = Date.now();
  if (now - entry.cachedAt > entry.ttl) {
    // Expired - remove and return null
    delete store[key];
    saveCacheStore(store);
    return null;
  }

  // Update cachedAt for LRU (access refreshes timestamp)
  store[key] = { ...entry, cachedAt: now };
  saveCacheStore(store);

  return {
    transactions: deserializeTransactions(entry.transactions),
    summary: entry.summary,
  };
}

/**
 * Cache transactions for a given key
 */
export function setCachedTransactions(
  key: string,
  transactions: Transaction[],
  summary: TransactionSummary | null,
  ttlMs: number = DEFAULT_TTL_MS
): void {
  if (typeof window === "undefined") return;

  let store = getCacheStore();

  store[key] = {
    transactions,
    summary,
    cachedAt: Date.now(),
    ttl: ttlMs,
  };

  // Evict if over limit
  store = evictOldEntries(store);

  saveCacheStore(store);
}

/**
 * Invalidate a specific cache entry
 */
export function invalidateCache(key: string): void {
  if (typeof window === "undefined") return;

  const store = getCacheStore();
  if (store[key]) {
    delete store[key];
    saveCacheStore(store);
  }
}

/**
 * Clear all cached transactions
 */
export function clearCache(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Ignore
  }
}
