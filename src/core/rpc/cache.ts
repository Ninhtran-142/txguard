import type { TokenMetadata } from '../../shared/types';

// In-memory token metadata cache.
//
// Avoids repeated read-only RPC calls for the same token within a session.
// Cache key: `${chainId}:${tokenAddress.toLowerCase()}`.
// TTL is optional for MVP — entries persist for the service worker lifetime.

const cache = new Map<string, TokenMetadata>();

export function makeCacheKey(chainId: number, tokenAddress: string): string {
  return `${chainId}:${tokenAddress.toLowerCase()}`;
}

export function getCached(
  chainId: number,
  tokenAddress: string,
): TokenMetadata | undefined {
  return cache.get(makeCacheKey(chainId, tokenAddress));
}

export function setCached(
  chainId: number,
  tokenAddress: string,
  metadata: TokenMetadata,
): void {
  cache.set(makeCacheKey(chainId, tokenAddress), metadata);
}

export function clearCache(): void {
  cache.clear();
}

export function cacheSize(): number {
  return cache.size;
}
