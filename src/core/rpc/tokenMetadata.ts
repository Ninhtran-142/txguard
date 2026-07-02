import { parseAbi } from 'viem';
import { createRpcClient } from './client';
import type {
  ChainConfig,
  TokenMetadata,
  HexAddress,
} from '../../shared/types';

// Minimal ERC20 metadata ABI for read-only name/symbol/decimals calls.
const ERC20_METADATA_ABI = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
]);

// Read ERC20 token metadata (name, symbol, decimals) via RPC.
// Uses Promise.allSettled so a partial failure still returns partial data.
// Security note: read-only calls only. Never crashes the analysis flow.
export async function readTokenMetadata(
  config: ChainConfig,
  tokenAddress: HexAddress,
): Promise<TokenMetadata> {
  const client = createRpcClient(config);
  const results = await Promise.allSettled([
    client.readContract({
      abi: ERC20_METADATA_ABI,
      address: tokenAddress,
      functionName: 'name',
    }),
    client.readContract({
      abi: ERC20_METADATA_ABI,
      address: tokenAddress,
      functionName: 'symbol',
    }),
    client.readContract({
      abi: ERC20_METADATA_ABI,
      address: tokenAddress,
      functionName: 'decimals',
    }),
  ]);

  const metadata: TokenMetadata = {};
  if (results[0].status === 'fulfilled') metadata.name = results[0].value;
  if (results[1].status === 'fulfilled') metadata.symbol = results[1].value;
  if (results[2].status === 'fulfilled') {
    metadata.decimals = Number(results[2].value);
  }
  return metadata;
}
