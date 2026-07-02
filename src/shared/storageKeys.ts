// Storage keys for chrome.storage.local. Namespaced under "txguard.".
export const STORAGE_KEYS = {
  CHAINS: 'txguard.chains',
  TX_HISTORY: 'txguard.txHistory',
  SETTINGS: 'txguard.settings',
  DOMAIN_ALLOWLIST: 'txguard.domainAllowlist',
  DOMAIN_BLOCKLIST: 'txguard.domainBlocklist',
  WALLET_CHAIN_ID: 'txguard.walletChainId',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
