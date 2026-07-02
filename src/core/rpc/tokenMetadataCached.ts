import { readTokenMetadata } from './tokenMetadata';
import { getCached, setCached } from './cache';
import type {
  ChainConfig,
  TokenMetadata,
  HexAddress,
} from '../../shared/types';

// Read token metadata with in-memory caching.
// If cached, returns immediately without an RPC call.
// On RPC failure, still caches the (partial) result to avoid retry storms.
export async function readTokenMetadataCached(
  config: ChainConfig,
  tokenAddress: HexAddress,
): Promise<TokenMetadata> {
  const cached = getCached(config.chainId, tokenAddress);
  if (cached) return cached;

  const metadata = await readTokenMetadata(config, tokenAddress);
  setCached(config.chainId, tokenAddress, metadata);
  return metadata;
}
