import { describe, it, expect, beforeEach } from 'vitest';
import { __resetChromeStorage } from './mocks/chrome';
import { handleBackgroundMessage } from '../background/messageRouter';
import { MESSAGE_TYPES, MESSAGE_SOURCES } from '../shared/messages';
import { setSettings, getTxHistory } from '../background/storage';
import type { TxGuardSettings } from '../shared/types';

const SRC = MESSAGE_SOURCES.TXGUARD_CONTENT;

const BASE_SETTINGS: TxGuardSettings = {
  enabled: true,
  warnOnUnknownCalls: true,
  warnOnPersonalSign: true,
  blockHighRiskByDefault: false,
};

// A personal_sign from an unknown domain is HIGH risk when warnOnPersonalSign
// is on (and the domain is not in the allowlist). No RPC is configured, so no
// network calls are made during analysis.
function personalSignRequest(requestId: string) {
  return {
    source: SRC,
    type: MESSAGE_TYPES.PROVIDER_REQUEST_INTERCEPTED,
    requestId,
    method: 'personal_sign',
    params: ['0x68656c6c6f', '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'],
    domain: 'unknown-dapp.com',
    origin: 'https://unknown-dapp.com',
    chainId: 1,
  };
}

describe('Settings policy: enabled + blockHighRiskByDefault', () => {
  beforeEach(() => {
    __resetChromeStorage();
  });

  it('enabled=false bypasses analysis: policy CONTINUE, no analysis, no history', async () => {
    await setSettings({ ...BASE_SETTINGS, enabled: false });
    const res = (await handleBackgroundMessage(
      personalSignRequest('bypass-1'),
    )) as {
      type: string;
      policy: string;
      analysis?: { riskLevel: string };
    };
    expect(res.type).toBe('ANALYSIS_RESULT');
    expect(res.policy).toBe('CONTINUE');
    // No analysis is produced when disabled — the request is forwarded unchanged.
    expect(res.analysis).toBeUndefined();
    // No history must be stored when TxGuard is disabled.
    expect(await getTxHistory()).toEqual([]);
  });

  it('blockHighRiskByDefault cancels HIGH risk: policy CANCEL, history decision CANCELLED_BY_POLICY', async () => {
    await setSettings({ ...BASE_SETTINGS, blockHighRiskByDefault: true });
    const res = (await handleBackgroundMessage(
      personalSignRequest('block-1'),
    )) as {
      type: string;
      policy: string;
      analysis: { riskLevel: string; decision?: string };
    };
    expect(res.type).toBe('ANALYSIS_RESULT');
    expect(res.policy).toBe('CANCEL');
    expect(res.analysis.riskLevel).toBe('HIGH');
    expect(res.analysis.decision).toBe('CANCELLED_BY_POLICY');
    const history = await getTxHistory();
    expect(history).toHaveLength(1);
    expect(history[0].decision).toBe('CANCELLED_BY_POLICY');
  });

  it('blockHighRiskByDefault=false keeps HIGH risk as ASK_USER (no auto-cancel)', async () => {
    await setSettings({ ...BASE_SETTINGS, blockHighRiskByDefault: false });
    const res = (await handleBackgroundMessage(
      personalSignRequest('ask-1'),
    )) as {
      policy: string;
      analysis: { riskLevel: string; decision?: string };
    };
    expect(res.policy).toBe('ASK_USER');
    expect(res.analysis.riskLevel).toBe('HIGH');
    // No policy decision is recorded when the user is asked to decide.
    expect(res.analysis.decision).toBeUndefined();
  });

  it('background rejects an unknown message source', async () => {
    const res = await handleBackgroundMessage({
      source: 'NOT_TXGUARD',
      type: MESSAGE_TYPES.PROVIDER_REQUEST_INTERCEPTED,
      requestId: 'x',
      method: 'personal_sign',
      params: [],
      domain: 'x.com',
    });
    expect(res).toBeUndefined();
  });
});
