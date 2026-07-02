import { describe, it, expect } from 'vitest';
import { evaluateRisk } from '../core/risk/evaluator';
import { UINT256_MAX } from '../core/decoder/approval';
import type { ChainConfig, DecodedTx, TxGuardSettings } from '../shared/types';

const SETTINGS: TxGuardSettings = {
  enabled: true,
  warnOnUnknownCalls: true,
  warnOnPersonalSign: true,
  blockHighRiskByDefault: false,
};

const SAMPLE_CHAIN: ChainConfig = {
  chainId: 1,
  name: 'Ethereum',
  rpcUrl: 'https://eth.llamarpc.com',
  nativeCurrencySymbol: 'ETH',
  nativeCurrencyDecimals: 18,
};

function makeDecoded(overrides: Partial<DecodedTx>): DecodedTx {
  return {
    isDecoded: true,
    actionType: 'UNKNOWN',
    ...overrides,
  };
}

describe('evaluateRisk', () => {
  // ── HIGH ──────────────────────────────────────────────────────
  it('unlimited ERC20 approval = HIGH', () => {
    const decoded = makeDecoded({
      actionType: 'ERC20_APPROVE',
      spender: '0x1111111111111111111111111111111111111111' as `0x${string}`,
      amount: UINT256_MAX,
      isUnlimited: true,
    });
    const result = evaluateRisk(decoded, SAMPLE_CHAIN, SETTINGS);
    expect(result.riskLevel).toBe('HIGH');
    expect(result.findings.some((f) => f.severity === 'HIGH')).toBe(true);
  });

  it('NFT setApprovalForAll true = HIGH', () => {
    const decoded = makeDecoded({
      actionType: 'NFT_SET_APPROVAL_FOR_ALL',
      spender: '0xcccccccccccccccccccccccccccccccccccccccc' as `0x${string}`,
      approved: true,
    });
    const result = evaluateRisk(decoded, SAMPLE_CHAIN, SETTINGS);
    expect(result.riskLevel).toBe('HIGH');
  });

  it('very large increaseAllowance = HIGH', () => {
    const decoded = makeDecoded({
      actionType: 'ERC20_INCREASE_ALLOWANCE',
      spender: '0x1111111111111111111111111111111111111111' as `0x${string}`,
      amount: 10n ** 35n,
      isUnlimited: false,
    });
    const result = evaluateRisk(decoded, SAMPLE_CHAIN, SETTINGS);
    expect(result.riskLevel).toBe('HIGH');
  });

  it('unknown call with warnOnUnknownCalls = HIGH', () => {
    const decoded = makeDecoded({
      isDecoded: false,
      actionType: 'UNKNOWN_CONTRACT_CALL',
      to: '0x2222222222222222222222222222222222222222' as `0x${string}`,
    });
    const result = evaluateRisk(decoded, SAMPLE_CHAIN, SETTINGS);
    expect(result.riskLevel).toBe('HIGH');
  });

  // ── MEDIUM ────────────────────────────────────────────────────
  it('finite ERC20 approval = MEDIUM', () => {
    const decoded = makeDecoded({
      actionType: 'ERC20_APPROVE',
      spender: '0x1111111111111111111111111111111111111111' as `0x${string}`,
      amount: 1000n,
      isUnlimited: false,
    });
    const result = evaluateRisk(decoded, SAMPLE_CHAIN, SETTINGS);
    expect(result.riskLevel).toBe('MEDIUM');
  });

  it('chain switch = MEDIUM', () => {
    const decoded = makeDecoded({
      actionType: 'CHAIN_SWITCH',
    });
    const result = evaluateRisk(decoded, SAMPLE_CHAIN, SETTINGS);
    expect(result.riskLevel).toBe('MEDIUM');
  });

  it('missing RPC adds finding + MEDIUM', () => {
    const decoded = makeDecoded({
      actionType: 'NATIVE_TRANSFER',
      to: '0x2222222222222222222222222222222222222222' as `0x${string}`,
      value: 1000n,
    });
    const result = evaluateRisk(decoded, undefined, SETTINGS);
    // Native transfer is LOW, but missing RPC adds MEDIUM → overall MEDIUM
    expect(result.riskLevel).toBe('MEDIUM');
    expect(result.findings.some((f) => f.title === 'RPC not configured')).toBe(
      true,
    );
  });

  // ── LOW ───────────────────────────────────────────────────────
  it('simple native transfer = LOW', () => {
    const decoded = makeDecoded({
      actionType: 'NATIVE_TRANSFER',
      to: '0x2222222222222222222222222222222222222222' as `0x${string}`,
      value: 1000n,
    });
    const result = evaluateRisk(decoded, SAMPLE_CHAIN, SETTINGS);
    expect(result.riskLevel).toBe('LOW');
  });

  it('setApprovalForAll false = LOW', () => {
    const decoded = makeDecoded({
      actionType: 'NFT_SET_APPROVAL_FOR_ALL',
      spender: '0xcccccccccccccccccccccccccccccccccccccccc' as `0x${string}`,
      approved: false,
    });
    const result = evaluateRisk(decoded, SAMPLE_CHAIN, SETTINGS);
    expect(result.riskLevel).toBe('LOW');
  });

  it('approval amount zero = LOW', () => {
    const decoded = makeDecoded({
      actionType: 'ERC20_APPROVE',
      spender: '0x1111111111111111111111111111111111111111' as `0x${string}`,
      amount: 0n,
      isUnlimited: false,
    });
    const result = evaluateRisk(decoded, SAMPLE_CHAIN, SETTINGS);
    expect(result.riskLevel).toBe('LOW');
  });

  it('decreaseAllowance = LOW', () => {
    const decoded = makeDecoded({
      actionType: 'ERC20_DECREASE_ALLOWANCE',
      spender: '0x1111111111111111111111111111111111111111' as `0x${string}`,
      amount: 500n,
    });
    const result = evaluateRisk(decoded, SAMPLE_CHAIN, SETTINGS);
    expect(result.riskLevel).toBe('LOW');
  });

  // ── UNKNOWN ───────────────────────────────────────────────────
  it('unknown calldata with warnOnUnknownCalls disabled = UNKNOWN', () => {
    const decoded = makeDecoded({
      isDecoded: false,
      actionType: 'UNKNOWN_CONTRACT_CALL',
      to: '0x2222222222222222222222222222222222222222' as `0x${string}`,
    });
    const settingsNoWarn = { ...SETTINGS, warnOnUnknownCalls: false };
    // Pass SAMPLE_CHAIN so the missing-RPC rule does not add a MEDIUM finding.
    const result = evaluateRisk(decoded, SAMPLE_CHAIN, settingsNoWarn);
    expect(result.riskLevel).toBe('UNKNOWN');
  });

  it('produces a human-readable summary', () => {
    const decoded = makeDecoded({
      actionType: 'ERC20_APPROVE',
      spender: '0x1111111111111111111111111111111111111111' as `0x${string}`,
      amount: UINT256_MAX,
      isUnlimited: true,
    });
    const result = evaluateRisk(decoded, SAMPLE_CHAIN, SETTINGS);
    expect(result.summary).toContain('unlimited');
    expect(result.summary).toContain('0x1111');
  });
});
