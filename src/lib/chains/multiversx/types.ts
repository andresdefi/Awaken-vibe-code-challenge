// MultiversX API response types

export interface MultiversXTransaction {
  txHash: string;
  gasLimit: number;
  gasPrice: number;
  gasUsed: number;
  miniBlockHash: string;
  nonce: number;
  receiver: string;
  receiverShard: number;
  sender: string;
  senderShard: number;
  signature: string;
  status: "success" | "pending" | "invalid" | "fail";
  value: string; // In smallest units (10^18)
  fee: string;
  timestamp: number;
  data?: string; // Base64 encoded
  function?: string; // Smart contract function name
  action?: {
    category: string;
    name: string;
    description?: string;
    arguments?: Record<string, unknown>;
  };
  type?: string;
  originalTxHash?: string;
  // Token transfer fields
  tokenIdentifier?: string;
  tokenValue?: string;
}

export interface MultiversXTransfer {
  txHash: string;
  type: string; // "Transaction", "SmartContractResult"
  sender: string;
  receiver: string;
  value: string;
  fee?: string;
  timestamp: number;
  status: string;
  function?: string;
  action?: {
    category: string;
    name: string;
    description?: string;
    arguments?: Record<string, unknown>;
  };
  // Token info for ESDT transfers
  token?: string;
  tokenIdentifier?: string;
  tokenValue?: string;
  originalTxHash?: string;
  senderShard?: number;
  receiverShard?: number;
}

export interface MultiversXStake {
  totalStaked: string;
  unstakedTokens?: {
    amount: string;
    expires?: number;
    epochs?: number;
  }[];
}

export interface MultiversXDelegation {
  address: string; // Staking provider address
  contract: string;
  userUnBondable: string;
  userActiveStake: string;
  claimableRewards: string;
  userUndelegatedList?: {
    amount: string;
    seconds: number;
  }[];
}

export interface MultiversXEconomics {
  totalSupply: number;
  circulatingSupply: number;
  staked: number;
  price: number;
  marketCap: number;
  apr: number;
  topUpApr: number;
  baseApr: number;
}

export interface MultiversXAccount {
  address: string;
  balance: string;
  nonce: number;
  shard: number;
  txCount?: number;
  scrCount?: number;
  username?: string;
}
