// GMX V2 (Arbitrum) Subsquid API Types
// API: https://gmx.squids.live/gmx-synthetics-arbitrum/graphql

// Trade action from GMX Subsquid
export interface GmxTradeAction {
  id: string;
  eventName: string;
  account: string;
  marketAddress: string;
  collateralTokenAddress: string;
  sizeDeltaUsd: string;
  collateralDeltaAmount: string;
  basePnlUsd: string;
  priceImpactUsd: string;
  borrowingFeeAmount: string;
  fundingFeeAmount: string;
  positionFeeAmount: string;
  transaction: {
    hash: string;
    timestamp: number;
    blockNumber: number;
  };
}

// GraphQL response wrapper
export interface GmxGraphQLResponse {
  data: {
    tradeActions: GmxTradeAction[];
  };
  errors?: Array<{ message: string }>;
}

// Claim action for funding fees
export interface GmxClaimAction {
  id: string;
  eventName: string;
  account: string;
  marketAddresses: string[];
  amounts: string[];
  transaction: {
    hash: string;
    timestamp: number;
    blockNumber: number;
  };
}

// GraphQL response for claims
export interface GmxClaimGraphQLResponse {
  data: {
    claimActions: GmxClaimAction[];
  };
  errors?: Array<{ message: string }>;
}

// GMX Subsquid API endpoint
export const GMX_SUBSQUID_URL = "https://gmx.squids.live/gmx-synthetics-arbitrum/graphql";

// Market address to symbol mapping for GMX V2 on Arbitrum
// These are the main perpetual markets
export const GMX_MARKET_SYMBOLS: Record<string, string> = {
  // ETH markets
  "0x70d95587d40a2caf56bd97485ab3eec10bee6336": "ETH",
  "0x450bb6774dd8a756274e0ab4107953259d2ac541": "ETH",
  // BTC markets
  "0x47c031236e19d024b42f8ae6780e44a573170703": "BTC",
  "0x7c68c7866a64fa2160f78eeae12217ffbf871fa8": "BTC",
  // SOL market
  "0x09400d9db990d5ed3f35d7be61dfaeb900af03c9": "SOL",
  // ARB market
  "0xc25cef6061cf5de5eb761b50e4743c1f5d7e5407": "ARB",
  // DOGE market
  "0x7f1fa204bb700853d36994da19f830b6ad18455c": "DOGE",
  // LTC market
  "0x0ccb4faa6f1f1b30911619f1184082ab4e25813c": "LTC",
  // LINK market
  "0x7f1fa204bb700853d36994da19f830b6ad18455d": "LINK",
  // UNI market
  "0xc7abb2c5f3bf3ceb389df0eecd6120d451170b50": "UNI",
  // XRP market
  "0x0968a8b919e0b5e31c5d52c6e2f38a7c2b6d0f8a": "XRP",
  // NEAR market
  "0x63dc80ee90f26f1de778a8b933e93d2e0f37a437": "NEAR",
  // ATOM market
  "0x248c35760068ce009a13076d573ed3497a47bcd4": "ATOM",
  // AAVE market
  "0x1cefb0e1ec36c7971bed1d64291fc16a145f35dc": "AAVE",
  // AVAX market
  "0xd9535bb5f58a1a75032416f2dfe7880c30575a41": "AVAX",
  // OP market
  "0x4fdc07d68fbd39c31edfd5d0ba30c73a2e5ccc6e": "OP",
  // GMX market
  "0x55391d178ce46e7ac8eaace4152b4b1a02e0c98c": "GMX",
  // PEPE market
  "0x2b477989a4fe9eff9eb4a6cc5a4c39e6bc6d3b79": "PEPE",
  // WIF market
  "0x0418643f94ef14917f1345ce5c460c37dfb0a0a3": "WIF",
  // SHIB market
  "0x34b3a42bac1c93f3546735a8e40df0acfee96847": "SHIB",
  // ORDI market
  "0xc2de6759a130fb9236d4d6ba0c0f8e2a29a30e98": "ORDI",
  // STX market
  "0xd0b4ad8c4a6d8c4c4ab3b4c7f2e3a4d5c6b7a8e9": "STX",
};

// Known event names for position changes
export const INCREASE_EVENTS = [
  "PositionIncrease",
  "OrderExecuted",
] as const;

export const DECREASE_EVENTS = [
  "PositionDecrease",
  "OrderCancelled",
  "PositionLiquidated",
  "OrderFrozen",
] as const;

// Collateral token addresses to symbols
export const COLLATERAL_TOKENS: Record<string, string> = {
  "0xaf88d065e77c8cc2239327c5edb3a432268e5831": "USDC",
  "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8": "USDC.e",
  "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9": "USDT",
  "0x82af49447d8a07e3bd95bd0d56f35241523fbab1": "WETH",
  "0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f": "WBTC",
};
