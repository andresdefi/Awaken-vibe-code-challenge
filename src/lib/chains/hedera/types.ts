// Hedera Mirror Node API Types

export const HEDERA_MIRROR_NODE_BASE = "https://mainnet-public.mirrornode.hedera.com/api/v1";

// Hedera uses tinybars (1 HBAR = 100,000,000 tinybars)
export const HBAR_DECIMALS = 8;
export const TINYBARS_PER_HBAR = 100_000_000;

export interface HederaTransfer {
  account: string;
  amount: number; // Positive = received, negative = sent (in tinybars)
  is_approval: boolean;
}

export interface HederaTokenTransfer {
  account: string;
  amount: number;
  token_id: string;
  is_approval: boolean;
}

export interface HederaNftTransfer {
  sender_account_id: string;
  receiver_account_id: string;
  serial_number: number;
  token_id: string;
  is_approval: boolean;
}

export interface HederaStakingRewardTransfer {
  account: string;
  amount: number;
}

export interface HederaTransaction {
  bytes: string | null;
  charged_tx_fee: number;
  consensus_timestamp: string;
  entity_id: string | null;
  max_fee: string;
  memo_base64: string;
  name: string; // Transaction type: CRYPTOTRANSFER, TOKENTRANSFER, etc.
  nft_transfers: HederaNftTransfer[];
  node: string;
  nonce: number;
  parent_consensus_timestamp: string | null;
  result: string; // SUCCESS, DUPLICATE_TRANSACTION, etc.
  scheduled: boolean;
  staking_reward_transfers: HederaStakingRewardTransfer[];
  token_transfers: HederaTokenTransfer[];
  transaction_hash: string;
  transaction_id: string;
  transfers: HederaTransfer[];
  valid_duration_seconds: string;
  valid_start_timestamp: string;
}

export interface HederaTransactionsResponse {
  transactions: HederaTransaction[];
  links: {
    next: string | null;
  };
}

export interface HederaAccount {
  account: string;
  alias: string | null;
  auto_renew_period: number;
  balance: {
    balance: number;
    timestamp: string;
    tokens: Array<{
      token_id: string;
      balance: number;
    }>;
  };
  created_timestamp: string;
  decline_reward: boolean;
  deleted: boolean;
  ethereum_nonce: number;
  evm_address: string | null;
  expiry_timestamp: string;
  key: {
    _type: string;
    key: string;
  } | null;
  max_automatic_token_associations: number;
  memo: string;
  pending_reward: number;
  receiver_sig_required: boolean;
  staked_account_id: string | null;
  staked_node_id: number | null;
  stake_period_start: string | null;
}

export interface HederaAccountResponse {
  account: string;
  balance: {
    balance: number;
    timestamp: string;
  };
}

// Token info for resolving token metadata
export interface HederaTokenInfo {
  token_id: string;
  symbol: string;
  name: string;
  decimals: string;
  type: string; // FUNGIBLE_COMMON, NON_FUNGIBLE_UNIQUE
}

// Transaction type mapping
export const HEDERA_TX_TYPES: Record<string, string> = {
  CRYPTOTRANSFER: "transfer",
  CRYPTOAPPROVEALLOWANCE: "approval",
  CRYPTODELETEALLOWANCE: "approval",
  CRYPTOCREATEACCOUNT: "account_create",
  CRYPTOUPDATEACCOUNT: "account_update",
  CRYPTODELETE: "account_delete",
  TOKENASSOCIATE: "token_associate",
  TOKENDISSOCIATE: "token_dissociate",
  TOKENCREATION: "token_create",
  TOKENBURN: "token_burn",
  TOKENMINT: "token_mint",
  TOKENWIPE: "token_wipe",
  TOKENFREEZE: "token_freeze",
  TOKENUNFREEZE: "token_unfreeze",
  TOKENGRANTKYC: "token_kyc",
  TOKENREVOKEKYC: "token_kyc",
  TOKENPAUSE: "token_pause",
  TOKENUNPAUSE: "token_unpause",
  TOKENDELETION: "token_delete",
  TOKENUPDATE: "token_update",
  TOKENFEEUPDATE: "token_update",
  CONTRACTCALL: "contract_call",
  CONTRACTCREATEINSTANCE: "contract_create",
  CONTRACTUPDATEINSTANCE: "contract_update",
  CONTRACTDELETEINSTANCE: "contract_delete",
  ETHEREUMTRANSACTION: "ethereum_tx",
  CONSENSUSCREATETOPIC: "consensus",
  CONSENSUSUPDATETOPIC: "consensus",
  CONSENSUSDELETETOPIC: "consensus",
  CONSENSUSSUBMITMESSAGE: "consensus",
  FILECREATE: "file",
  FILEAPPEND: "file",
  FILEUPDATE: "file",
  FILEDELETE: "file",
  SCHEDULECREATE: "schedule",
  SCHEDULESIGN: "schedule",
  SCHEDULEDELETE: "schedule",
  FREEZE: "network",
  SYSTEMDELETE: "network",
  SYSTEMUNDELETE: "network",
};
