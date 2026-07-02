import { describe, it, expect, beforeEach } from 'vitest';
import { __resetChromeStorage } from './mocks/chrome';
import {
  getChains,
  setChains,
  getSettings,
  setSettings,
  getTxHistory,
  addTxHistoryItem,
  clearTxHistory,
} from '../background/storage';
import type { TxAnalysisResult } from '../shared/types';

function makeAnalysis(id: string, ts: number): TxAnalysisResult {
  return {
    requestId: id,
    riskLevel: 'LOW',
    findings: [],
    summary: `check ${id}`,
    decoded: { isDecoded: true, actionType: 'NATIVE_TRANSFER' },
    actionType: 'NATIVE_TRANSFER',
    timestamp: ts,
    domain: 'example.com',
  };
}

describe('Storage helpers', () => {
  beforeEach(() => {
    __resetChromeStorage();
  });

  it('getSettings returns defaults when empty', async () => {
    const settings = await getSettings();
    expect(settings).toEqual({
      enabled: true,
      warnOnUnknownCalls: true,
      warnOnPersonalSign: true,
      blockHighRiskByDefault: false,
    });
  });

  it('setSettings and getSettings roundtrip', async () => {
    await setSettings({
      enabled: false,
      warnOnUnknownCalls: false,
      warnOnPersonalSign: true,
      blockHighRiskByDefault: true,
    });
    const settings = await getSettings();
    expect(settings.enabled).toBe(false);
    expect(settings.warnOnUnknownCalls).toBe(false);
    expect(settings.blockHighRiskByDefault).toBe(true);
  });

  it('addTxHistoryItem caps at 100', async () => {
    for (let i = 0; i < 110; i++) {
      await addTxHistoryItem(makeAnalysis(`r${i}`, i));
    }
    const history = await getTxHistory();
    expect(history).toHaveLength(100);
  });

  it('addTxHistoryItem inserts newest first', async () => {
    await addTxHistoryItem(makeAnalysis('old', 1));
    await addTxHistoryItem(makeAnalysis('new', 2));
    const history = await getTxHistory();
    expect(history[0].requestId).toBe('new');
    expect(history[1].requestId).toBe('old');
  });

  it('getChains returns empty array when empty', async () => {
    const chains = await getChains();
    expect(chains).toEqual([]);
  });

  it('setChains and getChains roundtrip', async () => {
    const chains = [
      {
        chainId: 1,
        name: 'Ethereum',
        rpcUrl: 'https://eth.llamarpc.com',
        nativeCurrencySymbol: 'ETH',
        nativeCurrencyDecimals: 18,
      },
    ];
    await setChains(chains);
    expect(await getChains()).toEqual(chains);
  });

  it('clearTxHistory removes all items', async () => {
    await addTxHistoryItem(makeAnalysis('a', 1));
    await clearTxHistory();
    expect(await getTxHistory()).toEqual([]);
  });
});
