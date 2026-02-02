// Bittensor-specific types for Taostats API responses

export interface RawTransfer {
  id: string;
  to: { ss58: string; hex: string };
  from: { ss58: string; hex: string };
  network: string;
  block_number: number;
  timestamp: string;
  amount: string;
  fee: string;
  transaction_hash: string;
  extrinsic_id: string;
}

export interface RawDelegationEvent {
  id: string;
  coldkey: { ss58: string; hex: string };
  hotkey: { ss58: string; hex: string };
  network: string;
  block_number: number;
  timestamp: string;
  amount: string;
  action: "stake" | "unstake" | "move";
  netuid?: number;
  fee?: string;
  transaction_hash?: string;
  extrinsic_id?: string;
}

export interface RawStakeBalanceHistory {
  address: { ss58: string; hex: string };
  network: string;
  block_number: number;
  timestamp: string;
  balance_staked: string;
  balance_staked_alpha_as_tao?: string;
  balance_staked_root?: string;
}

export interface TaoPrice {
  timestamp: string;
  price: number;
}

export interface PaginatedResponse<T> {
  pagination: {
    current_page: number;
    per_page: number;
    total_items: number;
    total_pages: number;
    next_page: number | null;
    prev_page: number | null;
  };
  data: T[];
}
