import { vi } from 'vitest';

// In-memory chrome.storage.local + chrome.runtime mock for unit tests.
// Provides the subset of chrome.* APIs used by TxGuard core logic.

const storage: Record<string, unknown> = {};

export const chromeStorageMock = {
  local: {
    get: vi.fn(async (keys?: string | string[] | null) => {
      if (keys == null) return { ...storage };
      const keyList = Array.isArray(keys) ? keys : [keys];
      const result: Record<string, unknown> = {};
      for (const k of keyList) {
        if (k in storage) result[k] = storage[k];
      }
      return result;
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(storage, items);
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      const keyList = Array.isArray(keys) ? keys : [keys];
      for (const k of keyList) delete storage[k];
    }),
    clear: vi.fn(async () => {
      for (const k of Object.keys(storage)) delete storage[k];
    }),
  },
};

export const chromeRuntimeMock = {
  sendMessage: vi.fn(async () => undefined),
  onMessage: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
    hasListener: vi.fn(() => false),
  },
  id: 'txguard-test',
  getURL: vi.fn((path: string) => `chrome-extension://txguard-test/${path}`),
  lastError: undefined as { message: string } | undefined,
};

export const chromeMock = {
  storage: chromeStorageMock,
  runtime: chromeRuntimeMock,
  tabs: {
    query: vi.fn(async () => [{ id: 1, url: 'https://example.com' }]),
    get: vi.fn(async (id: number) => ({
      id,
      url: 'https://example.com',
    })),
  },
  scripting: {
    executeScript: vi.fn(async () => []),
  },
};

/** Reset the in-memory storage (call in beforeEach). */
export function __resetChromeStorage(): void {
  for (const k of Object.keys(storage)) delete storage[k];
}
