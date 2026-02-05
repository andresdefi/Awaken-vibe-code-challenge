// MultiversX utility functions

// 1 EGLD = 10^18 smallest units (18 decimals)
const EGLD_DECIMALS = 18;
const EGLD_DIVISOR = BigInt(10 ** EGLD_DECIMALS);

/**
 * Convert smallest units to EGLD
 * Uses BigInt for precision with large numbers
 */
export function toEgld(value: string | number): number {
  if (!value || value === "0") return 0;

  try {
    const bigValue = BigInt(value);
    // Convert to number with proper decimal places
    const wholePart = bigValue / EGLD_DIVISOR;
    const fractionalPart = bigValue % EGLD_DIVISOR;

    // Combine whole and fractional parts
    const result = Number(wholePart) + Number(fractionalPart) / Number(EGLD_DIVISOR);
    return result;
  } catch {
    // Fallback for smaller numbers
    const num = typeof value === "string" ? parseFloat(value) : value;
    return num / 10 ** EGLD_DECIMALS;
  }
}

/**
 * Validate a MultiversX address
 * Format: erd1 prefix + 58 characters of bech32 data = 62 characters total
 */
export function isValidMultiversXAddress(address: string): boolean {
  if (!address || typeof address !== "string") {
    return false;
  }

  // Must start with erd1
  if (!address.startsWith("erd1")) {
    return false;
  }

  // Must be exactly 62 characters
  if (address.length !== 62) {
    return false;
  }

  // Bech32 character set (lowercase alphanumeric, excluding 1, b, i, o)
  // Note: erd1 prefix uses '1' which is allowed in the prefix
  const payload = address.slice(4); // Remove 'erd1' prefix
  const bech32Chars = /^[023456789ac-hj-np-z]+$/;

  return bech32Chars.test(payload);
}

/**
 * Normalize address to lowercase
 */
export function normalizeAddress(address: string): string {
  return address.toLowerCase().trim();
}

/**
 * Truncate address for display
 */
export function truncateAddress(address: string, chars = 8): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Decode base64 transaction data
 */
export function decodeTransactionData(data: string | undefined): string {
  if (!data) return "";
  try {
    return atob(data);
  } catch {
    return data;
  }
}

/**
 * Parse function name from transaction data
 */
export function parseFunctionFromData(data: string | undefined): string | null {
  const decoded = decodeTransactionData(data);
  if (!decoded) return null;

  // Data format: functionName@arg1@arg2...
  const parts = decoded.split("@");
  return parts[0] || null;
}
