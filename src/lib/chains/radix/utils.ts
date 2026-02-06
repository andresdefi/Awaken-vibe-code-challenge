// Radix utility functions

// 1 XRD = 10^18 smallest units (18 decimals)
const XRD_DECIMALS = 18;
const XRD_DIVISOR = BigInt(10 ** XRD_DECIMALS);

/**
 * Convert smallest units (atto) to XRD
 * Uses BigInt for precision with large numbers
 */
export function toXrd(value: string | number): number {
  if (!value || value === "0") return 0;

  try {
    // Handle negative values (for balance changes)
    const isNegative = String(value).startsWith("-");
    const absValue = isNegative ? String(value).slice(1) : String(value);

    const bigValue = BigInt(absValue);
    const wholePart = bigValue / XRD_DIVISOR;
    const fractionalPart = bigValue % XRD_DIVISOR;

    const result = Number(wholePart) + Number(fractionalPart) / Number(XRD_DIVISOR);
    return isNegative ? -result : result;
  } catch {
    // Fallback for decimal strings or smaller numbers
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (String(value).includes(".")) {
      // Already in decimal format
      return num;
    }
    return num / 10 ** XRD_DECIMALS;
  }
}

/**
 * Validate a Radix Babylon account address
 * Format: account_rdx1 prefix + Bech32m encoded data
 * Total length is typically 65-66 characters
 */
export function isValidRadixAddress(address: string): boolean {
  if (!address || typeof address !== "string") {
    return false;
  }

  // Must start with account_rdx1 for mainnet accounts
  if (!address.startsWith("account_rdx1")) {
    return false;
  }

  // Typical length is 65-66 characters
  if (address.length < 60 || address.length > 70) {
    return false;
  }

  // Bech32m character set after the prefix
  // Bech32m uses lowercase alphanumeric except 1, b, i, o
  const payload = address.slice(12); // Remove 'account_rdx1' prefix
  const bech32mChars = /^[023456789ac-hj-np-z]+$/;

  return bech32mChars.test(payload);
}

/**
 * Validate any Radix entity address (account, resource, validator, etc.)
 * Each entity type has a different prefix
 */
export function isValidRadixEntityAddress(address: string): boolean {
  if (!address || typeof address !== "string") {
    return false;
  }

  // Valid entity prefixes for mainnet
  const validPrefixes = [
    "account_rdx1",
    "resource_rdx1",
    "component_rdx1",
    "package_rdx1",
    "validator_rdx1",
    "pool_rdx1",
    "consensusmanager_rdx1",
    "accesscontroller_rdx1",
  ];

  const hasValidPrefix = validPrefixes.some((prefix) => address.startsWith(prefix));
  if (!hasValidPrefix) {
    return false;
  }

  // Check length (varies by entity type, but should be > 50)
  if (address.length < 50) {
    return false;
  }

  return true;
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
 * Get entity type from address prefix
 */
export function getEntityType(address: string): string | null {
  if (address.startsWith("account_")) return "account";
  if (address.startsWith("resource_")) return "resource";
  if (address.startsWith("component_")) return "component";
  if (address.startsWith("package_")) return "package";
  if (address.startsWith("validator_")) return "validator";
  if (address.startsWith("pool_")) return "pool";
  return null;
}

/**
 * Extract token symbol from resource metadata or address
 * Falls back to shortened address if no symbol found
 */
export function extractTokenSymbol(
  resourceAddress: string,
  metadata?: Array<{ key: string; value: { typed?: { value?: string } } }>
): string {
  // Check metadata for symbol
  if (metadata) {
    const symbolItem = metadata.find((m) => m.key === "symbol");
    if (symbolItem?.value?.typed?.value) {
      return symbolItem.value.typed.value;
    }
  }

  // For XRD, return "XRD"
  if (resourceAddress.includes("radxrd")) {
    return "XRD";
  }

  // Fallback to shortened address
  return resourceAddress.slice(0, 12) + "...";
}

/**
 * Parse timestamp from Radix API format
 */
export function parseTimestamp(timestamp: string): Date {
  return new Date(timestamp);
}
