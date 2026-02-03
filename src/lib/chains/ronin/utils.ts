// Ronin-specific utilities

/**
 * Validates a Ronin address
 * Supports both formats:
 * - Standard EVM: 0x + 40 hex characters
 * - Legacy Ronin: ronin: + 40 hex characters
 */
export function isValidRoninAddress(address: string): boolean {
  if (!address || typeof address !== "string") return false;

  // Normalize the address
  const normalized = normalizeRoninAddress(address);

  // Check standard EVM format
  return /^0x[a-fA-F0-9]{40}$/.test(normalized);
}

/**
 * Normalize Ronin address to standard EVM format
 * Converts ronin:xxxx to 0xxxxx format
 */
export function normalizeRoninAddress(address: string): string {
  if (!address) return "";

  // Remove any whitespace
  const trimmed = address.trim();

  // Convert ronin: prefix to 0x
  if (trimmed.toLowerCase().startsWith("ronin:")) {
    return "0x" + trimmed.slice(6);
  }

  return trimmed;
}

/**
 * Format address for display (with ronin: prefix for Ronin ecosystem)
 */
export function formatRoninAddress(address: string): string {
  const normalized = normalizeRoninAddress(address);
  if (normalized.startsWith("0x")) {
    return "ronin:" + normalized.slice(2);
  }
  return address;
}

/**
 * Convert Wei to RON (18 decimals)
 * 1 RON = 10^18 Wei
 */
export function weiToRon(wei: string | number | bigint): number {
  try {
    const weiBigInt = typeof wei === "bigint" ? wei : BigInt(wei);
    // Convert to number with 18 decimal precision
    return Number(weiBigInt) / 1e18;
  } catch {
    return 0;
  }
}

/**
 * Convert token amount based on decimals
 */
export function convertTokenAmount(amount: string | number, decimals: number): number {
  try {
    const amountBigInt = BigInt(amount);
    return Number(amountBigInt) / Math.pow(10, decimals);
  } catch {
    return 0;
  }
}

/**
 * Format RON amount for display
 */
export function formatRonAmount(ron: number): string {
  if (ron === 0) return "0";
  if (ron < 0.00000001) return ron.toExponential(4);
  return ron.toFixed(8).replace(/\.?0+$/, "");
}

/**
 * Shorten address for display
 */
export function shortenAddress(address: string, chars = 6): string {
  const normalized = normalizeRoninAddress(address);
  if (normalized.length <= chars * 2 + 2) return normalized;
  return `${normalized.slice(0, chars + 2)}...${normalized.slice(-chars)}`;
}

/**
 * Get block explorer URL for transaction
 */
export function getExplorerTxUrl(hash: string): string {
  return `https://app.roninchain.com/tx/${hash}`;
}

/**
 * Get block explorer URL for address
 */
export function getExplorerAddressUrl(address: string): string {
  const normalized = normalizeRoninAddress(address);
  return `https://app.roninchain.com/address/${normalized}`;
}

/**
 * Check if an address is the staking contract
 */
export function isStakingContract(address: string): boolean {
  const normalized = normalizeRoninAddress(address).toLowerCase();
  return normalized === "0x9c245671791834daf3885533d24dce516b763b28";
}

/**
 * Check if address is a known DEX router
 */
export function isKatanaRouter(address: string): boolean {
  const normalized = normalizeRoninAddress(address).toLowerCase();
  const knownRouters = [
    "0x7d0556d55ca1a92708681e2e231733ebd922597d", // Katana V2
  ];
  return knownRouters.includes(normalized);
}
