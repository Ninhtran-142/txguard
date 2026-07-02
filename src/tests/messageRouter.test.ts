import { describe, it, expect, beforeEach } from 'vitest';
import { __resetChromeStorage } from './mocks/chrome';
import { handleBackgroundMessage } from '../background/messageRouter';
import { MESSAGE_TYPES, MESSAGE_SOURCES } from '../shared/messages';
import {
  setChains,
  setWalletChainId,
  getWalletChainId,
} from '../background/storage';
import type { ChainConfig } from '../shared/types';

const ETH: ChainConfig = {
  chainId: 1,
  name: 'Ethereum',
  rpcUrl: 'https://ethereum-rpc.publicnode.com',
  nativeCurrencySymbol: 'ETH',
  nativeCurrencyDecimals: 18,
};

const SRC = MESSAGE_SOURCES.TXGUARD_CONTENT;
const POPUP_SRC = MESSAGE_SOURCES.TXGUARD_POPUP;

describe('Background message router', () => {
  beforeEach(() => {
    __resetChromeStorage();
  });

  it('rejects messages with an unknown source', async () => {
    const res = await handleBackgroundMessage({
      type: MESSAGE_TYPES.GET_POPUP_STATE,
      source: 'EVIL_PAGE',
    });
    expect(res).toBeUndefined();
  });

  it('rejects messages with no source', async () => {
    const res = await handleBackgroundMessage({
      type: MESSAGE_TYPES.GET_POPUP_STATE,
    });
    expect(res).toBeUndefined();
  });

  it('WALLET_CHAIN_CHANGED caches the chain ID', async () => {
    const res = await handleBackgroundMessage({
      source: SRC,
      type: MESSAGE_TYPES.WALLET_CHAIN_CHANGED,
      chainId: 137,
    });
    expect(res).toEqual({ type: 'ACK' });
    expect(await getWalletChainId()).toBe(137);
  });

  it('GET_POPUP_STATE returns walletChainId, domainRisk, chains, and history', async () => {
    await setChains([ETH]);
    await setWalletChainId(1);
    const res = (await handleBackgroundMessage({
      source: POPUP_SRC,
      type: MESSAGE_TYPES.GET_POPUP_STATE,
    })) as {
      type: string;
      state: {
        walletChainId?: number;
        domainRisk: string;
        chains: ChainConfig[];
        history: unknown[];
        domain: string;
      };
    };
    expect(res.type).toBe('POPUP_STATE');
    expect(res.state.walletChainId).toBe(1);
    expect(res.state.domainRisk).toBe('UNKNOWN');
    expect(res.state.chains).toHaveLength(1);
    expect(res.state.history).toEqual([]);
  });

  it('PROVIDER_REQUEST_INTERCEPTED for chain switch to configured chain is LOW (ASK_USER)', async () => {
    await setChains([ETH]);
    const res = (await handleBackgroundMessage({
      source: SRC,
      type: MESSAGE_TYPES.PROVIDER_REQUEST_INTERCEPTED,
      requestId: 'r1',
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x1' }],
      domain: 'example.com',
      origin: 'https://example.com',
      chainId: 1,
    })) as {
      type: string;
      policy: string;
      analysis: { riskLevel: string; actionType: string };
    };
    expect(res.type).toBe('ANALYSIS_RESULT');
    expect(res.policy).toBe('ASK_USER');
    expect(res.analysis.actionType).toBe('CHAIN_SWITCH');
    // Switching to chain 1 which is configured -> LOW.
    expect(res.analysis.riskLevel).toBe('LOW');
  });

  it('PROVIDER_REQUEST_INTERCEPTED for chain switch to unknown chain is MEDIUM (ASK_USER)', async () => {
    await setChains([ETH]);
    const res = (await handleBackgroundMessage({
      source: SRC,
      type: MESSAGE_TYPES.PROVIDER_REQUEST_INTERCEPTED,
      requestId: 'r2',
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x1a4' }],
      domain: 'example.com',
      origin: 'https://example.com',
      chainId: 1,
    })) as { type: string; policy: string; analysis: { riskLevel: string } };
    // 0x1a4 = 420 (unknown chain) -> MEDIUM.
    expect(res.policy).toBe('ASK_USER');
    expect(res.analysis.riskLevel).toBe('MEDIUM');
  });

  it('unknown message type with a valid source returns undefined', async () => {
    const res = await handleBackgroundMessage({
      source: SRC,
      type: 'UNKNOWN_TYPE',
    });
    expect(res).toBeUndefined();
  });
});
