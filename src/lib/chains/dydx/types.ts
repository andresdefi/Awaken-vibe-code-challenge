// dYdX v4 (Cosmos-based) Indexer API Types
// Docs: https://docs.dydx.exchange/api_integration-indexer/indexer_api

// Subaccount info from dYdX API
export interface DydxSubaccount {
  address: string;
  subaccountNumber: number;
  equity: string;
  freeCollateral: string;
  marginEnabled: boolean;
  updatedAtHeight: string;
}

// Trade fill response from dYdX API
export interface DydxFill {
  id: string;
  side: "BUY" | "SELL";
  liquidity: "TAKER" | "MAKER";
  type: "LIMIT" | "MARKET" | "LIQUIDATED" | "LIQUIDATION" | "DELEVERAGED";
  market: string;        // e.g., "BTC-USD"
  marketType: "PERPETUAL" | "SPOT";
  price: string;
  size: string;
  fee: string;
  createdAt: string;     // ISO timestamp
  createdAtHeight: string;
  orderId: string;
  clientMetadata: string;
  subaccountNumber: number;
}

// Transfer response from dYdX API (deposits, withdrawals)
export interface DydxTransfer {
  id: string;
  sender: {
    address: string;
    subaccountNumber?: number;
  };
  recipient: {
    address: string;
    subaccountNumber?: number;
  };
  size: string;
  symbol: string;        // e.g., "USDC"
  type: "DEPOSIT" | "WITHDRAWAL" | "TRANSFER_IN" | "TRANSFER_OUT";
  createdAt: string;
  createdAtHeight: string;
  transactionHash: string;
}

// Funding payment response from dYdX API
export interface DydxFundingPayment {
  market: string;        // e.g., "BTC-USD"
  payment: string;       // positive = received, negative = paid
  rate: string;
  positionSize: string;
  price: string;
  effectiveAt: string;   // ISO timestamp
  effectiveAtHeight: string;
}

// Position response from dYdX API
export interface DydxPosition {
  market: string;
  status: "OPEN" | "CLOSED" | "LIQUIDATED";
  side: "LONG" | "SHORT";
  size: string;
  maxSize: string;
  entryPrice: string;
  exitPrice: string | null;
  realizedPnl: string;
  unrealizedPnl: string;
  createdAt: string;
  createdAtHeight: string;
  closedAt: string | null;
  sumOpen: string;
  sumClose: string;
  netFunding: string;
}

// Paginated response wrapper for dYdX API
export interface DydxPaginatedResponse<T> {
  [key: string]: T[] | number | undefined;
  pageSize?: number;
  totalResults?: number;
  offset?: number;
}

// API error response
export interface DydxApiError {
  errors: Array<{
    msg: string;
  }>;
}

// dYdX Indexer base URLs
export const DYDX_INDEXER_BASE = "https://indexer.dydx.trade/v4";
export const DYDX_TESTNET_INDEXER_BASE = "https://indexer.v4testnet.dydx.exchange/v4";

// Known perpetual markets on dYdX v4
export const DYDX_MARKETS: Record<string, { base: string; quote: string }> = {
  "BTC-USD": { base: "BTC", quote: "USD" },
  "ETH-USD": { base: "ETH", quote: "USD" },
  "SOL-USD": { base: "SOL", quote: "USD" },
  "AVAX-USD": { base: "AVAX", quote: "USD" },
  "LINK-USD": { base: "LINK", quote: "USD" },
  "DOGE-USD": { base: "DOGE", quote: "USD" },
  "MATIC-USD": { base: "MATIC", quote: "USD" },
  "ARB-USD": { base: "ARB", quote: "USD" },
  "OP-USD": { base: "OP", quote: "USD" },
  "ATOM-USD": { base: "ATOM", quote: "USD" },
  "DOT-USD": { base: "DOT", quote: "USD" },
  "UNI-USD": { base: "UNI", quote: "USD" },
  "AAVE-USD": { base: "AAVE", quote: "USD" },
  "XRP-USD": { base: "XRP", quote: "USD" },
  "LTC-USD": { base: "LTC", quote: "USD" },
  "BCH-USD": { base: "BCH", quote: "USD" },
  "NEAR-USD": { base: "NEAR", quote: "USD" },
  "APT-USD": { base: "APT", quote: "USD" },
  "SUI-USD": { base: "SUI", quote: "USD" },
  "WIF-USD": { base: "WIF", quote: "USD" },
  "PEPE-USD": { base: "PEPE", quote: "USD" },
  "BONK-USD": { base: "BONK", quote: "USD" },
  "SHIB-USD": { base: "SHIB", quote: "USD" },
  "DYDX-USD": { base: "DYDX", quote: "USD" },
  "TIA-USD": { base: "TIA", quote: "USD" },
  "SEI-USD": { base: "SEI", quote: "USD" },
  "INJ-USD": { base: "INJ", quote: "USD" },
  "FET-USD": { base: "FET", quote: "USD" },
  "RNDR-USD": { base: "RNDR", quote: "USD" },
  "JUP-USD": { base: "JUP", quote: "USD" },
  "STRK-USD": { base: "STRK", quote: "USD" },
  "CRV-USD": { base: "CRV", quote: "USD" },
  "MKR-USD": { base: "MKR", quote: "USD" },
  "LDO-USD": { base: "LDO", quote: "USD" },
  "FIL-USD": { base: "FIL", quote: "USD" },
  "RUNE-USD": { base: "RUNE", quote: "USD" },
  "TRX-USD": { base: "TRX", quote: "USD" },
  "XLM-USD": { base: "XLM", quote: "USD" },
  "ETC-USD": { base: "ETC", quote: "USD" },
  "COMP-USD": { base: "COMP", quote: "USD" },
  "SNX-USD": { base: "SNX", quote: "USD" },
  "WLD-USD": { base: "WLD", quote: "USD" },
  "BLUR-USD": { base: "BLUR", quote: "USD" },
  "AXL-USD": { base: "AXL", quote: "USD" },
};
