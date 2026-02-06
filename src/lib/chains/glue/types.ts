// Glue Network Explorer API (Blockscout-style) response types

export interface GlueTransaction {
  blockHash: string;
  blockNumber: string;
  confirmations: string;
  contractAddress: string;
  cumulativeGasUsed: string;
  from: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  hash: string;
  input: string;
  isError: string;
  nonce: string;
  timeStamp: string; // Unix timestamp in seconds
  to: string;
  transactionIndex: string;
  txreceipt_status: string;
  value: string; // Value in wei (18 decimals)
}

export interface GlueInternalTransaction {
  blockNumber: string;
  contractAddress: string;
  errCode: string;
  from: string;
  gas: string;
  gasUsed: string;
  hash: string;
  index: string;
  input: string;
  isError: string;
  timeStamp: string;
  to: string;
  type: string;
  value: string;
}

export interface GlueTokenTransfer {
  blockHash: string;
  blockNumber: string;
  confirmations: string;
  contractAddress: string;
  from: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  hash: string;
  input: string;
  logIndex: string;
  nonce: string;
  timeStamp: string;
  to: string;
  tokenDecimal: string;
  tokenName: string;
  tokenSymbol: string;
  transactionIndex: string;
  value: string;
}

export interface GlueApiResponse<T> {
  message: string;
  result: T;
  status: string;
}

export interface GlueBalanceResponse {
  message: string;
  result: string; // Balance in wei
  status: string;
}
