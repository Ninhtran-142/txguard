import { createPublicClient, http } from 'viem';
import type {
  ChainConfig,
  RpcTestResult,
  HexAddress,
} from '../../shared/types';

// Create a viem public client for read-only RPC calls.
// Security note: This client is used ONLY for read-only operations
// (eth_chainId, eth_blockNumber, eth_getCode, eth_call, token metadata).
// It must never be used to sign or send transactions.
export function createRpcClient(config: ChainConfig) {
  return createPublicClient({
    transport: http(config.rpcUrl),
  });
}

// Detect whether an error/response indicates the public RPC is rate-limiting
// us. Public endpoints (e.g. Cloudflare Ethereum gateway, publicnode) return
// 429 status or a plain-text rate-limit message instead of a JSON-RPC payload.
// We surface this to the user so they can import their own RPC in Settings.
function isRateLimited(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  return (
    lower.includes('rate limit') ||
    lower.includes('rate-limit') ||
    lower.includes('rate limiting') ||
    lower.includes('429') ||
    lower.includes('too many requests') ||
    lower.includes('throttl')
  );
}

// Validate an RPC endpoint by calling eth_chainId and eth_blockNumber.
// Detects chain ID mismatch, unreachable endpoints, and rate-limiting.
export async function validateRpc(config: ChainConfig): Promise<RpcTestResult> {
  const start = Date.now();
  try {
    const client = createRpcClient(config);
    const [chainId, blockNumber] = await Promise.all([
      client.getChainId(),
      client.getBlockNumber(),
    ]);
    const latencyMs = Date.now() - start;
    if (chainId !== config.chainId) {
      return {
        success: false,
        chainId,
        latencyMs,
        error: `Chain ID mismatch: RPC returned ${chainId}, expected ${config.chainId}`,
      };
    }
    return { success: true, chainId, blockNumber, latencyMs };
  } catch (err) {
    const rateLimited = isRateLimited(err);
    return {
      success: false,
      latencyMs: Date.now() - start,
      error: rateLimited
        ? 'This public RPC is rate-limiting requests. Import your own RPC in Settings for reliable access.'
        : err instanceof Error
          ? err.message
          : 'Unknown RPC error',
      rateLimited,
    };
  }
}

// Read-only helper: eth_getCode
export async function getCode(config: ChainConfig, address: HexAddress) {
  const client = createRpcClient(config);
  return client.getCode({ address });
}

// Read-only helper: eth_chainId
export async function getChainId(config: ChainConfig): Promise<number> {
  const client = createRpcClient(config);
  return client.getChainId();
}

// Read-only helper: eth_blockNumber
export async function getBlockNumber(config: ChainConfig): Promise<bigint> {
  const client = createRpcClient(config);
  return client.getBlockNumber();
}
