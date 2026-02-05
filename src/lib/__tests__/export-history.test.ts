import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getExportHistory,
  addExportRecord,
  isDuplicateExport,
  clearExportHistory,
} from "../export-history";

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

describe("export-history", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.stubGlobal("localStorage", mockLocalStorage);
  });

  describe("getExportHistory", () => {
    it("returns empty array when no history exists", () => {
      const history = getExportHistory();
      expect(history).toEqual([]);
    });

    it("returns existing history", () => {
      const existing = [
        {
          chainId: "polkadot",
          address: "1xyz",
          startDate: "2024-01-01",
          endDate: "2024-12-31",
          exportedAt: "2024-06-15T10:00:00.000Z",
        },
      ];
      localStorage.setItem("awaken_exports", JSON.stringify(existing));

      const history = getExportHistory();
      expect(history).toHaveLength(1);
      expect(history[0].chainId).toBe("polkadot");
    });

    it("handles corrupted localStorage gracefully", () => {
      localStorage.setItem("awaken_exports", "not valid json {{{");

      const history = getExportHistory();
      expect(history).toEqual([]);
    });

    it("handles non-array data gracefully", () => {
      localStorage.setItem("awaken_exports", JSON.stringify({ invalid: "data" }));

      const history = getExportHistory();
      expect(history).toEqual([]);
    });
  });

  describe("addExportRecord", () => {
    it("adds a new export record", () => {
      addExportRecord("polkadot", "1xyz", "2024-01-01", "2024-12-31");

      const history = getExportHistory();
      expect(history).toHaveLength(1);
      expect(history[0].chainId).toBe("polkadot");
      expect(history[0].address).toBe("1xyz");
      expect(history[0].startDate).toBe("2024-01-01");
      expect(history[0].endDate).toBe("2024-12-31");
      expect(history[0].exportedAt).toBeTruthy();
    });

    it("normalizes chain to lowercase", () => {
      addExportRecord("POLKADOT", "1xyz", "", "");

      const history = getExportHistory();
      expect(history[0].chainId).toBe("polkadot");
    });

    it("trims address whitespace", () => {
      addExportRecord("polkadot", "  1xyz  ", "", "");

      const history = getExportHistory();
      expect(history[0].address).toBe("1xyz");
    });

    it("handles empty date strings", () => {
      addExportRecord("polkadot", "1xyz", "", "");

      const history = getExportHistory();
      expect(history[0].startDate).toBe("");
      expect(history[0].endDate).toBe("");
    });
  });

  describe("isDuplicateExport", () => {
    it("returns null when no duplicate exists", () => {
      const result = isDuplicateExport("polkadot", "1xyz", "2024-01-01", "2024-12-31");
      expect(result).toBeNull();
    });

    it("returns matching record when duplicate exists", () => {
      addExportRecord("polkadot", "1xyz", "2024-01-01", "2024-12-31");

      const result = isDuplicateExport("polkadot", "1xyz", "2024-01-01", "2024-12-31");

      expect(result).not.toBeNull();
      expect(result!.chainId).toBe("polkadot");
      expect(result!.address).toBe("1xyz");
    });

    it("matches case-insensitive chain ID", () => {
      addExportRecord("polkadot", "1xyz", "", "");

      const result = isDuplicateExport("POLKADOT", "1xyz", "", "");
      expect(result).not.toBeNull();
    });

    it("returns null for partial match (different address)", () => {
      addExportRecord("polkadot", "1xyz", "2024-01-01", "2024-12-31");

      const result = isDuplicateExport("polkadot", "different", "2024-01-01", "2024-12-31");
      expect(result).toBeNull();
    });

    it("returns null for partial match (different dates)", () => {
      addExportRecord("polkadot", "1xyz", "2024-01-01", "2024-12-31");

      const result = isDuplicateExport("polkadot", "1xyz", "2024-06-01", "2024-12-31");
      expect(result).toBeNull();
    });
  });

  describe("clearExportHistory", () => {
    it("removes all export history", () => {
      addExportRecord("polkadot", "1xyz", "", "");
      addExportRecord("bittensor", "5abc", "", "");

      clearExportHistory();

      const history = getExportHistory();
      expect(history).toEqual([]);
    });
  });
});
