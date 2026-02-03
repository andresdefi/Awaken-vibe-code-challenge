// Injective-specific utilities

/**
 * Validates an Injective address (Bech32 with "inj" prefix)
 * Format: inj1 + 38 lowercase alphanumeric characters
 */
export function isValidInjectiveAddress(address: string): boolean {
  if (!address || typeof address !== "string") return false;

  // Must start with "inj1"
  if (!address.startsWith("inj1")) return false;

  // Total length: 43 characters (inj1 + 38)
  if (address.length !== 43) return false;

  // Bech32 character set for data part (after prefix)
  // Excludes: 1, b, i, o (to avoid confusion)
  const bech32DataRegex = /^inj1[023456789acdefghjklmnpqrstuvwxyz]{38}$/;
  return bech32DataRegex.test(address);
}

/**
 * Convert wei (10^18) to INJ
 * INJ uses 18 decimals like Ethereum
 */
export function weiToInj(wei: string | number | bigint): number {
  const weiBigInt = typeof wei === "string" ? BigInt(wei) : BigInt(wei);
  // Use string manipulation for precision with large numbers
  const weiStr = weiBigInt.toString();

  if (weiStr.length <= 18) {
    // Less than 1 INJ
    return Number(weiBigInt) / 1e18;
  }

  // Split into integer and decimal parts
  const integerPart = weiStr.slice(0, -18) || "0";
  const decimalPart = weiStr.slice(-18).padStart(18, "0");

  return parseFloat(`${integerPart}.${decimalPart}`);
}

/**
 * Convert micro units (10^6) to standard units
 * Used for some IBC tokens and USDT/USDC
 */
export function microToStandard(micro: string | number): number {
  const microBigInt = typeof micro === "string" ? BigInt(micro) : BigInt(micro);
  return Number(microBigInt) / 1e6;
}

/**
 * Format INJ amount for display
 */
export function formatInjAmount(inj: number): string {
  if (inj === 0) return "0";
  if (inj < 0.000001) return inj.toExponential(4);
  return inj.toFixed(6).replace(/\.?0+$/, "");
}

/**
 * Get the Injective explorer URL for an address
 */
export function getInjectiveExplorerUrl(address: string): string {
  return `https://explorer.injective.network/account/${address}`;
}

/**
 * Get the Injective explorer URL for a transaction
 */
export function getInjectiveTxUrl(hash: string): string {
  return `https://explorer.injective.network/transaction/${hash}`;
}

/**
 * Injective unbonding period in days
 */
export const INJECTIVE_UNBONDING_DAYS = 21;

/**
 * Injective token decimals
 */
export const INJECTIVE_DECIMALS = 18;

/**
 * Common token decimals on Injective
 */
export const TOKEN_DECIMALS: Record<string, number> = {
  inj: 18,
  peggy0xdAC17F958D2ee523a2206206994597C13D831ec7: 6, // USDT
  peggy0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48: 6, // USDC
  peggy0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2: 18, // WETH
  factory: 18, // Factory tokens default
};

/**
 * Get decimals for a denom
 */
export function getDecimalsForDenom(denom: string): number {
  // Native INJ
  if (denom === "inj") return 18;

  // Peggy (Ethereum bridge) tokens
  if (denom.startsWith("peggy")) {
    return TOKEN_DECIMALS[denom] || 18;
  }

  // IBC tokens - most are 6 decimals
  if (denom.startsWith("ibc/")) {
    return 6;
  }

  // Factory tokens
  if (denom.startsWith("factory/")) {
    return 18;
  }

  // Default
  return 18;
}

/**
 * Convert amount based on denom decimals
 */
export function denomAmountToStandard(amount: string, denom: string): number {
  const decimals = getDecimalsForDenom(denom);
  const amountBigInt = BigInt(amount);
  return Number(amountBigInt) / Math.pow(10, decimals);
}

/**
 * Get symbol from denom
 */
export function getSymbolFromDenom(denom: string): string {
  // Native INJ
  if (denom === "inj") return "INJ";

  // Known Peggy tokens
  const peggySymbols: Record<string, string> = {
    "peggy0xdAC17F958D2ee523a2206206994597C13D831ec7": "USDT",
    "peggy0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": "USDC",
    "peggy0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": "WETH",
    "peggy0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599": "WBTC",
  };

  if (denom.startsWith("peggy")) {
    return peggySymbols[denom] || denom.slice(0, 12) + "...";
  }

  // IBC tokens - return shortened hash
  if (denom.startsWith("ibc/")) {
    return "IBC/" + denom.slice(4, 10);
  }

  // Factory tokens
  if (denom.startsWith("factory/")) {
    const parts = denom.split("/");
    return parts[parts.length - 1]?.toUpperCase() || "FACTORY";
  }

  return denom.toUpperCase();
}
