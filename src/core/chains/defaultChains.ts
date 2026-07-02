// Default EVM chain TEMPLATES shipped with TxGuard.
//
// These are metadata (name, explorer URL, native currency) plus an OPTIONAL
// `publicRpcUrl` the user can try with one click. TxGuard NEVER auto-uses a
// public RPC: a template is only used for RPC enrichment after the user
// explicitly adds it in Settings (turning it into a user-configured
// ChainConfig via `templateToPreset` + Save). This keeps TxGuard local-first
// and avoids silently routing wallet-derived addresses through third-party
// public endpoints.
//
// SPEC §21: include default chain templates; for MVP it is acceptable to let
// the user paste an RPC URL manually. We go one step further and offer a
// known-good public endpoint they can opt into.

import type { ChainConfig } from '../../shared/types';

/** Chain metadata template with an optional try-it public RPC. */
export interface ChainTemplate {
  chainId: number;
  name: string;
  explorerUrl?: string;
  nativeCurrencySymbol: string;
  nativeCurrencyDecimals: number;
  /**
   * Optional public read-only RPC endpoint a user can try with one click.
   * Public endpoints are shared and may rate-limit; TxGuard surfaces a clear
   * "rate limited" status when that happens so the user can switch to their
   * own RPC. Never used automatically — only after the user saves the chain.
   */
  publicRpcUrl?: string;
}

/**
 * Recognised EVM chain templates with optional public RPC endpoints.
 *
 * RPC endpoints verified working as of implementation (2026-07):
 *   - ethereum-rpc.publicnode.com    -> chainId 0x1
 *   - bsc-dataseed.binance.org       -> chainId 0x38
 *   - mainnet.base.org               -> chainId 0x2105
 *   - arb1.arbitrum.io/rpc           -> chainId 0xa4b1
 *   - polygon-bor-rpc.publicnode.com -> chainId 0x89
 */
export const DEFAULT_CHAINS: ChainTemplate[] = [
  {
    chainId: 1,
    name: 'Ethereum',
    explorerUrl: 'https://etherscan.io',
    nativeCurrencySymbol: 'ETH',
    nativeCurrencyDecimals: 18,
    publicRpcUrl: 'https://ethereum-rpc.publicnode.com',
  },
  {
    chainId: 56,
    name: 'BNB Chain',
    explorerUrl: 'https://bscscan.com',
    nativeCurrencySymbol: 'BNB',
    nativeCurrencyDecimals: 18,
    publicRpcUrl: 'https://bsc-dataseed.binance.org',
  },
  {
    chainId: 8453,
    name: 'Base',
    explorerUrl: 'https://basescan.org',
    nativeCurrencySymbol: 'ETH',
    nativeCurrencyDecimals: 18,
    publicRpcUrl: 'https://mainnet.base.org',
  },
  {
    chainId: 42161,
    name: 'Arbitrum One',
    explorerUrl: 'https://arbiscan.io',
    nativeCurrencySymbol: 'ETH',
    nativeCurrencyDecimals: 18,
    publicRpcUrl: 'https://arb1.arbitrum.io/rpc',
  },
  {
    chainId: 137,
    name: 'Polygon',
    explorerUrl: 'https://polygonscan.com',
    nativeCurrencySymbol: 'MATIC',
    nativeCurrencyDecimals: 18,
    publicRpcUrl: 'https://polygon-bor-rpc.publicnode.com',
  },
];

/**
 * Look up a known chain template by chain ID. Returns metadata only.
 * Used by the popup to show a recognised chain name even when the user has
 * not yet configured an RPC for that chain.
 */
export function getChainTemplate(
  chainId: number,
): ChainTemplate | undefined {
  return DEFAULT_CHAINS.find((c) => c.chainId === chainId);
}

/**
 * Convert a chain template into a ChainConfig preset for the network form.
 * The publicRpcUrl (if any) is placed in the `rpcUrl` field so the user can
 * test and save it. This does NOT add the chain to storage — the user must
 * click "Save Network" in the form, which makes it a user-configured chain.
 */
export function templateToPreset(t: ChainTemplate): ChainConfig {
  return {
    chainId: t.chainId,
    name: t.name,
    rpcUrl: t.publicRpcUrl ?? '',
    explorerUrl: t.explorerUrl,
    nativeCurrencySymbol: t.nativeCurrencySymbol,
    nativeCurrencyDecimals: t.nativeCurrencyDecimals,
  };
}
