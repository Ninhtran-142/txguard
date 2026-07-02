import { describe, it, expect, beforeEach } from 'vitest';
import { __resetChromeStorage } from './mocks/chrome';
import { getWalletChainId, setWalletChainId } from '../background/storage';

describe('Wallet chain ID storage', () => {
  beforeEach(() => {
    __resetChromeStorage();
  });

  it('getWalletChainId returns undefined when empty', async () => {
    expect(await getWalletChainId()).toBeUndefined();
  });

  it('setWalletChainId and getWalletChainId roundtrip', async () => {
    await setWalletChainId(137);
    expect(await getWalletChainId()).toBe(137);
  });

  it('setWalletChainId(undefined) clears the value', async () => {
    await setWalletChainId(1);
    expect(await getWalletChainId()).toBe(1);
    await setWalletChainId(undefined);
    expect(await getWalletChainId()).toBeUndefined();
  });
});
