import { describe, it, expect, beforeEach, vi } from 'vitest';

// Hoist mock functions so they are available inside the vi.mock factory.
const { mockGetChainId, mockGetBlockNumber, mockReadContract } = vi.hoisted(
  () => ({
    mockGetChainId: vi.fn(),
    mockGetBlockNumber: vi.fn(),
    mockReadContract: vi.fn(),
  }),
);

vi.mock('viem', () => ({
  createPublicClient: vi.fn(() => ({
    getChainId: mockGetChainId,
    getBlockNumber: mockGetBlockNumber,
    getCode: vi.fn(),
    readContract: mockReadContract,
  })),
  http: vi.fn(),
  parseAbi: vi.fn((args: string[]) => args),
}));

import { validateRpc } from '../core/rpc/client';
import { readTokenMetadata } from '../core/rpc/tokenMetadata';
import type { ChainConfig } from '../shared/types';

const sampleConfig: ChainConfig = {
  chainId: 1,
  name: 'Ethereum',
  rpcUrl: 'https://eth.llamarpc.com',
  nativeCurrencySymbol: 'ETH',
  nativeCurrencyDecimals: 18,
};

describe('RPC validation', () => {
  beforeEach(() => {
    mockGetChainId.mockReset();
    mockGetBlockNumber.mockReset();
  });

  it('valid RPC returns success', async () => {
    mockGetChainId.mockResolvedValue(1);
    mockGetBlockNumber.mockResolvedValue(100n);
    const result = await validateRpc(sampleConfig);
    expect(result.success).toBe(true);
    expect(result.chainId).toBe(1);
    expect(result.blockNumber).toBe(100n);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('chain ID mismatch returns error', async () => {
    mockGetChainId.mockResolvedValue(2);
    mockGetBlockNumber.mockResolvedValue(100n);
    const result = await validateRpc(sampleConfig);
    expect(result.success).toBe(false);
    expect(result.error).toContain('mismatch');
  });

  it('unreachable RPC returns error', async () => {
    mockGetChainId.mockRejectedValue(new Error('connection refused'));
    const result = await validateRpc(sampleConfig);
    expect(result.success).toBe(false);
    expect(result.error).toContain('connection refused');
  });
});

describe('Token metadata', () => {
  beforeEach(() => {
    mockReadContract.mockReset();
  });

  it('reads name, symbol, decimals', async () => {
    mockReadContract
      .mockResolvedValueOnce('USD Tether') // name
      .mockResolvedValueOnce('USDT') // symbol
      .mockResolvedValueOnce(6); // decimals
    const metadata = await readTokenMetadata(
      sampleConfig,
      '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
    );
    expect(metadata.name).toBe('USD Tether');
    expect(metadata.symbol).toBe('USDT');
    expect(metadata.decimals).toBe(6);
  });

  it('partial failure returns partial metadata', async () => {
    mockReadContract
      .mockResolvedValueOnce('USD Tether') // name
      .mockRejectedValueOnce(new Error('symbol failed')) // symbol
      .mockResolvedValueOnce(6); // decimals
    const metadata = await readTokenMetadata(
      sampleConfig,
      '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
    );
    expect(metadata.name).toBe('USD Tether');
    expect(metadata.symbol).toBeUndefined();
    expect(metadata.decimals).toBe(6);
  });

  it('all failures returns empty metadata', async () => {
    mockReadContract.mockRejectedValue(new Error('RPC error'));
    const metadata = await readTokenMetadata(
      sampleConfig,
      '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
    );
    expect(metadata.name).toBeUndefined();
    expect(metadata.symbol).toBeUndefined();
    expect(metadata.decimals).toBeUndefined();
  });
});
