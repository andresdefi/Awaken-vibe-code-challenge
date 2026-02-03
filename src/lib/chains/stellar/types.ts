// Stellar (XLM) API Types

// Horizon API endpoint
export const STELLAR_HORIZON_URL = "https://horizon.stellar.org";

// XLM uses stroops (1 XLM = 10,000,000 stroops)
export const XLM_DECIMALS = 7;
export const STROOPS_PER_XLM = 10_000_000;

// Stellar Operation Types
export type StellarOperationType =
  // Payments
  | "create_account"
  | "payment"
  | "path_payment_strict_receive"
  | "path_payment_strict_send"
  // DEX
  | "manage_sell_offer"
  | "manage_buy_offer"
  | "create_passive_sell_offer"
  // Trustlines & Assets
  | "change_trust"
  | "allow_trust"
  | "set_trust_line_flags"
  // Account Management
  | "set_options"
  | "account_merge"
  | "manage_data"
  | "bump_sequence"
  // Claimable Balances
  | "create_claimable_balance"
  | "claim_claimable_balance"
  // Liquidity Pools
  | "liquidity_pool_deposit"
  | "liquidity_pool_withdraw"
  // Sponsorship
  | "begin_sponsoring_future_reserves"
  | "end_sponsoring_future_reserves"
  | "revoke_sponsorship"
  // Smart Contracts (Soroban)
  | "invoke_host_function"
  | "extend_footprint_ttl"
  | "restore_footprint"
  // Historical (deprecated)
  | "inflation";

// Asset types
export interface StellarAsset {
  asset_type: "native" | "credit_alphanum4" | "credit_alphanum12" | "liquidity_pool_shares";
  asset_code?: string;
  asset_issuer?: string;
}

// Base operation structure from Horizon
export interface StellarOperation {
  id: string;
  paging_token: string;
  transaction_successful: boolean;
  source_account: string;
  type: StellarOperationType;
  type_i: number;
  created_at: string;
  transaction_hash: string;

  // Payment operations
  from?: string;
  to?: string;
  amount?: string;
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;

  // Path payment operations
  source_amount?: string;
  source_asset_type?: string;
  source_asset_code?: string;
  source_asset_issuer?: string;
  path?: StellarAsset[];

  // DEX operations (offers)
  offer_id?: string;
  buying_asset_type?: string;
  buying_asset_code?: string;
  buying_asset_issuer?: string;
  selling_asset_type?: string;
  selling_asset_code?: string;
  selling_asset_issuer?: string;
  price?: string;
  price_r?: { n: number; d: number };

  // Create account
  account?: string;
  funder?: string;
  starting_balance?: string;

  // Account merge
  into?: string;

  // Change trust
  trustee?: string;
  trustor?: string;
  limit?: string;

  // Claimable balance
  claimable_balance_id?: string;
  claimants?: Array<{
    destination: string;
    predicate: object;
  }>;

  // Liquidity pool
  liquidity_pool_id?: string;
  reserves_max?: Array<{ asset: string; amount: string }>;
  reserves_min?: Array<{ asset: string; amount: string }>;
  reserves_deposited?: Array<{ asset: string; amount: string }>;
  reserves_received?: Array<{ asset: string; amount: string }>;
  shares_received?: string;
  shares?: string;

  // Set options
  inflation_dest?: string;
  home_domain?: string;
  signer_key?: string;
  signer_weight?: number;

  // Manage data
  name?: string;
  value?: string;

  // Sponsorship
  sponsored_id?: string;
}

// Transaction structure from Horizon
export interface StellarTransaction {
  id: string;
  paging_token: string;
  successful: boolean;
  hash: string;
  ledger: number;
  created_at: string;
  source_account: string;
  source_account_sequence: string;
  fee_account: string;
  fee_charged: string;
  max_fee: string;
  operation_count: number;
  memo_type: string;
  memo?: string;
  memo_bytes?: string;
}

// Horizon paginated response
export interface StellarOperationsResponse {
  _links: {
    self: { href: string };
    next: { href: string };
    prev: { href: string };
  };
  _embedded: {
    records: StellarOperation[];
  };
}

// Account info response
export interface StellarAccountResponse {
  id: string;
  account_id: string;
  sequence: string;
  subentry_count: number;
  home_domain?: string;
  inflation_destination?: string;
  thresholds: {
    low_threshold: number;
    med_threshold: number;
    high_threshold: number;
  };
  balances: Array<{
    balance: string;
    buying_liabilities?: string;
    selling_liabilities?: string;
    asset_type: string;
    asset_code?: string;
    asset_issuer?: string;
    liquidity_pool_id?: string;
  }>;
}

// Transaction details with fee
export interface StellarTransactionDetails {
  hash: string;
  fee_charged: string;
  created_at: string;
  memo?: string;
  memo_type: string;
  successful: boolean;
}

// Operation type to description mapping
export const STELLAR_OP_DESCRIPTIONS: Record<StellarOperationType, string> = {
  create_account: "Account created",
  payment: "XLM or token transfer",
  path_payment_strict_receive: "Cross-asset payment (receive exact)",
  path_payment_strict_send: "Cross-asset payment (send exact)",
  manage_sell_offer: "DEX sell order",
  manage_buy_offer: "DEX buy order",
  create_passive_sell_offer: "DEX passive sell order",
  change_trust: "Trustline modified",
  allow_trust: "Trust authorization changed",
  set_trust_line_flags: "Trustline flags modified",
  set_options: "Account settings modified",
  account_merge: "Account merged",
  manage_data: "Data entry modified",
  bump_sequence: "Sequence number bumped",
  create_claimable_balance: "Claimable balance created",
  claim_claimable_balance: "Claimable balance claimed",
  liquidity_pool_deposit: "Liquidity pool deposit",
  liquidity_pool_withdraw: "Liquidity pool withdrawal",
  begin_sponsoring_future_reserves: "Sponsorship started",
  end_sponsoring_future_reserves: "Sponsorship ended",
  revoke_sponsorship: "Sponsorship revoked",
  invoke_host_function: "Smart contract invocation",
  extend_footprint_ttl: "Contract TTL extended",
  restore_footprint: "Contract footprint restored",
  inflation: "Inflation payout (historical)",
};
