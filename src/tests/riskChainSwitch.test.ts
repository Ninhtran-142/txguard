import { describe, it, expect } from 'vitest';
import { evaluateRisk } from '../core/risk/evaluator';
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
  rpcUrl: 'https://ethereum-rpc.publicnode.com',
  nativeCurrencySymbol: 'ETH',
  nativeCurrencyDecimals: 18,
};

function makeDecoded(overrides: Partial<DecodedTx>): DecodedTx {
  return { isDecoded: true, actionType: 'UNKNOWN', ...overrides };
}

describe('Chain switch risk (SPEC 18.4)', () => {
  it('chain switch to a configured chain = LOW', () => {
    const decoded = makeDecoded({
      actionType: 'CHAIN_SWITCH',
      targetChainId: 137,
    });
    const result = evaluateRisk(decoded, SAMPLE_CHAIN, SETTINGS, {
      configuredChainIds: new Set([1, 137]),
    });
    expect(result.riskLevel).toBe('LOW');
    expect(result.findings.some((f) => f.severity === 'LOW')).toBe(true);
  });

  it('chain switch to an unknown chain = MEDIUM', () => {
    const decoded = makeDecoded({
      actionType: 'CHAIN_SWITCH',
      targetChainId: 999,
    });
    const result = evaluateRisk(decoded, SAMPLE_CHAIN, SETTINGS, {
      configuredChainIds: new Set([1, 137]),
    });
    expect(result.riskLevel).toBe('MEDIUM');
    expect(
      result.findings.some((f) => f.title === 'Chain switch request'),
    ).toBe(true);
  });

  it('chain switch with no configuredChainIds defaults to MEDIUM', () => {
    const decoded = makeDecoded({
      actionType: 'CHAIN_SWITCH',
      targetChainId: 1,
    });
    const result = evaluateRisk(decoded, SAMPLE_CHAIN, SETTINGS);
    expect(result.riskLevel).toBe('MEDIUM');
  });
});

describe('No-code check (SPEC 18.3)', () => {
  it('contract call with no code adds MEDIUM finding', () => {
    const decoded = makeDecoded({
      actionType: 'ERC20_APPROVE',
      to: '0x2222222222222222222222222222222222222222' as `0x${string}`,
      spender: '0x1111111111111111111111111111111111111111' as `0x${string}`,
      amount: 1000n,
      isUnlimited: false,
    });
    const result = evaluateRisk(decoded, SAMPLE_CHAIN, SETTINGS, {
      hasCode: false,
    });
    expect(
      result.findings.some(
        (f) => f.title === 'Target address has no contract code',
      ),
    ).toBe(true);
  });

  it('contract call with code does not add no-code finding', () => {
    const decoded = makeDecoded({
      actionType: 'ERC20_APPROVE',
      to: '0x2222222222222222222222222222222222222222' as `0x${string}`,
      spender: '0x1111111111111111111111111111111111111111' as `0x${string}`,
      amount: 1000n,
      isUnlimited: false,
    });
    const result = evaluateRisk(decoded, SAMPLE_CHAIN, SETTINGS, {
      hasCode: true,
    });
    expect(
      result.findings.some(
        (f) => f.title === 'Target address has no contract code',
      ),
    ).toBe(false);
  });
});
