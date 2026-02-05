// Kaspa API response types

export interface KaspaInput {
  transaction_id: string;
  index: number;
  previous_outpoint_hash: string;
  previous_outpoint_index: number;
  previous_outpoint_address: string;
  previous_outpoint_amount: number;
  signature_script: string;
  sig_op_count: number;
}

export interface KaspaOutput {
  transaction_id: string;
  index: number;
  amount: number;
  script_public_key: string;
  script_public_key_address: string;
  script_public_key_type: string;
}

export interface KaspaTransaction {
  subnetwork_id: string;
  transaction_id: string;
  hash: string;
  mass: number;
  payload: string | null;
  block_hash: string[];
  block_time: number; // Unix timestamp in milliseconds
  is_accepted: boolean;
  accepting_block_hash: string;
  accepting_block_blue_score: number;
  accepting_block_time: number;
  inputs: KaspaInput[];
  outputs: KaspaOutput[];
}

export interface KaspaPrice {
  price: number;
}

export interface KaspaBalance {
  address: string;
  balance: number;
}
