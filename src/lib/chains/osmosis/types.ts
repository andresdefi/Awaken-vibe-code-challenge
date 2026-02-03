// Osmosis-specific types for Cosmos SDK / CometBFT RPC responses

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
  index: boolean;
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

// Specific message types
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

export interface MsgSwapExactAmountIn {
  "@type": "/osmosis.gamm.v1beta1.MsgSwapExactAmountIn";
  sender: string;
  routes: { pool_id: string; token_out_denom: string }[];
  token_in: Coin;
  token_out_min_amount: string;
}

export interface MsgSwapExactAmountOut {
  "@type": "/osmosis.gamm.v1beta1.MsgSwapExactAmountOut";
  sender: string;
  routes: { pool_id: string; token_in_denom: string }[];
  token_in_max_amount: string;
  token_out: Coin;
}

export interface MsgJoinPool {
  "@type": "/osmosis.gamm.v1beta1.MsgJoinPool";
  sender: string;
  pool_id: string;
  share_out_amount: string;
  token_in_maxs: Coin[];
}

export interface MsgExitPool {
  "@type": "/osmosis.gamm.v1beta1.MsgExitPool";
  sender: string;
  pool_id: string;
  share_in_amount: string;
  token_out_mins: Coin[];
}

export interface MsgLockTokens {
  "@type": "/osmosis.lockup.MsgLockTokens";
  owner: string;
  duration: string;
  coins: Coin[];
}

export interface MsgBeginUnlocking {
  "@type": "/osmosis.lockup.MsgBeginUnlocking";
  owner: string;
  ID: string;
  coins: Coin[];
}

// IBC Denom trace
export interface DenomTrace {
  denom_trace: {
    path: string;
    base_denom: string;
  };
}

// Asset metadata from chain-registry
export interface AssetMetadata {
  symbol: string;
  name: string;
  decimals: number;
  coingeckoId?: string;
  base: string;
}

// Price data
export interface OsmoPrice {
  timestamp: string;
  price: number;
}

// Processed transaction for internal use
export interface ProcessedOsmoTx {
  hash: string;
  height: string;
  timestamp: Date;
  messages: TxMessage[];
  fee: Coin[];
  gasUsed: string;
  gasWanted: string;
  code: number;
  events: RpcEvent[];
}
