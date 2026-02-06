// Ergo Explorer API response types

export interface ErgoToken {
  tokenId: string;
  amount: number;
  decimals?: number;
  name?: string;
  type?: string;
}

export interface ErgoAsset {
  tokenId: string;
  index: number;
  amount: number;
  name?: string;
  decimals?: number;
  type?: string;
}

export interface ErgoInput {
  boxId: string;
  value: number; // nanoERG
  index: number;
  spendingProof?: string;
  outputBlockId?: string;
  outputTransactionId?: string;
  outputIndex?: number;
  ergoTree?: string;
  address?: string;
  assets?: ErgoAsset[];
  additionalRegisters?: Record<string, string>;
}

export interface ErgoOutput {
  boxId: string;
  transactionId: string;
  blockId?: string;
  value: number; // nanoERG
  index: number;
  globalIndex?: number;
  creationHeight: number;
  settlementHeight?: number;
  ergoTree?: string;
  address?: string;
  assets?: ErgoAsset[];
  additionalRegisters?: Record<string, string>;
  spentTransactionId?: string;
  mainChain?: boolean;
}

export interface ErgoTransaction {
  id: string;
  blockId?: string;
  inclusionHeight?: number;
  timestamp: number; // milliseconds
  index?: number;
  globalIndex?: number;
  numConfirmations?: number;
  inputs: ErgoInput[];
  outputs: ErgoOutput[];
  dataInputs?: ErgoInput[];
  size?: number;
}

export interface ErgoTransactionsResponse {
  items: ErgoTransaction[];
  total: number;
}

export interface ErgoBalance {
  nanoErgs: number;
  tokens?: ErgoToken[];
}

export interface ErgoTotalBalance {
  confirmed: ErgoBalance;
  unconfirmed: ErgoBalance;
}

export interface ErgoAddressInfo {
  summary: {
    id: string;
  };
  transactions: {
    confirmed: number;
    totalReceived: number;
    confirmedBalance: number;
    totalBalance: number;
    tokens?: ErgoToken[];
  };
}
