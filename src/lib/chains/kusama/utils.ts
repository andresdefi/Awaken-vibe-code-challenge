// Kusama-specific utilities

/**
 * Validates a Kusama SS58 address
 * Kusama addresses have SS58 prefix 2 and start with capital letters C, D, E, F, G, H, or J
 * Length is 47-48 characters
 */
export function isValidKusamaAddress(address: string): boolean {
  if (!address || typeof address !== "string") return false;

  // Kusama mainnet addresses start with C, D, E, F, G, H, or J (uppercase)
  // These are the valid starting characters for SS58 prefix 2
  if (!/^[CDEFGHJ]/.test(address)) return false;

  // Length should be 47-48 characters
  if (address.length < 47 || address.length > 48) return false;

  // Base58 character set (no 0, O, I, l)
  const base58Regex = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
  return base58Regex.test(address);
}

/**
 * Convert Planck (smallest unit) to KSM
 * 1 KSM = 10^12 Planck (note: different from DOT which is 10^10)
 */
export function planckToKsm(planck: string | number): number {
  const planckBigInt = typeof planck === "string" ? BigInt(planck) : BigInt(planck);
  return Number(planckBigInt) / 1e12;
}

/**
 * Format KSM amount for display
 */
export function formatKsmAmount(ksm: number): string {
  return ksm.toFixed(12).replace(/\.?0+$/, "");
}

/**
 * Get the Subscan explorer URL for a Kusama address
 */
export function getKusamaExplorerUrl(address: string): string {
  return `https://kusama.subscan.io/account/${address}`;
}

/**
 * Get the Subscan explorer URL for a Kusama transaction
 */
export function getKusamaTxUrl(hash: string): string {
  return `https://kusama.subscan.io/extrinsic/${hash}`;
}

/**
 * Kusama unbonding period in days (7 days vs Polkadot's 28 days)
 */
export const KUSAMA_UNBONDING_DAYS = 7;

/**
 * Kusama decimals (12 vs Polkadot's 10)
 */
export const KUSAMA_DECIMALS = 12;
