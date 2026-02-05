/**
 * Track CSV exports in localStorage to detect duplicates
 */

const STORAGE_KEY = "awaken_exports";

export interface ExportRecord {
  chainId: string;
  address: string;
  startDate: string;
  endDate: string;
  exportedAt: string; // ISO timestamp
}

/**
 * Get all export history from localStorage
 */
export function getExportHistory(): ExportRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ExportRecord[];
  } catch {
    // Corrupted localStorage - return empty
    return [];
  }
}

/**
 * Add a new export record to history
 */
export function addExportRecord(
  chainId: string,
  address: string,
  startDate: string,
  endDate: string
): void {
  if (typeof window === "undefined") return;

  const history = getExportHistory();

  const record: ExportRecord = {
    chainId: chainId.toLowerCase(),
    address: address.trim(),
    startDate: startDate || "",
    endDate: endDate || "",
    exportedAt: new Date().toISOString(),
  };

  history.push(record);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // localStorage full or unavailable - ignore
  }
}

/**
 * Check if an export with the same parameters already exists
 * Returns the matching record if found, null otherwise
 */
export function isDuplicateExport(
  chainId: string,
  address: string,
  startDate: string,
  endDate: string
): ExportRecord | null {
  const history = getExportHistory();

  const normalizedChain = chainId.toLowerCase();
  const normalizedAddress = address.trim();
  const normalizedStart = startDate || "";
  const normalizedEnd = endDate || "";

  const match = history.find(
    (record) =>
      record.chainId === normalizedChain &&
      record.address === normalizedAddress &&
      record.startDate === normalizedStart &&
      record.endDate === normalizedEnd
  );

  return match || null;
}

/**
 * Clear all export history
 */
export function clearExportHistory(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}
