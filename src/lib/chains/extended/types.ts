// Extended Exchange API Types
// Docs: https://api.docs.extended.exchange/

// Trade response from Extended API
export interface ExtendedTrade {
  id: string;
  market: string;  // e.g., "BTC-USD-PERP"
  side: "buy" | "sell";
  price: string;
  size: string;
  fee: string;
  fee_asset: string;
  realized_pnl: string;
  timestamp: string;  // ISO 8601
  order_id: string;
  trade_type: "maker" | "taker";
  is_liquidation: boolean;
}

// Order response from Extended API
export interface ExtendedOrder {
  id: string;
  market: string;
  side: "buy" | "sell";
  type: "limit" | "market" | "stop_limit" | "stop_market";
  price: string;
  size: string;
  filled_size: string;
  remaining_size: string;
  status: "open" | "filled" | "cancelled" | "expired" | "rejected";
  created_at: string;
  updated_at: string;
  reduce_only: boolean;
  post_only: boolean;
  time_in_force: "gtc" | "ioc" | "fok";
}

// Funding payment from Extended API
export interface ExtendedFundingPayment {
  id: string;
  market: string;
  payment: string;  // Can be negative (paid) or positive (received)
  payment_asset: string;
  position_size: string;
  funding_rate: string;
  timestamp: string;
}

// Asset operation (deposit/withdrawal/transfer)
export interface ExtendedAssetOperation {
  id: string;
  type: "deposit" | "withdrawal" | "transfer_in" | "transfer_out";
  asset: string;
  amount: string;
  status: "pending" | "completed" | "failed";
  timestamp: string;
  tx_hash?: string;
  chain?: string;
}

// Position from Extended API
export interface ExtendedPosition {
  market: string;
  side: "long" | "short";
  size: string;
  entry_price: string;
  mark_price: string;
  liquidation_price: string;
  unrealized_pnl: string;
  realized_pnl: string;
  margin: string;
  leverage: string;
}

// Account balance
export interface ExtendedBalance {
  asset: string;
  available: string;
  locked: string;
  total: string;
}

// API response wrappers
export interface ExtendedPaginatedResponse<T> {
  data: T[];
  cursor?: string;
  has_more: boolean;
}

export interface ExtendedApiError {
  code: string;
  message: string;
}

// Market info for symbol parsing
export interface ExtendedMarket {
  symbol: string;  // e.g., "BTC-USD-PERP"
  base_asset: string;  // e.g., "BTC"
  quote_asset: string;  // e.g., "USD"
  contract_type: "perpetual" | "future";
  tick_size: string;
  lot_size: string;
  min_order_size: string;
  max_leverage: string;
}

// Normalized perps transaction for Awaken CSV
export interface PerpsTransaction {
  date: Date;
  asset: string;  // Underlying asset (BTC, ETH, etc.)
  amount: number;  // Amount of underlying asset
  fee: number;
  pnl: number;  // Can be negative, positive, or zero
  paymentToken: string;  // Token P&L is settled in (USDC, USDT)
  notes: string;
  transactionHash: string;
  tag: "open_position" | "close_position" | "funding_payment";
}

// Extended-specific constants
export const EXTENDED_API_BASE = "https://api.starknet.extended.exchange";
export const EXTENDED_WS_BASE = "wss://api.starknet.extended.exchange";

// Known markets and their base assets
export const EXTENDED_MARKETS: Record<string, { base: string; quote: string }> = {
  "BTC-USD-PERP": { base: "BTC", quote: "USD" },
  "ETH-USD-PERP": { base: "ETH", quote: "USD" },
  "SOL-USD-PERP": { base: "SOL", quote: "USD" },
  "ARB-USD-PERP": { base: "ARB", quote: "USD" },
  "AVAX-USD-PERP": { base: "AVAX", quote: "USD" },
  "DOGE-USD-PERP": { base: "DOGE", quote: "USD" },
  "LINK-USD-PERP": { base: "LINK", quote: "USD" },
  "MATIC-USD-PERP": { base: "MATIC", quote: "USD" },
  "OP-USD-PERP": { base: "OP", quote: "USD" },
  "XRP-USD-PERP": { base: "XRP", quote: "USD" },
  "STRK-USD-PERP": { base: "STRK", quote: "USD" },
  "WIF-USD-PERP": { base: "WIF", quote: "USD" },
  "PEPE-USD-PERP": { base: "PEPE", quote: "USD" },
  "SUI-USD-PERP": { base: "SUI", quote: "USD" },
};
