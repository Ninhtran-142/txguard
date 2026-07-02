import { describe, it, expect, beforeEach, vi } from 'vitest';

// Unit tests for the provider hook logic. The full injected script runs in
// the page main world; these tests verify the core hooking behaviour by
// simulating window.ethereum and the message bridge.

const HOOK_FLAG = '__TXGUARD_HOOKED__';
const INJECTED_SOURCE = 'TXGUARD_INJECTED';
const CONTENT_SOURCE = 'TXGUARD_CONTENT';

const INTERCEPTED = new Set([
  'eth_sendTransaction',
  'eth_signTypedData',
  'eth_signTypedData_v3',
  'eth_signTypedData_v4',
  'personal_sign',
  'wallet_switchEthereumChain',
]);

// Testable simulation of the provider hook.
function hookProvider(provider: {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}): void {
  if ((provider as unknown as Record<string, boolean>)[HOOK_FLAG]) return;
  (provider as unknown as Record<string, boolean>)[HOOK_FLAG] = true;
  const originalRequest = provider.request.bind(provider) as (args: {
    method: string;
    params?: unknown[];
  }) => Promise<unknown>;

  provider.request = function (args: {
    method: string;
    params?: unknown[];
  }): Promise<unknown> {
    if (!args?.method || !INTERCEPTED.has(args.method)) {
      return originalRequest(args);
    }
    const requestId = `test_${Math.random()}`;
    window.postMessage(
      {
        source: INJECTED_SOURCE,
        type: 'PROVIDER_REQUEST_INTERCEPTED',
        requestId,
        method: args.method,
        params: args.params,
      },
      '*',
    );
    return new Promise((resolve, reject) => {
      function onMessage(event: MessageEvent) {
        const data = event.data as Record<string, unknown> | undefined;
        if (!data || data.source !== CONTENT_SOURCE) return;
        if (data.requestId !== requestId) return;
        if (data.type !== 'USER_DECISION') return;
        window.removeEventListener('message', onMessage);
        if (data.decision === 'CONTINUE') resolve(originalRequest(args));
        else {
          const err = new Error('User rejected');
          (err as unknown as { code: number }).code = 4001;
          reject(err);
        }
      }
      window.addEventListener('message', onMessage);
    });
  };
}

// Helper: wait for an intercepted postMessage and return it.
function waitForIntercepted(): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const listener = (e: MessageEvent) => {
      const data = e.data as Record<string, unknown>;
      if (
        data?.source === INJECTED_SOURCE &&
        data.type === 'PROVIDER_REQUEST_INTERCEPTED'
      ) {
        window.removeEventListener('message', listener);
        resolve(data);
      }
    };
    window.addEventListener('message', listener);
  });
}

describe('Provider Hook', () => {
  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).ethereum;
  });

  it('wraps window.ethereum.request', () => {
    const provider = { request: vi.fn(async () => 'result') };
    (window as unknown as { ethereum: typeof provider }).ethereum = provider;
    hookProvider(provider);
    expect((provider as unknown as Record<string, boolean>)[HOOK_FLAG]).toBe(
      true,
    );
  });

  it('non-intercepted methods pass through', async () => {
    const mockRequest = vi.fn(
      async (_args: { method: string; params?: unknown[] }) => 'ok',
    );
    const provider = { request: mockRequest };
    hookProvider(provider);
    const result = await provider.request({ method: 'eth_chainId' });
    expect(result).toBe('ok');
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('intercepted method sends postMessage', async () => {
    const provider = {
      request: vi.fn(
        async (_args: { method: string; params?: unknown[] }) => 'tx-hash',
      ),
    };
    hookProvider(provider);
    const promise = provider.request({
      method: 'eth_sendTransaction',
      params: [{ to: '0x1234' }],
    });
    const intercepted = await waitForIntercepted();
    expect(intercepted.type).toBe('PROVIDER_REQUEST_INTERCEPTED');
    expect(intercepted.method).toBe('eth_sendTransaction');
    window.postMessage(
      {
        source: CONTENT_SOURCE,
        type: 'USER_DECISION',
        requestId: intercepted.requestId,
        decision: 'CONTINUE',
      },
      '*',
    );
    await expect(promise).resolves.toBe('tx-hash');
  });

  it('CONTINUE calls original request with same params', async () => {
    const mockRequest = vi.fn(
      async (_args: { method: string; params?: unknown[] }) => 'tx-hash',
    );
    const provider = { request: mockRequest };
    hookProvider(provider);
    const params = [{ to: '0x1234', data: '0xabcd' }];
    const promise = provider.request({ method: 'eth_sendTransaction', params });
    const intercepted = await waitForIntercepted();
    window.postMessage(
      {
        source: CONTENT_SOURCE,
        type: 'USER_DECISION',
        requestId: intercepted.requestId,
        decision: 'CONTINUE',
      },
      '*',
    );
    await promise;
    expect(mockRequest).toHaveBeenCalledWith({
      method: 'eth_sendTransaction',
      params,
    });
  });

  it('CANCEL throws error with code 4001', async () => {
    const mockRequest = vi.fn(
      async (_args: { method: string; params?: unknown[] }) => 'tx-hash',
    );
    const provider = { request: mockRequest };
    hookProvider(provider);
    const promise = provider.request({
      method: 'eth_sendTransaction',
      params: [{ to: '0x1234' }],
    });
    const intercepted = await waitForIntercepted();
    window.postMessage(
      {
        source: CONTENT_SOURCE,
        type: 'USER_DECISION',
        requestId: intercepted.requestId,
        decision: 'CANCEL',
      },
      '*',
    );
    await expect(promise).rejects.toThrow();
    try {
      await promise;
    } catch (err) {
      expect((err as unknown as { code: number }).code).toBe(4001);
    }
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('does not hook twice', () => {
    const provider = { request: vi.fn(async () => 'ok') };
    hookProvider(provider);
    const firstRequest = provider.request;
    hookProvider(provider);
    expect(provider.request).toBe(firstRequest);
  });

  it('no window.ethereum does not throw', () => {
    delete (window as unknown as Record<string, unknown>).ethereum;
    const eth = (window as unknown as { ethereum?: unknown }).ethereum;
    expect(eth).toBeUndefined();
    expect(() => {
      if (eth && typeof (eth as { request: unknown }).request === 'function') {
        hookProvider(eth as never);
      }
    }).not.toThrow();
  });
});
