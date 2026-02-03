// Shared types across all chains

export type TransactionType =
  | "transfer_sent"
  | "transfer_received"
  | "stake"
  | "unstake"
  | "emission_reward"
  | "slash"
  | "bond"
  | "unbond"
  | "nominate"
  // Ronin-specific types
  | "swap"
  | "nft_purchase"
  | "nft_sale"
  | "nft_sent"
  | "nft_received"
  | "token_sent"
  | "token_received"
  | "liquidity_add"
  | "liquidity_remove"
  | "approve"
  | "mint"
  | "burn"
  | "airdrop";

export type AwakenTag =
  | "payment"
  | "wallet_transfer"
  | "receive"
  | "staking_deposit"
  | "unstaking_withdraw"
  | "claim_rewards"
  | "lost"
  // Additional Awaken tags
  | "trade"
  | "gift_sent"
  | "gift_received"
  | "airdrop";

export interface NormalizedTransaction {
  id: string;
  type: TransactionType;
  timestamp: Date;
  sentAmount: number | null;
  sentCurrency: string | null;
  receivedAmount: number | null;
  receivedCurrency: string | null;
  feeAmount: number;
  feeCurrency: string;
  transactionHash: string;
  notes: string;
  tag: AwakenTag;
  fiatPrice?: number;
}

export interface AwakenCSVRow {
  Date: string;
  "Received Quantity": string;
  "Received Currency": string;
  "Received Fiat Amount": string;
  "Sent Quantity": string;
  "Sent Currency": string;
  "Sent Fiat Amount": string;
  "Fee Amount": string;
  "Fee Currency": string;
  "Transaction Hash": string;
  Notes: string;
  Tag: string;
}

// Chain configuration for the landing page
export interface ChainConfig {
  id: string;
  name: string;
  symbol: string;
  icon: string;
  description: string;
  features: string[];
  enabled: boolean;
}

// Perpetuals/Futures specific types for Awaken CSV
export type PerpsTag = "open_position" | "close_position" | "funding_payment";

export interface PerpsTransaction {
  id: string;
  date: Date;
  asset: string;  // Underlying asset (BTC, ETH, etc.)
  amount: number;  // Amount of underlying asset
  fee: number;
  pnl: number;  // Can be negative, positive, or zero
  paymentToken: string;  // Token P&L is settled in (USDC, USDT)
  notes: string;
  transactionHash: string;
  tag: PerpsTag;
}

export interface AwakenPerpsCSVRow {
  Date: string;
  Asset: string;
  Amount: string;
  Fee: string;
  "P&L": string;
  "Payment Token": string;
  Notes: string;
  "Transaction Hash": string;
  Tag: string;
}
