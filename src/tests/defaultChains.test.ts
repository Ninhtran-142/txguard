import { describe, it, expect } from 'vitest';
import {
  getChainTemplate,
  DEFAULT_CHAINS,
  templateToPreset,
} from '../core/chains/defaultChains';

describe('Default chain templates', () => {
  it('getChainTemplate returns metadata for a known chain ID', () => {
    const eth = getChainTemplate(1);
    expect(eth).toBeDefined();
    expect(eth?.name).toBe('Ethereum');
    expect(eth?.nativeCurrencySymbol).toBe('ETH');
    expect(eth?.nativeCurrencyDecimals).toBe(18);
  });

  it('getChainTemplate returns metadata for Base', () => {
    const base = getChainTemplate(8453);
    expect(base).toBeDefined();
    expect(base?.name).toBe('Base');
  });

  it('getChainTemplate returns undefined for an unknown chain ID', () => {
    expect(getChainTemplate(999999)).toBeUndefined();
  });

  it('DEFAULT_CHAINS expose an optional publicRpcUrl users can try', () => {
    // Templates carry a try-it public RPC. TxGuard never auto-uses it — the
    // user must explicitly save the chain (via templateToPreset + Save).
    for (const c of DEFAULT_CHAINS) {
      expect(typeof c.publicRpcUrl).toBe('string');
      expect((c.publicRpcUrl ?? '').length).toBeGreaterThan(0);
    }
  });

  it('includes the common EVM chains', () => {
    const ids = DEFAULT_CHAINS.map((c) => c.chainId);
    expect(ids).toContain(1);
    expect(ids).toContain(56);
    expect(ids).toContain(8453);
    expect(ids).toContain(42161);
    expect(ids).toContain(137);
  });

  it('templateToPreset builds a ChainConfig with the publicRpcUrl as rpcUrl', () => {
    const preset = templateToPreset(getChainTemplate(1)!);
    expect(preset.chainId).toBe(1);
    expect(preset.name).toBe('Ethereum');
    expect(preset.rpcUrl).toBe('https://ethereum-rpc.publicnode.com');
    expect(preset.nativeCurrencySymbol).toBe('ETH');
  });

  it('templateToPreset leaves rpcUrl empty when a template has no publicRpcUrl', () => {
    const preset = templateToPreset({
      chainId: 999,
      name: 'Custom',
      nativeCurrencySymbol: 'XYZ',
      nativeCurrencyDecimals: 18,
    });
    expect(preset.rpcUrl).toBe('');
  });
});
