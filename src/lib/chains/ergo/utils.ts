// Ergo utility functions

// 1 ERG = 10^9 nanoERG (9 decimals)
const ERG_DECIMALS = 9;
const ERG_DIVISOR = 10 ** ERG_DECIMALS;

/**
 * Convert nanoERG to ERG
 */
export function toErg(nanoErg: number | string): number {
  if (!nanoErg || nanoErg === 0 || nanoErg === "0") return 0;

  const value = typeof nanoErg === "string" ? parseInt(nanoErg, 10) : nanoErg;
  return value / ERG_DIVISOR;
}

/**
 * Convert ERG to nanoERG
 */
export function toNanoErg(erg: number): number {
  return Math.round(erg * ERG_DIVISOR);
}

/**
 * Validate an Ergo address
 * Ergo addresses are Base58-encoded with a prefix byte
 *
 * Mainnet:
 *   - P2PK (Pay to Public Key): starts with "9"
 *   - P2SH (Pay to Script Hash): starts with "8"
 *   - P2S (Pay to Script): starts with "4" or varies
 *
 * Testnet:
 *   - P2PK: starts with "3"
 */
export function isValidErgoAddress(address: string): boolean {
  if (!address || typeof address !== "string") {
    return false;
  }

  // Trim whitespace
  address = address.trim();

  // Check length (Ergo addresses are typically 51-52 characters)
  if (address.length < 40 || address.length > 60) {
    return false;
  }

  // Check for valid mainnet prefixes
  // P2PK: 9, P2SH: 8, P2S: varies but common ones start with 4, 5, etc.
  const validMainnetPrefixes = ["9", "8", "4", "5", "6", "7"];
  const firstChar = address.charAt(0);

  if (!validMainnetPrefixes.includes(firstChar)) {
    return false;
  }

  // Base58 character set (excludes 0, O, I, l)
  const base58Chars = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;

  return base58Chars.test(address);
}

/**
 * Check if address is a P2PK (standard wallet) address
 */
export function isP2PKAddress(address: string): boolean {
  return address.startsWith("9");
}

/**
 * Check if address is a P2SH (script hash) address
 */
export function isP2SHAddress(address: string): boolean {
  return address.startsWith("8");
}

/**
 * Normalize address (trim whitespace)
 */
export function normalizeAddress(address: string): string {
  return address.trim();
}

/**
 * Truncate address for display
 */
export function truncateAddress(address: string, chars = 8): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Format token amount with decimals
 */
export function formatTokenAmount(amount: number, decimals: number = 0): number {
  if (decimals === 0) return amount;
  return amount / 10 ** decimals;
}

/**
 * Parse timestamp from Ergo API (milliseconds to Date)
 */
export function parseTimestamp(timestamp: number): Date {
  return new Date(timestamp);
}
