// Radix Gateway API response types

export interface RadixLedgerState {
  network: string;
  state_version: number;
  proposer_round_timestamp: string;
  epoch: number;
  round: number;
}

export interface RadixTransactionBalanceChange {
  entity_address: string;
  fee_balance_change?: {
    resource_address: string;
    balance_change: string;
  };
  fee_balance_changes?: Array<{
    type: string;
    resource_address: string;
    balance_change: string;
  }>;
  non_fee_balance_changes?: Array<{
    resource_address: string;
    balance_change: string;
  }>;
}

export interface RadixManifestClass {
  class: string;
  is_subintent: boolean;
}

export interface RadixTransactionReceipt {
  status: "CommittedSuccess" | "CommittedFailure" | "Pending" | "Rejected";
  fee_summary?: {
    xrd_total_royalty_cost: string;
    xrd_total_storage_cost: string;
    xrd_total_tipping_cost: string;
    xrd_total_execution_cost: string;
    xrd_total_finalization_cost: string;
    execution_cost_units_consumed: number;
    finalization_cost_units_consumed: number;
  };
  error_message?: string;
}

export interface RadixTransaction {
  intent_hash: string;
  state_version: number;
  epoch: number;
  round: number;
  round_timestamp: string;
  transaction_status: "CommittedSuccess" | "CommittedFailure" | "Pending" | "Rejected";
  payload_hash?: string;
  confirmed_at?: string;
  receipt?: RadixTransactionReceipt;
  manifest_instructions?: string;
  manifest_classes?: RadixManifestClass[];
  balance_changes?: RadixTransactionBalanceChange;
  affected_global_entities?: string[];
  message?: string;
}

export interface RadixStreamTransactionsResponse {
  ledger_state: RadixLedgerState;
  total_count?: number;
  next_cursor?: string;
  items: RadixTransaction[];
}

export interface RadixEntityDetails {
  address: string;
  fungible_resources?: {
    total_count: number;
    items: Array<{
      aggregation_level: string;
      resource_address: string;
      explicit_metadata?: {
        items: Array<{
          key: string;
          value: {
            typed?: {
              value?: string;
            };
          };
        }>;
      };
      vaults?: {
        total_count: number;
        items: Array<{
          vault_address: string;
          amount: string;
        }>;
      };
    }>;
  };
  non_fungible_resources?: {
    total_count: number;
    items: Array<{
      aggregation_level: string;
      resource_address: string;
      vaults?: {
        total_count: number;
        items: Array<{
          vault_address: string;
          total_count: number;
        }>;
      };
    }>;
  };
  metadata?: {
    items: Array<{
      key: string;
      value: {
        typed?: {
          value?: string;
        };
      };
    }>;
  };
}

export interface RadixStateEntityDetailsResponse {
  ledger_state: RadixLedgerState;
  items: RadixEntityDetails[];
}

// Well-known addresses
export const XRD_RESOURCE_ADDRESS = "resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd";

// Manifest class types for categorization
export type RadixManifestClassType =
  | "General"
  | "Transfer"
  | "ValidatorStake"
  | "ValidatorUnstake"
  | "ValidatorClaimXrd"
  | "PoolContribution"
  | "PoolRedemption"
  | "AccountDepositSettingsUpdate"
  | "AccountResourcePreferenceUpdate"
  | "AccountAuthorizedDepositorUpdate";
