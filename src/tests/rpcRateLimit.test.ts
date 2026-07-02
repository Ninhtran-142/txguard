import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockGetChainId, mockGetBlockNumber } = vi.hoisted(() => ({
  mockGetChainId: vi.fn(),
  mockGetBlockNumber: vi.fn(),
}));

vi.mock('viem', () => ({
  createPublicClient: vi.fn(() => ({
    getChainId: mockGetChainId,
    getBlockNumber: mockGetBlockNumber,
    getCode: vi.fn(),
    readContract: vi.fn(),
  })),
  http: vi.fn(),
  parseAbi: vi.fn((args: string[]) => args),
}));

import { validateRpc } from '../core/rpc/client';
import type { ChainConfig } from '../shared/types';

const sampleConfig: ChainConfig = {
  chainId: 1,
  name: 'Ethereum',
  rpcUrl: 'https://cloudflare-eth.com',
  nativeCurrencySymbol: 'ETH',
  nativeCurrencyDecimals: 18,
};

describe('RPC rate-limit detection', () => {
  beforeEach(() => {
    mockGetChainId.mockReset();
    mockGetBlockNumber.mockReset();
  });

  it('detects Cloudflare-style rate-limit message', async () => {
    mockGetChainId.mockRejectedValue(
      new Error('Rate limiting threshold exceeded for the public endpoint'),
    );
    const result = await validateRpc(sampleConfig);
    expect(result.success).toBe(false);
    expect(result.rateLimited).toBe(true);
    expect(result.error).toContain('rate-limit');
  });

  it('detects 429 status code', async () => {
    mockGetChainId.mockRejectedValue(new Error('429 Too Many Requests'));
    const result = await validateRpc(sampleConfig);
    expect(result.success).toBe(false);
    expect(result.rateLimited).toBe(true);
  });

  it('non-rate-limit error is not flagged as rateLimited', async () => {
    mockGetChainId.mockRejectedValue(new Error('connection refused'));
    const result = await validateRpc(sampleConfig);
    expect(result.success).toBe(false);
    expect(result.rateLimited).toBe(false);
    expect(result.error).toContain('connection refused');
  });
});
