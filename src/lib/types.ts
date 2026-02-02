// Shared types across all chains

export type TransactionType =
  | "transfer_sent"
  | "transfer_received"
  | "stake"
  | "unstake"
  | "emission_reward";

export type AwakenTag =
  | "payment"
  | "wallet_transfer"
  | "receive"
  | "staking_deposit"
  | "unstaking_withdraw"
  | "claim_rewards";

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
