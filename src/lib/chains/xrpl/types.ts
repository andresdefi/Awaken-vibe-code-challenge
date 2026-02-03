// XRPL (XRP Ledger) API Types

// Public XRPL servers - s2 has full history
export const XRPL_MAINNET_SERVER = "https://s2.ripple.com:51234";
export const XRPL_WEBSOCKET_SERVER = "wss://s2.ripple.com";

// XRP uses drops (1 XRP = 1,000,000 drops)
export const XRP_DECIMALS = 6;
export const DROPS_PER_XRP = 1_000_000;

// XRPL Transaction Types
export type XRPLTransactionType =
  // Payments
  | "Payment"
  // DEX
  | "OfferCreate"
  | "OfferCancel"
  // Trust Lines
  | "TrustSet"
  // NFTs
  | "NFTokenMint"
  | "NFTokenBurn"
  | "NFTokenCreateOffer"
  | "NFTokenCancelOffer"
  | "NFTokenAcceptOffer"
  // AMM
  | "AMMCreate"
  | "AMMDeposit"
  | "AMMWithdraw"
  | "AMMVote"
  | "AMMBid"
  | "AMMDelete"
  // Escrow
  | "EscrowCreate"
  | "EscrowFinish"
  | "EscrowCancel"
  // Payment Channels
  | "PaymentChannelCreate"
  | "PaymentChannelFund"
  | "PaymentChannelClaim"
  // Checks
  | "CheckCreate"
  | "CheckCash"
  | "CheckCancel"
  // Account
  | "AccountSet"
  | "AccountDelete"
  | "SetRegularKey"
  | "SignerListSet"
  | "DepositPreauth"
  // Clawback
  | "Clawback";

// Amount can be XRP (string in drops) or issued currency
export interface XRPLAmount {
  currency: string;
  issuer?: string;
  value: string;
}

export type XRPLAmountValue = string | XRPLAmount;

// Delivered amount in Payment transactions
export interface XRPLDeliveredAmount {
  currency: string;
  issuer?: string;
  value: string;
}

// NFToken-related types
export interface XRPLNFToken {
  nftoken_id: string;
  uri?: string;
}

// Transaction metadata
export interface XRPLTransactionMeta {
  TransactionResult: string;
  delivered_amount?: XRPLAmountValue;
  AffectedNodes?: Array<{
    CreatedNode?: {
      LedgerEntryType: string;
      NewFields: Record<string, unknown>;
    };
    ModifiedNode?: {
      LedgerEntryType: string;
      FinalFields?: Record<string, unknown>;
      PreviousFields?: Record<string, unknown>;
    };
    DeletedNode?: {
      LedgerEntryType: string;
      FinalFields: Record<string, unknown>;
    };
  }>;
}

// Base transaction structure from account_tx
export interface XRPLTransaction {
  Account: string;
  TransactionType: XRPLTransactionType;
  Fee: string; // In drops
  Sequence: number;
  SigningPubKey: string;
  TxnSignature: string;
  hash: string;
  ledger_index: number;
  date: number; // Ripple epoch (seconds since Jan 1, 2000)

  // Payment specific
  Destination?: string;
  Amount?: XRPLAmountValue;
  SendMax?: XRPLAmountValue;
  DeliverMin?: XRPLAmountValue;
  DestinationTag?: number;

  // DEX specific
  TakerGets?: XRPLAmountValue;
  TakerPays?: XRPLAmountValue;
  OfferSequence?: number;

  // Trust line specific
  LimitAmount?: XRPLAmount;

  // NFT specific
  NFTokenID?: string;
  NFTokenOffers?: string[];
  NFTokenSellOffer?: string;
  NFTokenBuyOffer?: string;
  NFTokenBrokerFee?: XRPLAmountValue;

  // AMM specific
  Asset?: XRPLAmount;
  Asset2?: XRPLAmount;
  Amount2?: XRPLAmountValue;
  LPTokenOut?: XRPLAmount;
  LPTokenIn?: XRPLAmount;

  // Escrow specific
  Owner?: string;
  FinishAfter?: number;
  CancelAfter?: number;
  Condition?: string;

  // Payment Channel specific
  PublicKey?: string;
  SettleDelay?: number;
  Channel?: string;
  Balance?: string;

  // Check specific
  InvoiceID?: string;
  CheckID?: string;

  // Clawback
  // Uses Amount field

  // Memos
  Memos?: Array<{
    Memo: {
      MemoData?: string;
      MemoType?: string;
    };
  }>;

  // Metadata
  meta?: XRPLTransactionMeta;
  metaData?: XRPLTransactionMeta;
}

// account_tx response
export interface XRPLAccountTxResponse {
  result: {
    account: string;
    ledger_index_max: number;
    ledger_index_min: number;
    limit: number;
    marker?: {
      ledger: number;
      seq: number;
    };
    transactions: Array<{
      meta: XRPLTransactionMeta;
      tx: XRPLTransaction;
      validated: boolean;
    }>;
    validated: boolean;
    status: string;
  };
}

// account_info response for validation
export interface XRPLAccountInfoResponse {
  result: {
    account_data?: {
      Account: string;
      Balance: string;
      Flags: number;
      LedgerEntryType: string;
      OwnerCount: number;
      Sequence: number;
    };
    status: string;
    error?: string;
    error_message?: string;
  };
}

// Token info from trust lines
export interface XRPLTokenInfo {
  currency: string;
  issuer: string;
  balance: string;
  limit: string;
}

// account_lines response
export interface XRPLAccountLinesResponse {
  result: {
    account: string;
    lines: XRPLTokenInfo[];
    status: string;
    marker?: unknown;
  };
}

// Transaction type to description mapping
export const XRPL_TX_DESCRIPTIONS: Record<XRPLTransactionType, string> = {
  Payment: "XRP or token transfer",
  OfferCreate: "DEX order created",
  OfferCancel: "DEX order cancelled",
  TrustSet: "Trust line modified",
  NFTokenMint: "NFT minted",
  NFTokenBurn: "NFT burned",
  NFTokenCreateOffer: "NFT offer created",
  NFTokenCancelOffer: "NFT offer cancelled",
  NFTokenAcceptOffer: "NFT trade",
  AMMCreate: "AMM pool created",
  AMMDeposit: "AMM liquidity added",
  AMMWithdraw: "AMM liquidity removed",
  AMMVote: "AMM fee vote",
  AMMBid: "AMM auction bid",
  AMMDelete: "AMM pool deleted",
  EscrowCreate: "Escrow created",
  EscrowFinish: "Escrow released",
  EscrowCancel: "Escrow cancelled",
  PaymentChannelCreate: "Payment channel opened",
  PaymentChannelFund: "Payment channel funded",
  PaymentChannelClaim: "Payment channel claimed",
  CheckCreate: "Check created",
  CheckCash: "Check cashed",
  CheckCancel: "Check cancelled",
  AccountSet: "Account settings modified",
  AccountDelete: "Account deleted",
  SetRegularKey: "Regular key set",
  SignerListSet: "Signer list set",
  DepositPreauth: "Deposit preauthorized",
  Clawback: "Tokens clawed back",
};
