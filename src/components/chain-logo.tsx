"use client";

import Image from "next/image";

// Chain logo URLs from official/reliable sources
const CHAIN_LOGOS: Record<string, string> = {
  bittensor: "/logos/bittensor.png", // Local official asset
  kaspa: "https://s2.coinmarketcap.com/static/img/coins/64x64/20396.png",
  polkadot: "https://s2.coinmarketcap.com/static/img/coins/64x64/6636.png",
  kusama: "https://coin-images.coingecko.com/coins/images/9568/small/m4zRhP5e_400x400.jpg",
  osmosis: "https://s2.coinmarketcap.com/static/img/coins/64x64/12220.png",
  injective: "https://s2.coinmarketcap.com/static/img/coins/64x64/7226.png",
  ronin: "https://s2.coinmarketcap.com/static/img/coins/64x64/14101.png",
  extended: "/logos/extended.svg", // Local official asset
  dydx: "https://s2.coinmarketcap.com/static/img/coins/64x64/28324.png",
  canton: "https://www.canton.network/hubfs/canton-logo-black.svg",
  hedera: "https://s2.coinmarketcap.com/static/img/coins/64x64/4642.png",
  xrpl: "https://s2.coinmarketcap.com/static/img/coins/64x64/52.png",
  kava: "https://s2.coinmarketcap.com/static/img/coins/64x64/4846.png",
  stellar: "https://s2.coinmarketcap.com/static/img/coins/64x64/512.png",
  multiversx: "https://s2.coinmarketcap.com/static/img/coins/64x64/6892.png",
  radix: "https://s2.coinmarketcap.com/static/img/coins/64x64/11948.png",
  ergo: "https://s2.coinmarketcap.com/static/img/coins/64x64/1762.png",
  glue: "https://glue.net/wp-content/themes/glue/dist/img/favicon/apple-touch-icon.png",
  gmx: "https://s2.coinmarketcap.com/static/img/coins/64x64/11857.png",
};

// Fallback colors for chains without logos
const CHAIN_COLORS: Record<string, string> = {
  bittensor: "#000000",
  kaspa: "#70C7BA",
  polkadot: "#E6007A",
  kusama: "#000000",
  osmosis: "#5E12A0",
  injective: "#00F2FE",
  ronin: "#1273EA",
  extended: "#EC796B",
  dydx: "#6966FF",
  canton: "#4A90D9",
  hedera: "#000000",
  xrpl: "#23292F",
  kava: "#FF564F",
  stellar: "#000000",
  multiversx: "#23F7DD",
  radix: "#052CC0",
  ergo: "#FF5733",
  glue: "#00D4AA",
  gmx: "#2D42FC",
};

interface ChainLogoProps {
  chainId: string;
  size?: number;
  className?: string;
}

export function ChainLogo({ chainId, size = 32, className = "" }: ChainLogoProps) {
  const logoUrl = CHAIN_LOGOS[chainId];
  const fallbackColor = CHAIN_COLORS[chainId] || "#78716C";

  if (!logoUrl) {
    // Fallback to colored circle with first letter
    return (
      <div
        className={`flex items-center justify-center rounded-full text-white font-semibold ${className}`}
        style={{
          width: size,
          height: size,
          backgroundColor: fallbackColor,
          fontSize: size * 0.4,
        }}
      >
        {chainId.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <Image
      src={logoUrl}
      alt={`${chainId} logo`}
      width={size}
      height={size}
      className={`rounded-full ${className}`}
      unoptimized // External images
    />
  );
}

// Chain names mapping
export const CHAIN_NAMES: Record<string, string> = {
  bittensor: "Bittensor",
  kaspa: "Kaspa",
  polkadot: "Polkadot",
  kusama: "Kusama",
  osmosis: "Osmosis",
  injective: "Injective",
  ronin: "Ronin",
  extended: "Extended",
  dydx: "dYdX",
  canton: "Canton Network",
  hedera: "Hedera",
  xrpl: "XRP Ledger",
  kava: "Kava",
  stellar: "Stellar",
  multiversx: "MultiversX",
  radix: "Radix",
  ergo: "Ergo",
  glue: "Glue Network",
  gmx: "GMX",
};

// Chain symbols mapping
export const CHAIN_SYMBOLS: Record<string, string> = {
  bittensor: "TAO",
  kaspa: "KAS",
  polkadot: "DOT",
  kusama: "KSM",
  osmosis: "OSMO",
  injective: "INJ",
  ronin: "RON",
  extended: "PERPS",
  dydx: "DYDX",
  canton: "CC",
  hedera: "HBAR",
  xrpl: "XRP",
  kava: "KAVA",
  stellar: "XLM",
  multiversx: "EGLD",
  radix: "XRD",
  ergo: "ERG",
  glue: "GLUE",
  gmx: "GMX",
};

// Chain descriptions
export const CHAIN_DESCRIPTIONS: Record<string, string> = {
  bittensor: "Export transfers, staking events, and emission rewards",
  kaspa: "Export KAS transfers and mining rewards",
  polkadot: "Export transfers, staking rewards, and slashing events",
  kusama: "Export transfers, staking, crowdloans, and auction bids",
  osmosis: "Export transfers, swaps, LP positions, and staking rewards",
  injective: "Export transfers, staking, IBC, and trading activity",
  ronin: "Export transfers, swaps, NFT trades, and gaming transactions",
  extended: "Export perpetuals trades, positions, and funding payments",
  dydx: "Export perpetuals trades, positions, and funding payments",
  canton: "Export Canton Coin transfers, rewards, and fees",
  hedera: "Export HBAR transfers, staking rewards, and token transactions",
  xrpl: "Export XRP transfers, DEX trades, NFTs, AMM, and escrow",
  kava: "Export KAVA transfers, staking, CDP, lending, swaps, and rewards",
  stellar: "Export XLM transfers, DEX trades, liquidity pools, and claimable balances",
  multiversx: "Export EGLD transfers, ESDT tokens, staking, and delegation rewards",
  radix: "Export XRD transfers, staking rewards, swaps, and pool operations",
  ergo: "Export ERG transfers, token transactions, and mining rewards",
  glue: "Export GLUE transfers, token transactions, and cross-chain activity",
  gmx: "Export perpetuals trades, positions, and funding payments on Arbitrum",
};
