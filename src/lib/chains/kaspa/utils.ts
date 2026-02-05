// Kaspa utility functions

// 1 KAS = 100,000,000 sompi (8 decimals)
const SOMPI_PER_KAS = 100_000_000;

/**
 * Convert sompi (smallest unit) to KAS
 */
export function sompiToKas(sompi: number | string): number {
  const value = typeof sompi === "string" ? parseFloat(sompi) : sompi;
  return value / SOMPI_PER_KAS;
}

/**
 * Validate a Kaspa address
 * Kaspa addresses use bech32 encoding with prefixes:
 * - kaspa: (mainnet)
 * - kaspatest: (testnet)
 * - kaspasim: (simnet)
 * - kaspadev: (devnet)
 */
export function isValidKaspaAddress(address: string): boolean {
  if (!address || typeof address !== "string") {
    return false;
  }

  // Must start with kaspa: prefix (mainnet)
  // Also accept kaspatest:, kaspasim:, kaspadev: for other networks
  const validPrefixes = ["kaspa:", "kaspatest:", "kaspasim:", "kaspadev:"];
  const hasValidPrefix = validPrefixes.some((prefix) =>
    address.toLowerCase().startsWith(prefix)
  );

  if (!hasValidPrefix) {
    return false;
  }

  // After the prefix, there should be a bech32-encoded payload
  // Typical kaspa address is ~61-63 characters total
  // Minimum length check (prefix + some payload)
  if (address.length < 40) {
    return false;
  }

  // Maximum reasonable length
  if (address.length > 100) {
    return false;
  }

  // The payload part (after prefix) should only contain valid bech32 characters
  // Bech32 uses: 0-9, a-z (lowercase), but excludes: 1, b, i, o
  const prefixEnd = address.indexOf(":") + 1;
  const payload = address.slice(prefixEnd).toLowerCase();

  // Bech32 character set (excludes 1, b, i, o)
  const bech32Chars = /^[023456789ac-hj-np-z]+$/;

  return bech32Chars.test(payload);
}

/**
 * Normalize a Kaspa address to lowercase
 */
export function normalizeAddress(address: string): string {
  return address.toLowerCase().trim();
}
