import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  buildCacheKey,
  getCachedTransactions,
  setCachedTransactions,
  invalidateCache,
  clearCache,
} from "../transaction-cache";
import type { NormalizedTransaction, TransactionSummary } from "../types";

const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

describe("transaction-cache", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.stubGlobal("localStorage", mockLocalStorage);
  });

  describe("buildCacheKey", () => {
    it("builds key from chain and address", () => {
      const key = buildCacheKey("Bittensor", "5ABC123");
      expect(key).toBe("bittensor:5ABC123::");
    });

    it("includes date range in key", () => {
      const key = buildCacheKey("polkadot", "1xyz", "2024-01-01", "2024-12-31");
      expect(key).toBe("polkadot:1xyz:2024-01-01:2024-12-31");
    });

    it("normalizes chain to lowercase", () => {
      const key = buildCacheKey("POLKADOT", "addr");
      expect(key).toBe("polkadot:addr::");
    });

    it("trims whitespace", () => {
      const key = buildCacheKey("  polkadot  ", "  addr  ", "  2024-01-01  ", "");
      expect(key).toBe("polkadot:addr:2024-01-01:");
    });
  });

  describe("setCachedTransactions / getCachedTransactions", () => {
    it("stores and retrieves transactions", () => {
      const transactions: NormalizedTransaction[] = [
        {
          id: "1",
          type: "transfer_sent",
          timestamp: new Date("2024-01-15T10:00:00Z"),
          sentAmount: 100,
          sentCurrency: "DOT",
          receivedAmount: null,
          receivedCurrency: null,
          feeAmount: 0.1,
          feeCurrency: "DOT",
          transactionHash: "0xabc",
          notes: "",
          tag: "payment",
        },
      ];
      const summary: TransactionSummary = { totalTransactions: 1 };

      setCachedTransactions("test:key", transactions, summary);
      const result = getCachedTransactions("test:key");

      expect(result).not.toBeNull();
      expect(result!.transactions).toHaveLength(1);
      expect(result!.transactions[0].id).toBe("1");
      expect(result!.summary?.totalTransactions).toBe(1);
    });

    it("deserializes dates correctly", () => {
      const date = new Date("2024-06-15T12:30:00Z");
      const transactions: NormalizedTransaction[] = [
        {
          id: "1",
          type: "transfer_sent",
          timestamp: date,
          sentAmount: 100,
          sentCurrency: "DOT",
          receivedAmount: null,
          receivedCurrency: null,
          feeAmount: 0.1,
          feeCurrency: "DOT",
          transactionHash: "0xabc",
          notes: "",
          tag: "payment",
        },
      ];

      setCachedTransactions("test:key", transactions, null);
      const result = getCachedTransactions("test:key");

      const tx = result!.transactions[0] as NormalizedTransaction;
      expect(tx.timestamp).toBeInstanceOf(Date);
      expect((tx.timestamp as Date).toISOString()).toBe(
        "2024-06-15T12:30:00.000Z"
      );
    });

    it("returns null for non-existent key", () => {
      const result = getCachedTransactions("nonexistent:key");
      expect(result).toBeNull();
    });

    it("returns null for expired entry", async () => {
      const transactions: NormalizedTransaction[] = [
        {
          id: "1",
          type: "transfer_sent",
          timestamp: new Date(),
          sentAmount: 100,
          sentCurrency: "DOT",
          receivedAmount: null,
          receivedCurrency: null,
          feeAmount: 0.1,
          feeCurrency: "DOT",
          transactionHash: "0xabc",
          notes: "",
          tag: "payment",
        },
      ];

      // Set with 1ms TTL
      setCachedTransactions("test:key", transactions, null, 1);

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = getCachedTransactions("test:key");
      expect(result).toBeNull();
    });
  });

  describe("LRU eviction", () => {
    it("evicts oldest entries when over limit", () => {
      // Create 51 entries to trigger eviction (max is 50)
      for (let i = 0; i < 51; i++) {
        const transactions: NormalizedTransaction[] = [
          {
            id: String(i),
            type: "transfer_sent",
            timestamp: new Date(),
            sentAmount: i,
            sentCurrency: "DOT",
            receivedAmount: null,
            receivedCurrency: null,
            feeAmount: 0.1,
            feeCurrency: "DOT",
            transactionHash: `0x${i}`,
            notes: "",
            tag: "payment",
          },
        ];
        setCachedTransactions(`key:${i}`, transactions, null);
      }

      // First entry should be evicted
      expect(getCachedTransactions("key:0")).toBeNull();
      // Last entry should still exist
      expect(getCachedTransactions("key:50")).not.toBeNull();
    });
  });

  describe("invalidateCache", () => {
    it("removes a specific cache entry", () => {
      const transactions: NormalizedTransaction[] = [
        {
          id: "1",
          type: "transfer_sent",
          timestamp: new Date(),
          sentAmount: 100,
          sentCurrency: "DOT",
          receivedAmount: null,
          receivedCurrency: null,
          feeAmount: 0.1,
          feeCurrency: "DOT",
          transactionHash: "0xabc",
          notes: "",
          tag: "payment",
        },
      ];

      setCachedTransactions("test:key1", transactions, null);
      setCachedTransactions("test:key2", transactions, null);

      invalidateCache("test:key1");

      expect(getCachedTransactions("test:key1")).toBeNull();
      expect(getCachedTransactions("test:key2")).not.toBeNull();
    });
  });

  describe("clearCache", () => {
    it("removes all cached entries", () => {
      const transactions: NormalizedTransaction[] = [
        {
          id: "1",
          type: "transfer_sent",
          timestamp: new Date(),
          sentAmount: 100,
          sentCurrency: "DOT",
          receivedAmount: null,
          receivedCurrency: null,
          feeAmount: 0.1,
          feeCurrency: "DOT",
          transactionHash: "0xabc",
          notes: "",
          tag: "payment",
        },
      ];

      setCachedTransactions("test:key1", transactions, null);
      setCachedTransactions("test:key2", transactions, null);

      clearCache();

      expect(getCachedTransactions("test:key1")).toBeNull();
      expect(getCachedTransactions("test:key2")).toBeNull();
    });
  });

  describe("corrupted localStorage", () => {
    it("handles corrupted JSON gracefully", () => {
      localStorage.setItem("awaken_tx_cache", "not valid json {{{");

      const result = getCachedTransactions("test:key");
      expect(result).toBeNull();
    });
  });
});
