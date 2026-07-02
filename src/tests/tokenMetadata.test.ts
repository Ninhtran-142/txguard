import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCached,
  setCached,
  clearCache,
  cacheSize,
  makeCacheKey,
} from '../core/rpc/cache';

describe('Metadata cache', () => {
  beforeEach(() => {
    clearCache();
  });

  it('cache hit returns cached value', () => {
    setCached(1, '0xABCDEFabcdef1234567890abcdef1234567890AB', {
      symbol: 'USDT',
      decimals: 6,
    });
    const result = getCached(1, '0xABCDEFabcdef1234567890abcdef1234567890AB');
    expect(result?.symbol).toBe('USDT');
    expect(result?.decimals).toBe(6);
  });

  it('cache miss returns undefined', () => {
    expect(
      getCached(1, '0x1234567890abcdef1234567890abcdef12345678'),
    ).toBeUndefined();
  });

  it('different chainId + address = different cache key', () => {
    const addr = '0x1234567890abcdef1234567890abcdef12345678';
    setCached(1, addr, { symbol: 'ETH' });
    setCached(137, addr, { symbol: 'MATIC' });
    expect(getCached(1, addr)?.symbol).toBe('ETH');
    expect(getCached(137, addr)?.symbol).toBe('MATIC');
  });

  it('cache key is case-insensitive for address', () => {
    setCached(1, '0xABCDEF', { symbol: 'TEST' });
    expect(getCached(1, '0xabcdef')).toBeDefined();
  });

  it('cacheSize reflects number of entries', () => {
    expect(cacheSize()).toBe(0);
    setCached(1, '0xaaaa', { symbol: 'A' });
    setCached(2, '0xbbbb', { symbol: 'B' });
    expect(cacheSize()).toBe(2);
  });

  it('makeCacheKey produces correct format', () => {
    expect(makeCacheKey(1, '0xABC')).toBe('1:0xabc');
  });
});
