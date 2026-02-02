// Bittensor-specific utilities

export function raoToTao(rao: string | number): number {
  const raoNum = typeof rao === "string" ? BigInt(rao) : BigInt(rao);
  return Number(raoNum) / 1e9;
}

export function formatTaoAmount(tao: number): string {
  return tao.toFixed(8).replace(/\.?0+$/, "");
}

export function isValidSS58Address(address: string): boolean {
  if (!address || typeof address !== "string") return false;
  if (!address.startsWith("5")) return false;
  if (address.length < 46 || address.length > 48) return false;
  const base58Regex = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
  return base58Regex.test(address);
}
