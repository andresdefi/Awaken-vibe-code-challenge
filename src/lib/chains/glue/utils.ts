// Glue Network utility functions

// GLUE uses 18 decimals (standard EVM)
const GLUE_DECIMALS = 18;
const GLUE_DIVISOR = 10 ** GLUE_DECIMALS;

/**
 * Convert wei to GLUE
 */
export function toGlue(wei: string | number): number {
  if (!wei || wei === "0") return 0;

  const value = typeof wei === "string" ? BigInt(wei) : BigInt(Math.floor(wei));
  // Use BigInt division for precision, then convert to number
  const glue = Number(value) / GLUE_DIVISOR;
  return glue;
}

/**
 * Convert GLUE to wei
 */
export function toWei(glue: number): string {
  return BigInt(Math.round(glue * GLUE_DIVISOR)).toString();
}

/**
 * Validate a Glue Network address (EVM-compatible)
 */
export function isValidGlueAddress(address: string): boolean {
  if (!address || typeof address !== "string") {
    return false;
  }

  // Trim whitespace
  address = address.trim();

  // Must start with 0x
  if (!address.startsWith("0x") && !address.startsWith("0X")) {
    return false;
  }

  // Must be 42 characters (0x + 40 hex chars)
  if (address.length !== 42) {
    return false;
  }

  // Must be valid hex after 0x
  const hexPart = address.slice(2);
  const hexRegex = /^[0-9a-fA-F]+$/;

  return hexRegex.test(hexPart);
}

/**
 * Normalize address to lowercase with 0x prefix
 */
export function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

/**
 * Truncate address for display
 */
export function truncateAddress(address: string, chars = 6): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Parse timestamp from Glue API (seconds to Date)
 */
export function parseTimestamp(timestamp: string | number): Date {
  const ts = typeof timestamp === "string" ? parseInt(timestamp, 10) : timestamp;
  return new Date(ts * 1000);
}

/**
 * Calculate gas cost in GLUE
 */
export function calculateGasCost(gasUsed: string, gasPrice: string): number {
  const used = BigInt(gasUsed);
  const price = BigInt(gasPrice);
  const costWei = used * price;
  return toGlue(costWei.toString());
}
