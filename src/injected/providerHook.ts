// TxGuard injected provider hook.
//
// SECURITY-SENSITIVE: This script runs in the PAGE main-world context (not
// the extension isolated world). It wraps window.ethereum.request to
// intercept selected EVM wallet methods.
//
// HARD RULES:
// - NEVER modify transaction parameters. Continue = call original request
//   unchanged. Cancel = reject with EIP-1193 error code 4001.
// - NEVER handle private keys or sign transactions.
// - Do NOT monkey-patch unrelated browser APIs.
// - Do NOT throw on pages without window.ethereum.
// - Do NOT hook the same provider twice (use __TXGUARD_HOOKED__ flag).
//
// Communication: window.postMessage (injected <-> content script).
// This script CANNOT access chrome.runtime.

interface TxGuardMessage {
  source: string;
  type: string;
  requestId?: string;
  decision?: 'CONTINUE' | 'CANCEL';
  chainId?: number;
  [key: string]: unknown;
}

type ProviderLike = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (payload: unknown) => void) => void;
  removeListener?: (event: string, handler: (payload: unknown) => void) => void;
};

const TXGUARD_SOURCE = 'TXGUARD_INJECTED';
const CONTENT_SOURCE = 'TXGUARD_CONTENT';

// Methods TxGuard intercepts for analysis.
const INTERCEPTED_METHODS = new Set<string>([
  'eth_sendTransaction',
  'eth_signTypedData',
  'eth_signTypedData_v3',
  'eth_signTypedData_v4',
  'personal_sign',
  'wallet_switchEthereumChain',
]);

const DECISION_TIMEOUT_MS = 60_000;

// Flag to prevent double-hooking the same provider.
const HOOK_FLAG = '__TXGUARD_HOOKED__';

// Tracks the wallet's current chain ID so intercepted requests can carry it
// to the background for chain-config matching + risk evaluation.
let currentChainId: number | undefined;

function generateRequestId(): string {
  return `txg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

// EIP-1193 user rejection error (code 4001).
function userRejectionError(
  message = 'TxGuard: User rejected the request',
): Error {
  const err = new Error(message);
  (err as unknown as { code: number }).code = 4001;
  return err;
}

// Post a message to the content script (window.postMessage).
function postToContent(type: string, payload: Record<string, unknown>): void {
  window.postMessage(
    { source: TXGUARD_SOURCE, type, ...payload },
    window.location.origin,
  );
}

// Notify the content/background of the wallet's current chain ID.
// Read-only metadata — never sensitive.
function emitChainChanged(): void {
  postToContent('WALLET_CHAIN_CHANGED', { chainId: currentChainId });
}

// Parse a chainId value returned by the provider. eth_chainId returns a
// hex string ("0x1"); chainChanged events may carry a hex string or number.
function parseChainId(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    try {
      return Number.parseInt(value, 16);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

// Read the wallet's current chain ID via a read-only eth_chainId call.
// eth_chainId is NOT intercepted, so it flows straight to the provider.
async function refreshChainId(provider: ProviderLike): Promise<void> {
  try {
    const raw = await provider.request({ method: 'eth_chainId' });
    const id = parseChainId(raw);
    if (id !== undefined && id !== currentChainId) {
      currentChainId = id;
      emitChainChanged();
    }
  } catch {
    // Some providers reject eth_chainId very early; ignore — we retry on the
    // next intercepted request and via the chainChanged event.
  }
}

// Wait for a user decision (Continue/Cancel) from the content script.
function waitForDecision(requestId: string): Promise<'CONTINUE' | 'CANCEL'> {
  return new Promise((resolve, reject) => {
    let settled = false;

    function onMessage(event: MessageEvent) {
      const data = event.data as TxGuardMessage | undefined;
      // Validate source — only accept messages from the content script.
      if (!data || data.source !== CONTENT_SOURCE) return;
      if (data.requestId !== requestId) return;
      if (data.type !== 'USER_DECISION') return;

      settled = true;
      window.removeEventListener('message', onMessage);
      if (data.decision === 'CONTINUE') resolve('CONTINUE');
      else reject(userRejectionError());
    }

    window.addEventListener('message', onMessage);

    // Timeout fallback — reject if no decision arrives.
    setTimeout(() => {
      if (!settled) {
        window.removeEventListener('message', onMessage);
        reject(userRejectionError('TxGuard decision timeout'));
      }
    }, DECISION_TIMEOUT_MS);
  });
}

// Wrap a single provider's request method.
function hookProvider(provider: ProviderLike): void {
  // Guard: don't hook the same provider twice.
  if ((provider as unknown as Record<string, unknown>)[HOOK_FLAG]) return;
  (provider as unknown as Record<string, unknown>)[HOOK_FLAG] = true;

  const originalRequest = provider.request.bind(provider) as (args: {
    method: string;
    params?: unknown[];
  }) => Promise<unknown>;

  // Read the initial chain ID and subscribe to chain changes (best-effort).
  void refreshChainId(provider);
  if (typeof provider.on === 'function') {
    const onChainChanged = (payload: unknown): void => {
      const id = parseChainId(payload);
      if (id !== undefined && id !== currentChainId) {
        currentChainId = id;
        emitChainChanged();
      }
    };
    try {
      provider.on('chainChanged', onChainChanged);
    } catch {
      // Provider does not support events — polling fallback below covers it.
    }
  }

  // Replace request with our interceptor.
  (
    provider as unknown as {
      request: (args: {
        method: string;
        params?: unknown[];
      }) => Promise<unknown>;
    }
  ).request = function (args: {
    method: string;
    params?: unknown[];
  }): Promise<unknown> {
    const method = args?.method;

    // Non-intercepted methods: forward unchanged, no analysis.
    if (!method || !INTERCEPTED_METHODS.has(method)) {
      return originalRequest(args);
    }

    // Intercepted method: ask TxGuard for a user decision.
    const requestId = generateRequestId();
    const params = args.params ?? [];

    // Refresh the chain ID opportunistically before emitting, so the
    // background always analyses with the freshest wallet chain.
    void refreshChainId(provider);

    // Notify content script (-> background -> analysis -> overlay -> decision).
    postToContent('PROVIDER_REQUEST_INTERCEPTED', {
      requestId,
      method,
      params,
      origin: window.location.origin,
      domain: window.location.hostname,
      chainId: currentChainId,
    });

    // Wait for the user's decision before proceeding.
    return waitForDecision(requestId).then((decision) => {
      if (decision === 'CONTINUE') {
        // SECURITY: forward the ORIGINAL request unchanged — never modify params.
        return originalRequest(args);
      }
      // CANCEL — should not reach here (waitForDecision rejects on cancel).
      throw userRejectionError();
    });
  };
}

// Detect and hook window.ethereum. Also handle providers that arrive late
// (e.g. MetaMask injects asynchronously).
function tryHook(): void {
  const eth = (window as unknown as { ethereum?: ProviderLike }).ethereum;
  if (eth && typeof eth.request === 'function') {
    hookProvider(eth);
  }
}

// Run as early as possible.
tryHook();

// Re-check periodically in case the provider is injected after our script.
// Stop once we've successfully hooked.
let attempts = 0;
const interval = setInterval(() => {
  const eth = (
    window as unknown as {
      ethereum?: ProviderLike & Record<string, unknown>;
    }
  ).ethereum;
  if (eth && typeof eth.request === 'function' && !eth[HOOK_FLAG]) {
    hookProvider(eth);
  }
  if ((eth && eth[HOOK_FLAG]) || ++attempts > 20) {
    clearInterval(interval);
  }
}, 250);

// Listen for late Ethereum provider events.
window.addEventListener('ethereum#initialized' as never, tryHook, {
  once: true,
});
