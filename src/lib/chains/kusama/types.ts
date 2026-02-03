// Kusama-specific types for Subscan API responses
// Kusama uses the same Substrate architecture as Polkadot

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

// Kusama-specific: Crowdloan contribution
export interface RawCrowdloanContribution {
  fund_id: number;
  para_id: number;
  who: string;
  contributed: string;
  contributing_block: number;
  block_timestamp: number;
  extrinsic_index: string;
  extrinsic_hash: string;
  memo: string;
  status: number; // 0: active, 1: refunded, 2: dissolved
}

// Kusama-specific: Parachain info for crowdloan
export interface RawParachainInfo {
  para_id: number;
  name: string;
  status: string;
  begin_period: number;
  end_period: number;
  first_slot: number;
  last_slot: number;
}

// Kusama-specific: Auction bid
export interface RawAuctionBid {
  auction_index: number;
  para_id: number;
  bidder: string;
  amount: string;
  first_slot: number;
  last_slot: number;
  block_num: number;
  block_timestamp: number;
  extrinsic_index: string;
  extrinsic_hash: string;
  bid_id: string;
  status: number;
}

// Crowdloan fund info
export interface RawCrowdloanFund {
  fund_id: number;
  para_id: number;
  first_period: number;
  last_period: number;
  raised: string;
  cap: string;
  status: number;
  lease_period?: number;
}
