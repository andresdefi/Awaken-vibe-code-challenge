// Polkadot-specific utilities

/**
 * Validates a Polkadot SS58 address
 * Polkadot addresses start with "1" (SS58 prefix 0) and are 47-48 characters
 */
export function isValidPolkadotAddress(address: string): boolean {
  if (!address || typeof address !== "string") return false;

  // Polkadot mainnet addresses start with "1"
  if (!address.startsWith("1")) return false;

  // Length should be 47-48 characters
  if (address.length < 47 || address.length > 48) return false;

  // Base58 character set (no 0, O, I, l)
  const base58Regex = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
  return base58Regex.test(address);
}

/**
 * Convert Planck (smallest unit) to DOT
 * 1 DOT = 10^10 Planck
 */
export function planckToDot(planck: string | number): number {
  const planckBigInt = typeof planck === "string" ? BigInt(planck) : BigInt(planck);
  return Number(planckBigInt) / 1e10;
}

/**
 * Format DOT amount for display
 */
export function formatDotAmount(dot: number): string {
  return dot.toFixed(10).replace(/\.?0+$/, "");
}
