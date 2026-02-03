// Kava Chain API Types

// Kava uses ukava (1 KAVA = 1,000,000 ukava)
export const KAVA_DECIMALS = 6;
export const UKAVA_PER_KAVA = 1_000_000;

// Public API endpoints (Archive - full history)
export const KAVA_REST_API = "https://api.data.kava.io";
export const KAVA_RPC_API = "https://rpc.data.kava.io";
export const KAVA_EVM_RPC = "https://evm.data.kava.io";

// Kava EVM Chain ID
export const KAVA_CHAIN_ID = 2222;

// Kava native tokens (Cosmos SDK side)
export const KAVA_TOKENS: Record<string, { symbol: string; decimals: number; coingeckoId: string }> = {
  ukava: { symbol: "KAVA", decimals: 6, coingeckoId: "kava" },
  hard: { symbol: "HARD", decimals: 6, coingeckoId: "kava-lend" },
  swp: { symbol: "SWP", decimals: 6, coingeckoId: "kava-swap" },
  usdx: { symbol: "USDX", decimals: 6, coingeckoId: "usdx" },
  bkava: { symbol: "bKAVA", decimals: 6, coingeckoId: "kava" },
  erc20: { symbol: "ERC20", decimals: 18, coingeckoId: "" }, // Placeholder for EVM tokens
};

// Known IBC denoms on Kava (hash -> token info)
// These are the most common IBC tokens bridged to Kava
export const IBC_DENOMS: Record<string, { symbol: string; decimals: number; coingeckoId: string }> = {
  // ATOM from Cosmos Hub
  "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2": {
    symbol: "ATOM",
    decimals: 6,
    coingeckoId: "cosmos",
  },
  // OSMO from Osmosis
  "ibc/47BD209179859CDE4A2806763D7189B6E6FE13A17880FE2B42DE1E6C1E329E23": {
    symbol: "OSMO",
    decimals: 6,
    coingeckoId: "osmosis",
  },
  // AKT from Akash
  "ibc/799FDD409719A1122586A629AE8FCA17380351A51C1F47A80A1B8E7F2A491098": {
    symbol: "AKT",
    decimals: 6,
    coingeckoId: "akash-network",
  },
  // LUNA from Terra
  "ibc/11F940BCDFD7CFBFD7EDA13F25DA95D308286D441209D780C9863FD4271514EB": {
    symbol: "LUNA",
    decimals: 6,
    coingeckoId: "terra-luna-2",
  },
  // UST (legacy)
  "ibc/B448C0CA358B958301D328CCDC5D5AD642FC30A6D3AE106FF721DB315F3DDE5C": {
    symbol: "UST",
    decimals: 6,
    coingeckoId: "terrausd",
  },
  // USDC from Noble
  "ibc/F2331645B9683116188EF36FC04A809C28BD36B54555E8705A37146D0182F045": {
    symbol: "USDC",
    decimals: 6,
    coingeckoId: "usd-coin",
  },
};

// Known ERC-20 tokens on Kava EVM
export const EVM_TOKENS: Record<string, { symbol: string; decimals: number; coingeckoId: string }> = {
  // Wrapped KAVA
  "0xc86c7C0eFbd6A49B35E8714C5f59D99De09A225b": {
    symbol: "WKAVA",
    decimals: 18,
    coingeckoId: "kava",
  },
  // USDC on Kava
  "0xfA9343C3897324496A05fC75abeD6bAC29f8A40f": {
    symbol: "USDC",
    decimals: 6,
    coingeckoId: "usd-coin",
  },
  // USDT on Kava
  "0xB44a9B6905aF7c801311e8F4E76932ee959c663C": {
    symbol: "USDT",
    decimals: 6,
    coingeckoId: "tether",
  },
  // DAI on Kava
  "0x765277EebeCA2e31912C9946eAe1021199B39C61": {
    symbol: "DAI",
    decimals: 18,
    coingeckoId: "dai",
  },
  // WETH on Kava
  "0xE3F5a90F9cb311505cd691a46596599aA1A0AD7D": {
    symbol: "WETH",
    decimals: 18,
    coingeckoId: "ethereum",
  },
  // WBTC on Kava
  "0x818ec0A7Fe18Ff94269904fCED6AE3DaE6d6dC0b": {
    symbol: "WBTC",
    decimals: 8,
    coingeckoId: "wrapped-bitcoin",
  },
};

// EVM Transaction types
export interface EVMTransaction {
  hash: string;
  blockNumber: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  input: string;
  isError: string;
  contractAddress: string;
  methodId: string;
}

// EVM Token Transfer (ERC-20)
export interface EVMTokenTransfer {
  hash: string;
  blockNumber: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  contractAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
}

// EVM Internal Transaction
export interface EVMInternalTransaction {
  hash: string;
  blockNumber: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  contractAddress: string;
  type: string;
  gas: string;
  gasUsed: string;
  isError: string;
}

// Kava module message types
export type KavaMessageType =
  // Bank (transfers)
  | "/cosmos.bank.v1beta1.MsgSend"
  | "/cosmos.bank.v1beta1.MsgMultiSend"
  // Staking
  | "/cosmos.staking.v1beta1.MsgDelegate"
  | "/cosmos.staking.v1beta1.MsgUndelegate"
  | "/cosmos.staking.v1beta1.MsgBeginRedelegate"
  // Distribution (rewards)
  | "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward"
  | "/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission"
  // IBC
  | "/ibc.applications.transfer.v1.MsgTransfer"
  // CDP Module
  | "/kava.cdp.v1beta1.MsgCreateCDP"
  | "/kava.cdp.v1beta1.MsgDeposit"
  | "/kava.cdp.v1beta1.MsgWithdraw"
  | "/kava.cdp.v1beta1.MsgDrawDebt"
  | "/kava.cdp.v1beta1.MsgRepayDebt"
  | "/kava.cdp.v1beta1.MsgLiquidate"
  // Hard Module (Lending)
  | "/kava.hard.v1beta1.MsgDeposit"
  | "/kava.hard.v1beta1.MsgWithdraw"
  | "/kava.hard.v1beta1.MsgBorrow"
  | "/kava.hard.v1beta1.MsgRepay"
  | "/kava.hard.v1beta1.MsgLiquidate"
  // Swap Module (DEX)
  | "/kava.swap.v1beta1.MsgDeposit"
  | "/kava.swap.v1beta1.MsgWithdraw"
  | "/kava.swap.v1beta1.MsgSwapExactForTokens"
  | "/kava.swap.v1beta1.MsgSwapForExactTokens"
  // Incentive Module (Rewards)
  | "/kava.incentive.v1beta1.MsgClaimUSDXMintingReward"
  | "/kava.incentive.v1beta1.MsgClaimHardReward"
  | "/kava.incentive.v1beta1.MsgClaimDelegatorReward"
  | "/kava.incentive.v1beta1.MsgClaimSwapReward"
  | "/kava.incentive.v1beta1.MsgClaimSavingsReward"
  | "/kava.incentive.v1beta1.MsgClaimEarnReward"
  // Earn Module
  | "/kava.earn.v1beta1.MsgDeposit"
  | "/kava.earn.v1beta1.MsgWithdraw"
  // Liquid Module
  | "/kava.liquid.v1beta1.MsgMintDerivative"
  | "/kava.liquid.v1beta1.MsgBurnDerivative"
  // EVM Bridge
  | "/kava.evmutil.v1beta1.MsgConvertCoinToERC20"
  | "/kava.evmutil.v1beta1.MsgConvertERC20ToCoin"
  // BEP3 (Atomic Swaps)
  | "/kava.bep3.v1beta1.MsgCreateAtomicSwap"
  | "/kava.bep3.v1beta1.MsgClaimAtomicSwap"
  | "/kava.bep3.v1beta1.MsgRefundAtomicSwap"
  // Auction
  | "/kava.auction.v1beta1.MsgPlaceBid";

// Cosmos SDK coin type
export interface CosmosCoin {
  denom: string;
  amount: string;
}

// Transaction message structure
export interface KavaMessage {
  "@type": KavaMessageType | string;
  // Bank
  from_address?: string;
  to_address?: string;
  amount?: CosmosCoin[];
  // Staking
  delegator_address?: string;
  validator_address?: string;
  validator_src_address?: string;
  validator_dst_address?: string;
  // CDP
  sender?: string;
  owner?: string;
  depositor?: string;
  collateral?: CosmosCoin;
  principal?: CosmosCoin;
  collateral_type?: string;
  payment?: CosmosCoin;
  // Hard
  borrower?: string;
  coins?: CosmosCoin[];
  // Swap
  exact_token_a?: CosmosCoin;
  token_b?: CosmosCoin;
  token_a?: CosmosCoin;
  exact_token_b?: CosmosCoin;
  slippage?: string;
  deadline?: string;
  shares_in?: string;
  shares_out?: string;
  // IBC
  source_port?: string;
  source_channel?: string;
  token?: CosmosCoin;
  receiver?: string;
  timeout_height?: { revision_number: string; revision_height: string };
  timeout_timestamp?: string;
  // Incentive
  denoms_to_claim?: Array<{ denom: string; multiplier_name: string }>;
  // Earn/Liquid
  vault_denom?: string;
  validator?: string;
  // BEP3
  random_number_hash?: string;
  swap_id?: string;
}

// Transaction fee structure
export interface KavaTxFee {
  amount: CosmosCoin[];
  gas: string;
}

// Transaction auth info
export interface KavaTxAuthInfo {
  fee: KavaTxFee;
  signer_infos: Array<{
    public_key: { "@type": string; key: string };
    mode_info: unknown;
    sequence: string;
  }>;
}

// Transaction body
export interface KavaTxBody {
  messages: KavaMessage[];
  memo: string;
  timeout_height: string;
  extension_options: unknown[];
  non_critical_extension_options: unknown[];
}

// Full transaction structure
export interface KavaTransaction {
  body: KavaTxBody;
  auth_info: KavaTxAuthInfo;
  signatures: string[];
}

// Transaction response wrapper
export interface KavaTxResponse {
  height: string;
  txhash: string;
  codespace: string;
  code: number;
  data: string;
  raw_log: string;
  logs: Array<{
    msg_index: number;
    log: string;
    events: Array<{
      type: string;
      attributes: Array<{ key: string; value: string }>;
    }>;
  }>;
  info: string;
  gas_wanted: string;
  gas_used: string;
  tx: KavaTransaction;
  timestamp: string;
  events: Array<{
    type: string;
    attributes: Array<{ key: string; value: string; index?: boolean }>;
  }>;
}

// Search transactions response
export interface KavaTxSearchResponse {
  txs: Array<{
    tx: KavaTransaction;
    tx_response: KavaTxResponse;
  }>;
  tx_responses: KavaTxResponse[];
  pagination: {
    next_key: string | null;
    total: string;
  };
}

// Account info response
export interface KavaAccountResponse {
  account: {
    "@type": string;
    address: string;
    pub_key: { "@type": string; key: string } | null;
    account_number: string;
    sequence: string;
  };
}

// Message type descriptions
export const KAVA_MSG_DESCRIPTIONS: Record<string, string> = {
  "/cosmos.bank.v1beta1.MsgSend": "Token transfer",
  "/cosmos.bank.v1beta1.MsgMultiSend": "Multi-send transfer",
  "/cosmos.staking.v1beta1.MsgDelegate": "Stake KAVA",
  "/cosmos.staking.v1beta1.MsgUndelegate": "Unstake KAVA",
  "/cosmos.staking.v1beta1.MsgBeginRedelegate": "Redelegate stake",
  "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward": "Claim staking rewards",
  "/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission": "Withdraw validator commission",
  "/ibc.applications.transfer.v1.MsgTransfer": "IBC transfer",
  "/kava.cdp.v1beta1.MsgCreateCDP": "Create CDP",
  "/kava.cdp.v1beta1.MsgDeposit": "Deposit to CDP",
  "/kava.cdp.v1beta1.MsgWithdraw": "Withdraw from CDP",
  "/kava.cdp.v1beta1.MsgDrawDebt": "Draw USDX debt",
  "/kava.cdp.v1beta1.MsgRepayDebt": "Repay USDX debt",
  "/kava.cdp.v1beta1.MsgLiquidate": "Liquidate CDP",
  "/kava.hard.v1beta1.MsgDeposit": "Deposit to Hard",
  "/kava.hard.v1beta1.MsgWithdraw": "Withdraw from Hard",
  "/kava.hard.v1beta1.MsgBorrow": "Borrow from Hard",
  "/kava.hard.v1beta1.MsgRepay": "Repay Hard loan",
  "/kava.hard.v1beta1.MsgLiquidate": "Liquidate Hard position",
  "/kava.swap.v1beta1.MsgDeposit": "Add liquidity",
  "/kava.swap.v1beta1.MsgWithdraw": "Remove liquidity",
  "/kava.swap.v1beta1.MsgSwapExactForTokens": "Swap tokens",
  "/kava.swap.v1beta1.MsgSwapForExactTokens": "Swap tokens",
  "/kava.incentive.v1beta1.MsgClaimUSDXMintingReward": "Claim USDX minting rewards",
  "/kava.incentive.v1beta1.MsgClaimHardReward": "Claim Hard rewards",
  "/kava.incentive.v1beta1.MsgClaimDelegatorReward": "Claim delegator rewards",
  "/kava.incentive.v1beta1.MsgClaimSwapReward": "Claim swap rewards",
  "/kava.incentive.v1beta1.MsgClaimSavingsReward": "Claim savings rewards",
  "/kava.incentive.v1beta1.MsgClaimEarnReward": "Claim earn rewards",
  "/kava.earn.v1beta1.MsgDeposit": "Deposit to Earn",
  "/kava.earn.v1beta1.MsgWithdraw": "Withdraw from Earn",
  "/kava.liquid.v1beta1.MsgMintDerivative": "Mint bKAVA",
  "/kava.liquid.v1beta1.MsgBurnDerivative": "Burn bKAVA",
  "/kava.evmutil.v1beta1.MsgConvertCoinToERC20": "Bridge to EVM",
  "/kava.evmutil.v1beta1.MsgConvertERC20ToCoin": "Bridge from EVM",
  "/kava.bep3.v1beta1.MsgCreateAtomicSwap": "Create atomic swap",
  "/kava.bep3.v1beta1.MsgClaimAtomicSwap": "Claim atomic swap",
  "/kava.bep3.v1beta1.MsgRefundAtomicSwap": "Refund atomic swap",
  "/kava.auction.v1beta1.MsgPlaceBid": "Place auction bid",
};
