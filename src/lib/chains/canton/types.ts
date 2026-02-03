// Canton Network API Types
// API: https://api.cantonnodes.com

// Canton Party ID format: hint::hash (e.g., "Digital-Asset-2::12209b21d...")
export type CantonPartyId = string;

// Transaction update from /v2/updates endpoint
export interface CantonUpdate {
  update_id: string;
  migration_id: number;
  workflow_id: string;
  record_time: string;  // ISO 8601
  synchronizer_id: string;
  effective_at: string;  // ISO 8601
  root_event_ids: string[];
  events_by_id: Record<string, CantonEvent>;
}

// Event types in Canton
export type CantonEventType = "created_event" | "exercised_event";

export interface CantonEvent {
  event_type: CantonEventType;
  event_id: string;
  contract_id: string;
  template_id: string;
  package_name: string;
  create_arguments?: Record<string, unknown>;
  choice?: string;
  choice_argument?: Record<string, unknown>;
  exercise_result?: unknown;
  child_event_ids?: string[];
}

// Amulet activity from processed updates
export interface CantonAmuletActivity {
  event_id: string;
  offset: string;
  date: string;  // ISO 8601
  domain_id: string;
  round: number;
  amulet_price: string;
  activity_type: "transfer" | "mint" | "devnet_tap" | "abort_transfer_instruction";
  transfer?: CantonTransfer;
  mint?: CantonAmuletAmount;
  tap?: CantonAmuletAmount;
}

export interface CantonTransfer {
  provider: string;
  sender: CantonSenderAmount;
  receivers: CantonReceiverAmount[];
  balance_changes: CantonBalanceChange[];
  description?: string;
  transfer_kind?: "create_transfer_instruction" | "transfer_instruction_accept" | "preapproval_send";
}

export interface CantonSenderAmount {
  party: string;
  input_amulet_amount: string;
  input_app_reward_amount: string;
  input_validator_reward_amount: string;
  input_sv_reward_amount: string;
  input_validator_faucet_amount: string;
  sender_change_fee: string;
  sender_change_amount: string;
  sender_fee: string;
}

export interface CantonReceiverAmount {
  party: string;
  amount: string;
  receiver_fee: string;
}

export interface CantonBalanceChange {
  party: string;
  change_to_initial_amount_as_of_round_zero: string;
  change_to_holding_fees_rate: string;
}

export interface CantonAmuletAmount {
  initial_amount: string;
  holding_fee: string;
}

// Wallet balance response
export interface CantonWalletBalance {
  round: number;
  effective_unlocked_qty: string;
  effective_locked_qty: string;
  total_holding_fees: string;
}

// Holdings summary response (newer API)
export interface CantonHoldingsSummary {
  total_unlocked_balance: string;
  total_locked_balance: string;
  total_balance: string;
  accumulated_holding_fee: string;
}

// API response wrappers
export interface CantonUpdatesResponse {
  transactions: CantonUpdate[];
}

export interface CantonLatestRoundResponse {
  round: number;
  effectiveAt: string;
}

// Constants
export const CANTON_API_BASE = "https://api.cantonnodes.com";
export const CANTON_COIN_SYMBOL = "CC";
export const CANTON_COIN_DECIMALS = 10;  // Canton uses 10 decimal places

// Known transaction templates for classification
export const CANTON_TEMPLATES = {
  TRANSFER: "Splice.Amulet:Transfer",
  AMULET: "Splice.Amulet:Amulet",
  LOCKED_AMULET: "Splice.Amulet:LockedAmulet",
  APP_REWARD: "Splice.Amulet:AppRewardCoupon",
  VALIDATOR_REWARD: "Splice.Amulet:ValidatorRewardCoupon",
  SV_REWARD: "Splice.Amulet:SvRewardCoupon",
  VALIDATOR_FAUCET: "Splice.ValidatorLicense:ValidatorFaucetCoupon",
} as const;
