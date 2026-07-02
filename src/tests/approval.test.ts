import { describe, it, expect } from 'vitest';
import {
  isUnlimitedApproval,
  formatAmount,
  UINT256_MAX,
} from '../core/decoder/approval';

describe('isUnlimitedApproval', () => {
  it('uint256.max is unlimited', () => {
    expect(isUnlimitedApproval(UINT256_MAX)).toBe(true);
  });

  it('amount > half max is unlimited', () => {
    expect(isUnlimitedApproval(UINT256_MAX / 2n)).toBe(true);
    expect(isUnlimitedApproval(UINT256_MAX / 2n + 1n)).toBe(true);
  });

  it('normal amount is not unlimited', () => {
    expect(isUnlimitedApproval(1000n)).toBe(false);
    expect(isUnlimitedApproval(10n ** 30n)).toBe(false);
  });

  it('zero is not unlimited', () => {
    expect(isUnlimitedApproval(0n)).toBe(false);
  });
});

describe('formatAmount', () => {
  it('formats 1 token with 6 decimals', () => {
    expect(formatAmount(1000000n, 6)).toBe('1');
  });

  it('formats 1.5 tokens with 6 decimals', () => {
    expect(formatAmount(1500000n, 6)).toBe('1.5');
  });

  it('formats with 18 decimals', () => {
    expect(formatAmount(10n ** 18n, 18)).toBe('1');
    expect(formatAmount(15n * 10n ** 17n, 18)).toBe('1.5');
  });

  it('formats zero', () => {
    expect(formatAmount(0n, 18)).toBe('0');
  });

  it('formats with 0 decimals', () => {
    expect(formatAmount(123n, 0)).toBe('123');
  });
});
