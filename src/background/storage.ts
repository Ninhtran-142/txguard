// Typed storage wrapper around chrome.storage.local.
//
// Security note: Never store private keys or full sensitive signature
// payloads. Transaction history is capped at MAX_TX_HISTORY (100) and must
// only contain summaries + risk results, never full signing payloads.
import { STORAGE_KEYS, type StorageKey } from '../shared/storageKeys';
import type {
  ChainConfig,
  TxAnalysisResult,
  TxGuardSettings,
} from '../shared/types';
import { MAX_TX_HISTORY } from '../shared/constants';

const DEFAULT_SETTINGS: TxGuardSettings = {
  enabled: true,
  warnOnUnknownCalls: true,
  warnOnPersonalSign: true,
  blockHighRiskByDefault: false,
};

async function getItem<T>(key: StorageKey): Promise<T | undefined> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return undefined;
  const result = await chrome.storage.local.get(key);
  return result[key] as T | undefined;
}

async function setItem(key: StorageKey, value: unknown): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  await chrome.storage.local.set({ [key]: value });
}

// ── Chains ───────────────────────────────────────────────────────
export async function getChains(): Promise<ChainConfig[]> {
  const chains = await getItem<ChainConfig[]>(STORAGE_KEYS.CHAINS);
  return chains ?? [];
}

export async function setChains(chains: ChainConfig[]): Promise<void> {
  await setItem(STORAGE_KEYS.CHAINS, chains);
}

// ── Settings ─────────────────────────────────────────────────────
export async function getSettings(): Promise<TxGuardSettings> {
  const settings = await getItem<TxGuardSettings>(STORAGE_KEYS.SETTINGS);
  return settings ?? DEFAULT_SETTINGS;
}

export async function setSettings(settings: TxGuardSettings): Promise<void> {
  await setItem(STORAGE_KEYS.SETTINGS, settings);
}

// ── Transaction history (capped at MAX_TX_HISTORY, newest first) ──
export async function getTxHistory(): Promise<TxAnalysisResult[]> {
  const history = await getItem<TxAnalysisResult[]>(STORAGE_KEYS.TX_HISTORY);
  return history ?? [];
}

export async function addTxHistoryItem(item: TxAnalysisResult): Promise<void> {
  const current = await getTxHistory();
  // Prepend newest first, cap at MAX_TX_HISTORY.
  const updated = [item, ...current].slice(0, MAX_TX_HISTORY);
  await setItem(STORAGE_KEYS.TX_HISTORY, updated);
}

export async function clearTxHistory(): Promise<void> {
  await setItem(STORAGE_KEYS.TX_HISTORY, []);
}

// ── Wallet chain ID (read-only metadata cached for the popup) ─────
export async function getWalletChainId(): Promise<number | undefined> {
  const id = await getItem<number>(STORAGE_KEYS.WALLET_CHAIN_ID);
  return id;
}

export async function setWalletChainId(
  chainId: number | undefined,
): Promise<void> {
  await setItem(STORAGE_KEYS.WALLET_CHAIN_ID, chainId);
}

// ── Domain allowlist / blocklist ─────────────────────────────────
export async function getDomainAllowlist(): Promise<string[]> {
  const list = await getItem<string[]>(STORAGE_KEYS.DOMAIN_ALLOWLIST);
  return list ?? [];
}

export async function setDomainAllowlist(domains: string[]): Promise<void> {
  await setItem(STORAGE_KEYS.DOMAIN_ALLOWLIST, domains);
}

export async function getDomainBlocklist(): Promise<string[]> {
  const list = await getItem<string[]>(STORAGE_KEYS.DOMAIN_BLOCKLIST);
  return list ?? [];
}

export async function setDomainBlocklist(domains: string[]): Promise<void> {
  await setItem(STORAGE_KEYS.DOMAIN_BLOCKLIST, domains);
}
