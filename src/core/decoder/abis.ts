// Minimal ERC20 / ERC721 / ERC1155 ABIs used for calldata decoding and
// read-only token metadata fetches. Only the functions TxGuard inspects are
// declared here — TxGuard never calls mutating functions and never signs.

import { parseAbi } from 'viem';

// ERC20 approval and transfer functions, decoded from eth_sendTransaction
// calldata. Used by the decoder to extract spender / recipient / amounts.
export const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount)',
  'function increaseAllowance(address spender, uint256 addedValue)',
  'function decreaseAllowance(address spender, uint256 subtractedValue)',
  'function transfer(address to, uint256 amount)',
  'function transferFrom(address from, address to, uint256 amount)',
]);

// ERC721 / ERC1155 blanket approval. setApprovalForAll(operator, true) grants
// an operator control over ALL of an account's tokens of a collection — a
// common phishing vector that the risk engine flags as HIGH.
export const ERC721_ERC1155_APPROVAL_ABI = parseAbi([
  'function setApprovalForAll(address operator, bool approved)',
]);

// Read-only ERC20 metadata (name, symbol, decimals). Used by Phase 6 RPC reads
// to render human-readable amounts; not used by the decoder itself.
export const ERC20_METADATA_ABI = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
]);
