// TxGuard shared constants.

/** Maximum number of transaction check history items kept locally. */
export const MAX_TX_HISTORY = 100;

/** Methods intercepted by the injected provider hook. */
export const INTERCEPTED_METHODS = new Set<string>([
  'eth_sendTransaction',
  'eth_signTypedData',
  'eth_signTypedData_v3',
  'eth_signTypedData_v4',
  'personal_sign',
  'wallet_switchEthereumChain',
]);

/** EIP-1193 user rejection error code. */
export const USER_REJECTION_CODE = 4001;

/** Default timeout (ms) for waiting on a user decision. */
export const DECISION_TIMEOUT_MS = 60_000;
