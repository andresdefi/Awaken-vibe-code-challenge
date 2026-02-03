// Polkadot-specific types for Subscan API responses

export interface SubscanResponse<T> {
  code: number;
  message: string;
  generated_at: number;
  data: T;
}

export interface SubscanListResponse<T> {
  code: number;
  message: string;
  generated_at: number;
  data: {
    count: number;
    list: T[];
  };
}

export interface RawTransfer {
  from: string;
  to: string;
  extrinsic_index: string;
  success: boolean;
  hash: string;
  block_num: number;
  block_timestamp: number;
  module: string;
  amount: string;
  amount_v2: string;
  fee: string;
  nonce: number;
  asset_symbol: string;
  asset_unique_id: string;
  item_at_block?: string;
}

export interface RawRewardSlash {
  event_index: string;
  block_num: number;
  block_timestamp: number;
  extrinsic_index: string;
  extrinsic_hash: string;
  module_id: string;
  event_id: string;
  event_method: string;
  account: string;
  amount: string;
  stash: string;
}

export interface RawUnbonding {
  amount: string;
  until: number;
}

export interface RawAssetChange {
  event_index: string;
  extrinsic_index: string;
  block_timestamp: number;
  event_id: string;
  amount: string;
  symbol: string;
  asset_unique_id: string;
  decimals: number;
}

export interface RawExtrinsic {
  extrinsic_index: string;
  call_module: string;
  call_module_function: string;
  block_num: number;
  block_timestamp: number;
  extrinsic_hash: string;
  success: boolean;
  fee: string;
  params: string;
  account_id: string;
}

export interface SubscanPriceHistory {
  feed_at: number;
  price: string;
}

export interface SubscanPrice {
  price: string;
  time: number;
}
