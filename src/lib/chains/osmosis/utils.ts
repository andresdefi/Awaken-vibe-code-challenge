// Osmosis utility functions

/**
 * Validates an Osmosis address format.
 * Osmosis uses Bech32 encoding with "osmo" prefix.
 */
export function isValidOsmosisAddress(address: string): boolean {
  if (!address || typeof address !== "string") {
    return false;
  }

  // Osmosis addresses start with "osmo1"
  if (!address.startsWith("osmo1")) {
    return false;
  }

  // Osmosis addresses are typically 43-44 characters
  if (address.length < 43 || address.length > 45) {
    return false;
  }

  // Check for valid Bech32 characters (lowercase alphanumeric, excluding 1, b, i, o)
  const bech32Regex = /^osmo1[023456789ac-hj-np-z]+$/;
  return bech32Regex.test(address);
}

/**
 * Converts uosmo (micro-OSMO) to OSMO.
 * 1 OSMO = 1,000,000 uosmo
 */
export function uosmoToOsmo(uosmo: string | number | bigint): number {
  const value = typeof uosmo === "string" ? BigInt(uosmo) : BigInt(uosmo);
  return Number(value) / 1_000_000;
}

/**
 * Gets the decimals for a given denom.
 * Most Cosmos SDK tokens use 6 decimals, but IBC tokens vary.
 */
export function getDecimalsForDenom(denom: string): number {
  // Native OSMO
  if (denom === "uosmo") {
    return 6;
  }

  // Common IBC tokens with known decimals
  const knownDecimals: Record<string, number> = {
    // USDC (Noble)
    "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4": 6,
    // ATOM
    "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2": 6,
    // USDT (Kava)
    "ibc/4ABBEF4C8926DDDB320AE5188CFD63267ABBCEFC0583E4AE05D6E5AA2401DDAB": 6,
    // WBTC
    "ibc/D1542AA8762DB13087D8364F3EA6509FD6F009A34F00426AF9E4F9FA85CBBF1F": 8,
    // WETH
    "ibc/EA1D43981D5C9A1C4AAEA9C23BB1D4FA126BA9BC7020A25E0AE4AA841EA25DC5": 18,
    // DAI
    "ibc/0CD3A0285E1341859B5E86B6AB7682F023D03E97607CCC1DC95706411D866DF7": 18,
  };

  if (knownDecimals[denom]) {
    return knownDecimals[denom];
  }

  // Factory tokens (often 6 decimals)
  if (denom.startsWith("factory/")) {
    return 6;
  }

  // Gamm (LP) tokens
  if (denom.startsWith("gamm/pool/")) {
    return 18;
  }

  // Default to 6 for unknown IBC tokens
  return 6;
}

/**
 * Converts a token amount to human-readable format based on its denom.
 */
export function formatTokenAmount(amount: string | number | bigint, denom: string): number {
  const value = typeof amount === "string" ? BigInt(amount) : BigInt(amount);
  const decimals = getDecimalsForDenom(denom);
  return Number(value) / Math.pow(10, decimals);
}

/**
 * Extracts a clean symbol from a denom.
 */
export function getDenomSymbol(denom: string): string {
  // Native OSMO
  if (denom === "uosmo") {
    return "OSMO";
  }

  // Factory tokens
  if (denom.startsWith("factory/")) {
    const parts = denom.split("/");
    const lastPart = parts[parts.length - 1];
    // Handle alloyed tokens
    if (lastPart.startsWith("all")) {
      return lastPart.replace("all", "").toUpperCase();
    }
    return lastPart.toUpperCase();
  }

  // Gamm tokens
  if (denom.startsWith("gamm/pool/")) {
    const poolId = denom.replace("gamm/pool/", "");
    return `GAMM-${poolId}`;
  }

  // IBC tokens - return a shortened hash
  if (denom.startsWith("ibc/")) {
    const hash = denom.replace("ibc/", "");
    return `IBC-${hash.slice(0, 6)}`;
  }

  return denom.toUpperCase();
}

/**
 * Parses the message type to get a readable action.
 */
export function getMessageAction(typeUrl: string): string {
  const actions: Record<string, string> = {
    "/cosmos.bank.v1beta1.MsgSend": "send",
    "/ibc.applications.transfer.v1.MsgTransfer": "ibc_transfer",
    "/cosmos.staking.v1beta1.MsgDelegate": "delegate",
    "/cosmos.staking.v1beta1.MsgUndelegate": "undelegate",
    "/cosmos.staking.v1beta1.MsgBeginRedelegate": "redelegate",
    "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward": "claim_rewards",
    "/osmosis.gamm.v1beta1.MsgSwapExactAmountIn": "swap",
    "/osmosis.gamm.v1beta1.MsgSwapExactAmountOut": "swap",
    "/osmosis.gamm.v1beta1.MsgJoinPool": "add_liquidity",
    "/osmosis.gamm.v1beta1.MsgExitPool": "remove_liquidity",
    "/osmosis.gamm.v1beta1.MsgJoinSwapExternAmountIn": "add_liquidity",
    "/osmosis.gamm.v1beta1.MsgExitSwapShareAmountIn": "remove_liquidity",
    "/osmosis.lockup.MsgLockTokens": "lock_tokens",
    "/osmosis.lockup.MsgBeginUnlocking": "unlock_tokens",
    "/osmosis.superfluid.MsgSuperfluidDelegate": "superfluid_delegate",
    "/osmosis.superfluid.MsgSuperfluidUndelegate": "superfluid_undelegate",
    "/osmosis.concentratedliquidity.v1beta1.MsgCreatePosition": "create_cl_position",
    "/osmosis.concentratedliquidity.v1beta1.MsgWithdrawPosition": "withdraw_cl_position",
    "/osmosis.concentratedliquidity.v1beta1.MsgCollectSpreadRewards": "collect_cl_rewards",
    "/osmosis.concentratedliquidity.v1beta1.MsgCollectIncentives": "collect_cl_incentives",
  };

  return actions[typeUrl] || typeUrl.split(".").pop()?.replace("Msg", "").toLowerCase() || "unknown";
}

/**
 * Formats a timestamp string to a Date object.
 */
export function parseTimestamp(timestamp: string): Date {
  return new Date(timestamp);
}

/**
 * Gets the date string in YYYY-MM-DD format for price lookups.
 */
export function getDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}
