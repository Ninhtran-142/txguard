// TxGuard extension message types and source constants.
//
// Used by the messaging bridge: injected <-> content <-> background.
// Security note: every message must include a `source` and `type`. Receivers
// must validate `source` and reject unknown sources. Do not trust
// page-provided data without validating request shapes.

/** Message sources — used to validate window.postMessage origin. */
export const MESSAGE_SOURCES = {
  TXGUARD_INJECTED: 'TXGUARD_INJECTED',
  TXGUARD_CONTENT: 'TXGUARD_CONTENT',
  TXGUARD_BACKGROUND: 'TXGUARD_BACKGROUND',
  TXGUARD_POPUP: 'TXGUARD_POPUP',
  TXGUARD_SETTINGS: 'TXGUARD_SETTINGS',
} as const;

/** Message types exchanged across the bridge. */
export const MESSAGE_TYPES = {
  // Phase 3 — RPC validation
  RPC_TEST_REQUEST: 'RPC_TEST_REQUEST',
  RPC_TEST_RESULT: 'RPC_TEST_RESULT',
  // Phase 4 — provider interception & decisions
  PROVIDER_REQUEST_INTERCEPTED: 'PROVIDER_REQUEST_INTERCEPTED',
  ANALYZE_PROVIDER_REQUEST: 'ANALYZE_PROVIDER_REQUEST',
  ANALYSIS_RESULT: 'ANALYSIS_RESULT',
  USER_DECISION: 'USER_DECISION',
  // Phase 9 — popup state
  GET_POPUP_STATE: 'GET_POPUP_STATE',
  CLEAR_HISTORY: 'CLEAR_HISTORY',
  // Wallet chain detection — injected -> content -> background
  WALLET_CHAIN_CHANGED: 'WALLET_CHAIN_CHANGED',
} as const;

export type MessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES];
