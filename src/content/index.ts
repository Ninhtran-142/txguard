// TxGuard content script entry point.
//
// Runs in the isolated world on every page (document_start). Bridges messages
// between the injected provider hook (page main-world context) and the
// background service worker.
//
// Flow:
// 1. Inject providerHook.ts into the page main world.
// 2. Listen for PROVIDER_REQUEST_INTERCEPTED from the injected script.
// 3. Forward to background for analysis -> receive ANALYSIS_RESULT.
// 4. Show the warning overlay with the analysis.
// 5. When the user decides (Continue/Cancel), send USER_DECISION to both
//    the injected script (to resolve/reject the request) and the background
//    (to record history).
// 6. Forward WALLET_CHAIN_CHANGED from the injected script to the background.

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
    // Forward the intercepted request to the background for analysis.
    const analysis = await forwardToBackground(request);
    if (analysis) {
      // Show the warning overlay. When the user decides, send the decision
      // to both the injected script (to resolve/reject the request) and the
      // background (to record history).
      showOverlay(analysis, (decision) => {
        const userDecision = {
          requestId: request.requestId,
          decision,
        };
        // Send to injected script (resolves/rejects the provider request).
        sendDecisionToInjected(userDecision);
        // Send to background (records history).
        forwardDecisionToBackground(userDecision);
      });
    }
  },
  // Forward wallet chain changes so the background can cache the chain ID
  // for popup display and chain-config matching.
  (chainId) => forwardChainChangedToBackground(chainId),
);
