export const EXPLORER_URLS: Record<string, string> = {
  bittensor: "https://taostats.io/extrinsic/",
  polkadot: "https://polkadot.subscan.io/extrinsic/",
  kusama: "https://kusama.subscan.io/extrinsic/",
  osmosis: "https://www.mintscan.io/osmosis/tx/",
  injective: "https://explorer.injective.network/transaction/",
  ronin: "https://app.roninchain.com/tx/",
  dydx: "https://www.mintscan.io/dydx/tx/",
  extended: "",
  canton: "https://scan.canton.network/tx/",
  hedera: "https://hashscan.io/mainnet/transaction/",
  xrpl: "https://xrpscan.com/tx/",
  kava: "https://www.mintscan.io/kava/tx/",
  stellar: "https://stellar.expert/explorer/public/tx/",
};

export function getExplorerUrl(chainId: string, txHash: string): string | null {
  const base = EXPLORER_URLS[chainId];
  if (!base || !txHash) return null;
  return `${base}${txHash}`;
}
