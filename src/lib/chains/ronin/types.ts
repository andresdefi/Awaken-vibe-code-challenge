// Ronin-specific types for Moralis API responses

// Moralis Wallet History Response
export interface MoralisWalletHistoryResponse {
  cursor: string | null;
  page: number;
  page_size: number;
  result: MoralisTransaction[];
}

export interface MoralisTransaction {
  hash: string;
  nonce: string;
  transaction_index: string;
  from_address: string;
  from_address_label?: string;
  from_address_entity?: string;
  from_address_entity_logo?: string;
  to_address: string;
  to_address_label?: string;
  to_address_entity?: string;
  to_address_entity_logo?: string;
  value: string;
  gas: string;
  gas_price: string;
  receipt_gas_used: string;
  receipt_status: string;
  block_timestamp: string;
  block_number: string;
  block_hash: string;
  transaction_fee: string;
  method_label?: string;
  category: MoralisCategory;
  summary: string;
  possible_spam: boolean;
  erc20_transfers: MoralisErc20Transfer[];
  nft_transfers: MoralisNftTransfer[];
  native_transfers: MoralisNativeTransfer[];
}

export type MoralisCategory =
  | "send"
  | "receive"
  | "token send"
  | "token receive"
  | "nft send"
  | "nft receive"
  | "token swap"
  | "deposit"
  | "withdraw"
  | "airdrop"
  | "mint"
  | "burn"
  | "nft purchase"
  | "nft sale"
  | "borrow"
  | "contract interaction"
  | "approve"
  | "revoke";

export interface MoralisErc20Transfer {
  token_name: string;
  token_symbol: string;
  token_logo?: string;
  token_decimals: string;
  from_address: string;
  from_address_label?: string;
  from_address_entity?: string;
  to_address: string;
  to_address_label?: string;
  to_address_entity?: string;
  address: string; // Contract address
  log_index: number;
  value: string;
  value_formatted: string;
  possible_spam: boolean;
  verified_contract: boolean;
  direction: "send" | "receive";
}

export interface MoralisNftTransfer {
  token_address: string;
  token_id: string;
  from_address: string;
  from_address_label?: string;
  to_address: string;
  to_address_label?: string;
  value: string;
  amount: string;
  contract_type: "ERC721" | "ERC1155";
  transaction_type: string;
  log_index: number;
  operator?: string;
  possible_spam: boolean;
  verified_collection: boolean;
  direction: "send" | "receive";
  collection_logo?: string;
  collection_banner_image?: string;
  normalized_metadata?: {
    name?: string;
    description?: string;
    image?: string;
    animation_url?: string;
  };
}

export interface MoralisNativeTransfer {
  from_address: string;
  from_address_label?: string;
  from_address_entity?: string;
  to_address: string;
  to_address_label?: string;
  to_address_entity?: string;
  value: string;
  value_formatted: string;
  direction: "send" | "receive";
  internal_transaction: boolean;
  token_symbol: string;
  token_logo?: string;
}

// Moralis ERC20 Transfers Response
export interface MoralisTokenTransfersResponse {
  cursor: string | null;
  page: number;
  page_size: number;
  result: MoralisTokenTransfer[];
}

export interface MoralisTokenTransfer {
  token_name: string;
  token_symbol: string;
  token_logo?: string;
  token_decimals: string;
  from_address: string;
  from_address_label?: string;
  to_address: string;
  to_address_label?: string;
  address: string; // Contract address
  block_hash: string;
  block_number: string;
  block_timestamp: string;
  transaction_hash: string;
  transaction_index: string;
  log_index: number;
  value: string;
  possible_spam: boolean;
  verified_contract: boolean;
  value_formatted?: string;
}

// Moralis NFT Transfers Response
export interface MoralisNftTransfersResponse {
  cursor: string | null;
  page: number;
  page_size: number;
  result: MoralisNftTransferItem[];
}

export interface MoralisNftTransferItem {
  block_number: string;
  block_timestamp: string;
  block_hash: string;
  transaction_hash: string;
  transaction_index: number;
  log_index: number;
  value: string;
  contract_type: "ERC721" | "ERC1155";
  transaction_type: string;
  token_address: string;
  token_id: string;
  from_address: string;
  from_address_label?: string;
  to_address: string;
  to_address_label?: string;
  amount: string;
  verified: boolean;
  operator?: string;
  possible_spam: boolean;
}

// CoinGecko Price Response
export interface CoinGeckoMarketChartResponse {
  prices: [number, number][]; // [timestamp_ms, price]
  market_caps: [number, number][];
  total_volumes: [number, number][];
}

// Known token contracts on Ronin
export const RONIN_TOKENS: Record<string, { symbol: string; decimals: number; name: string }> = {
  // Native RON is handled separately
  "0x97a9107c1793bc407d6f527b77e7fff4d812bece": { symbol: "AXS", decimals: 18, name: "Axie Infinity Shard" },
  "0xa8754b9fa15fc18bb59458815510e40a12cd2014": { symbol: "SLP", decimals: 0, name: "Smooth Love Potion" },
  "0xc99a6a985ed2cac1ef41640596c5a5f9f4e19ef5": { symbol: "WETH", decimals: 18, name: "Wrapped Ether" },
  "0x0b7007c13325c48911f73a2dad5fa5dcbf808adc": { symbol: "USDC", decimals: 6, name: "USD Coin" },
  "0xe514d9deb7966c8be0ca922de8a064264ea6bcd4": { symbol: "WRON", decimals: 18, name: "Wrapped RON" },
  "0x7eae20d11ef8c779433eb24503def900b9d28ad7": { symbol: "PIXEL", decimals: 18, name: "Pixels" },
};

// Ronin staking contract address
export const RONIN_STAKING_CONTRACT = "0x9C245671791834daf3885533D24dce516B763B28".toLowerCase();

// Katana DEX Router addresses
export const KATANA_ROUTER_V2 = "0x7d0556d55ca1a92708681e2e231733ebd922597d".toLowerCase();
export const KATANA_ROUTER_V3 = "0x6a640b0278c65d8f8e5b3c7b9e3f3c4b5a6d7e8f".toLowerCase(); // Placeholder - verify actual address
