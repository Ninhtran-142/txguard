import type { ChainConfig } from '../../shared/types';

// Default EVM chains shipped with TxGuard, each pre-configured with a verified
// public read-only RPC endpoint. These public endpoints are shared and may
// rate-limit heavy usage — TxGuard surfaces a clear "rate limited" status when
// that happens so the user can import their own RPC in Settings.
//
// TxGuard only uses RPC for read-only calls (eth_chainId, eth_blockNumber,
// eth_getCode, eth_call, token metadata reads) — never for signing.
//
// RPC endpoints verified working as of implementation (2026-07):
//   - ethereum-rpc.publicnode.com    -> chainId 0x1
//   - bsc-dataseed.binance.org       -> chainId 0x38
//   - mainnet.base.org               -> chainId 0x2105
//   - arb1.arbitrum.io/rpc           -> chainId 0xa4b1
//   - polygon-bor-rpc.publicnode.com -> chainId 0x89
export const DEFAULT_CHAINS: ChainConfig[] = [
  {
    chainId: 1,
    name: 'Ethereum',
    rpcUrl: 'https://ethereum-rpc.publicnode.com',
    explorerUrl: 'https://etherscan.io',
    nativeCurrencySymbol: 'ETH',
    nativeCurrencyDecimals: 18,
  },
  {
    chainId: 56,
    name: 'BNB Chain',
    rpcUrl: 'https://bsc-dataseed.binance.org',
    explorerUrl: 'https://bscscan.com',
    nativeCurrencySymbol: 'BNB',
    nativeCurrencyDecimals: 18,
  },
  {
    chainId: 8453,
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    nativeCurrencySymbol: 'ETH',
    nativeCurrencyDecimals: 18,
  },
  {
    chainId: 42161,
    name: 'Arbitrum One',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    nativeCurrencySymbol: 'ETH',
    nativeCurrencyDecimals: 18,
  },
  {
    chainId: 137,
    name: 'Polygon',
    rpcUrl: 'https://polygon-bor-rpc.publicnode.com',
    explorerUrl: 'https://polygonscan.com',
    nativeCurrencySymbol: 'MATIC',
    nativeCurrencyDecimals: 18,
  },
];
