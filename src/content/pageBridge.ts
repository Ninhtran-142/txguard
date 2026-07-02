// TxGuard page bridge — bridges window.postMessage (injected script, main world)
// <-> chrome.runtime.sendMessage (content script, isolated world <-> background).
//
// Security note: validate message sources on both sides. Only accept
// PROVIDER_REQUEST_INTERCEPTED from TXGUARD_INJECTED and USER_DECISION from
// TXGUARD_CONTENT. Never trust page-provided data without validating.
//
// All messages sent to the background carry source = TXGUARD_CONTENT so the
// background router can reject unknown/foreign sources.

import { MESSAGE_SOURCES, MESSAGE_TYPES } from '../shared/messages';
import type {
  InterceptedProviderRequest,
  Policy,
  TxAnalysisResult,
  TxUserDecision,
} from '../shared/types';

const INJECTED_SOURCE = MESSAGE_SOURCES.TXGUARD_INJECTED;
const CONTENT_SOURCE = MESSAGE_SOURCES.TXGUARD_CONTENT;

interface BridgeMessage {
  source: string;
  type: string;
  requestId?: string;
  chainId?: number;
  [key: string]: unknown;
}

/** Background response for an intercepted request. */
export interface AnalysisResponse {
  analysis?: TxAnalysisResult;
  policy: Policy;
}

// Inject the provider hook script into the page main world.
//
// The script is pre-transpiled to JS by scripts/build-injected.mjs and copied
// to dist/injected/providerHook.js as a static public asset. We load it via
// chrome.runtime.getURL so the page receives executable JS (not raw TS).
export function injectProviderHook(): void {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected/providerHook.js');
    script.onload = () => script.remove();
    (document.head || document.documentElement)?.appendChild(script);
  } catch {
    // Injection failure should not break the page.
  }
}

// Forward an intercepted provider request to the background for analysis.
// Returns the analysis result + policy from the background.
export async function forwardToBackground(
  request: InterceptedProviderRequest,
): Promise<AnalysisResponse | undefined> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        source: CONTENT_SOURCE,
        type: MESSAGE_TYPES.PROVIDER_REQUEST_INTERCEPTED,
        ...request,
      },
      (response: unknown) => {
        const r = response as AnalysisResponse | undefined;
        resolve(r);
      },
    );
  });
}

// Forward a wallet chain change notification to the background (for caching).
export function forwardChainChangedToBackground(
  chainId: number | undefined,
): void {
  chrome.runtime.sendMessage({
    source: CONTENT_SOURCE,
    type: MESSAGE_TYPES.WALLET_CHAIN_CHANGED,
    chainId,
  });
}

// Send the user's decision back to the injected script via window.postMessage.
export function sendDecisionToInjected(decision: TxUserDecision): void {
  window.postMessage(
    {
      source: CONTENT_SOURCE,
      type: MESSAGE_TYPES.USER_DECISION,
      requestId: decision.requestId,
      decision: decision.decision,
    },
    window.location.origin,
  );
}

// Forward the user's decision to the background (for history recording).
export function forwardDecisionToBackground(decision: TxUserDecision): void {
  chrome.runtime.sendMessage({
    source: CONTENT_SOURCE,
    type: MESSAGE_TYPES.USER_DECISION,
    ...decision,
  });
}

// Set up the window.postMessage listener for injected -> content messages.
// Returns a cleanup function.
export function setupBridgeListener(
  onIntercepted: (request: InterceptedProviderRequest) => void,
  onChainChanged?: (chainId: number | undefined) => void,
): () => void {
  function listener(event: MessageEvent) {
    const data = event.data as BridgeMessage | undefined;
    // Only accept messages from the injected script.
    if (!data || data.source !== INJECTED_SOURCE) return;
    // Only accept same-origin messages.
    if (event.origin !== window.location.origin) return;

    if (data.type === MESSAGE_TYPES.PROVIDER_REQUEST_INTERCEPTED) {
      onIntercepted({
        requestId: data.requestId ?? '',
        method: data.method as string,
        params: data.params as unknown[],
        domain: data.domain as string,
        origin: data.origin as string,
        chainId: data.chainId,
      });
    } else if (data.type === MESSAGE_TYPES.WALLET_CHAIN_CHANGED) {
      onChainChanged?.(data.chainId);
    }
  }

  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}
