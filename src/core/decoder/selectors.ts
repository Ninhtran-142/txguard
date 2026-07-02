// TxGuard transaction decoder — function selector constants.
//
// The selector is the first 4 bytes (8 hex chars after the 0x prefix) of an
// EVM calldata payload and identifies which contract function is being called.
// These are the only selectors TxGuard knows how to decode in the MVP; any
// other selector is treated as an unknown contract call.

export const SELECTORS = {
  ERC20_APPROVE: '0x095ea7b3',
  ERC20_TRANSFER: '0xa9059cbb',
  ERC20_TRANSFER_FROM: '0x23b872dd',
  ERC20_INCREASE_ALLOWANCE: '0x39509351',
  ERC20_DECREASE_ALLOWANCE: '0xa457c2d7',
  SET_APPROVAL_FOR_ALL: '0xa22cb465',
} as const;
