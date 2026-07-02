// TxGuard content script entry point.
//
// Runs in the isolated world on every page (document_start). Bridges messages
// between the injected provider hook (page main-world context) and the
// background service worker.
//
// Flow:
// 1. Inject providerHook.ts into the page main world.
// 2. Listen for PROVIDER_REQUEST_INTERCEPTED from the injected script.
// 3. Forward to background for analysis -> receive ANALYSIS_RESULT + policy.
// 4. Act on the policy:
//    - ASK_USER: show the warning overlay; on decision, send USER_DECISION to
//      the injected script (resolve/reject the request) and the background.
//    - CONTINUE (TxGuard disabled): bypass the overlay and forward the
//      original request unchanged. No overlay, no extra history update.
//    - CANCEL (blockHighRiskByDefault): bypass the overlay and reject with
//      EIP-1193 code 4001. History was already stored as CANCELLED_BY_POLICY.
// 5. Forward WALLET_CHAIN_CHANGED from the injected script to the background.

import {
  injectProviderHook,
  setupBridgeListener,
  forwardToBackground,
  sendDecisionToInjected,
  forwardDecisionToBackground,
  forwardChainChangedToBackground,
} from './pageBridge';
import { showOverlay } from './overlay/overlayRoot';
import type { InterceptedProviderRequest } from '../shared/types';

console.log('TxGuard content script loaded');

// Inject the provider hook into the page main world as early as possible.
injectProviderHook();

// Set up the message bridge: injected -> content -> background.
setupBridgeListener(
  async (request: InterceptedProviderRequest) => {
    // Forward the intercepted request to the background for analysis + policy.
    const result = await forwardToBackground(request);
    if (!result) return;

    const { analysis, policy } = result;

    if (policy === 'CONTINUE') {
      // TxGuard is disabled: forward the original request unchanged. The
      // injected hook calls originalRequest(args) — tx params are never
      // modified. No overlay, no history update (background stored nothing).
      sendDecisionToInjected({ requestId: request.requestId, decision: 'CONTINUE' });
      return;
    }

    if (policy === 'CANCEL') {
      // Policy cancel (blockHighRiskByDefault + HIGH). Reject with 4001 via
      // the injected hook. No overlay. History already recorded by background.
      sendDecisionToInjected({ requestId: request.requestId, decision: 'CANCEL' });
      return;
    }

    // policy === 'ASK_USER': show the warning overlay and wait for a decision.
    if (!analysis) return;
    showOverlay(analysis, (decision) => {
      const userDecision = {
        requestId: request.requestId,
        decision,
      };
      // Send to injected script (resolves/rejects the provider request).
      sendDecisionToInjected(userDecision);
      // Send to background (records history outcome).
      forwardDecisionToBackground(userDecision);
    });
  },
  // Forward wallet chain changes so the background can cache the chain ID
  // for popup display and chain-config matching.
  (chainId) => forwardChainChangedToBackground(chainId),
);
