// Injective-specific types for Cosmos SDK / CometBFT RPC responses

export interface RpcTxSearchResponse {
  jsonrpc: string;
  id: number;
  result: {
    txs: RpcTransaction[];
    total_count: string;
  };
}

export interface RpcTransaction {
  hash: string;
  height: string;
  index: number;
  tx_result: {
    code: number;
    data: string;
    log: string;
    info: string;
    gas_wanted: string;
    gas_used: string;
    events: RpcEvent[];
  };
  tx: string; // base64 encoded
}

export interface RpcEvent {
  type: string;
  attributes: RpcAttribute[];
}

export interface RpcAttribute {
  key: string;
  value: string;
  index?: boolean;
}

export interface LcdTxResponse {
  tx: DecodedTx;
  tx_response: {
    height: string;
    txhash: string;
    codespace: string;
    code: number;
    data: string;
    raw_log: string;
    logs: TxLog[];
    info: string;
    gas_wanted: string;
    gas_used: string;
    timestamp: string;
    events: RpcEvent[];
  };
}

export interface DecodedTx {
  body: {
    messages: TxMessage[];
    memo: string;
    timeout_height: string;
    extension_options: unknown[];
    non_critical_extension_options: unknown[];
  };
  auth_info: {
    signer_infos: SignerInfo[];
    fee: TxFee;
    tip: unknown;
  };
  signatures: string[];
}

export interface TxMessage {
  "@type": string;
  [key: string]: unknown;
}

export interface SignerInfo {
  public_key: {
    "@type": string;
    key: string;
  };
  mode_info: {
    single: {
      mode: string;
    };
  };
  sequence: string;
}

export interface TxFee {
  amount: Coin[];
  gas_limit: string;
  payer: string;
  granter: string;
}

export interface Coin {
  denom: string;
  amount: string;
}

export interface TxLog {
  msg_index: number;
  log: string;
  events: LogEvent[];
}

export interface LogEvent {
  type: string;
  attributes: { key: string; value: string }[];
}

// Cosmos SDK message types
export interface MsgSend {
  "@type": "/cosmos.bank.v1beta1.MsgSend";
  from_address: string;
  to_address: string;
  amount: Coin[];
}

export interface MsgTransfer {
  "@type": "/ibc.applications.transfer.v1.MsgTransfer";
  source_port: string;
  source_channel: string;
  token: Coin;
  sender: string;
  receiver: string;
  timeout_height: { revision_number: string; revision_height: string };
  timeout_timestamp: string;
  memo: string;
}

export interface MsgDelegate {
  "@type": "/cosmos.staking.v1beta1.MsgDelegate";
  delegator_address: string;
  validator_address: string;
  amount: Coin;
}

export interface MsgUndelegate {
  "@type": "/cosmos.staking.v1beta1.MsgUndelegate";
  delegator_address: string;
  validator_address: string;
  amount: Coin;
}

export interface MsgBeginRedelegate {
  "@type": "/cosmos.staking.v1beta1.MsgBeginRedelegate";
  delegator_address: string;
  validator_src_address: string;
  validator_dst_address: string;
  amount: Coin;
}

export interface MsgWithdrawDelegatorReward {
  "@type": "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward";
  delegator_address: string;
  validator_address: string;
}

// Injective Exchange module messages
export interface MsgCreateSpotMarketOrder {
  "@type": "/injective.exchange.v1beta1.MsgCreateSpotMarketOrder";
  sender: string;
  order: {
    market_id: string;
    order_info: {
      subaccount_id: string;
      fee_recipient: string;
      price: string;
      quantity: string;
    };
    order_type: number;
    trigger_price: string;
  };
}

export interface MsgCreateSpotLimitOrder {
  "@type": "/injective.exchange.v1beta1.MsgCreateSpotLimitOrder";
  sender: string;
  order: {
    market_id: string;
    order_info: {
      subaccount_id: string;
      fee_recipient: string;
      price: string;
      quantity: string;
    };
    order_type: number;
    trigger_price: string;
  };
}

// IBC Denom trace
export interface DenomTrace {
  denom_trace: {
    path: string;
    base_denom: string;
  };
}

// Delegation response
export interface DelegationResponse {
  delegation_responses: {
    delegation: {
      delegator_address: string;
      validator_address: string;
      shares: string;
    };
    balance: Coin;
  }[];
  pagination: {
    next_key: string | null;
    total: string;
  };
}

// Unbonding delegation response
export interface UnbondingDelegationResponse {
  unbonding_responses: {
    delegator_address: string;
    validator_address: string;
    entries: {
      creation_height: string;
      completion_time: string;
      initial_balance: string;
      balance: string;
    }[];
  }[];
  pagination: {
    next_key: string | null;
    total: string;
  };
}

// Rewards response
export interface RewardsResponse {
  rewards: {
    validator_address: string;
    reward: Coin[];
  }[];
  total: Coin[];
}

// Processed transaction for internal use
export interface ProcessedInjTx {
  hash: string;
  height: string;
  timestamp: Date;
  messages: TxMessage[];
  fee: Coin[];
  gasUsed: string;
  gasWanted: string;
  code: number;
  events: RpcEvent[];
  memo?: string;
}

// Token metadata
export interface TokenMetadata {
  symbol: string;
  name: string;
  decimals: number;
  coingeckoId?: string;
  denom: string;
}
