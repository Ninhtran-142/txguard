import type { DecodedTx, TxGuardSettings } from '../../shared/types';
import { createFinding } from './findings';

// Threshold for a "very large" increaseAllowance (10^30 base units).
const LARGE_INCREASE_THRESHOLD = 10n ** 30n;

type Findings = ReturnType<typeof createFinding>[];

// ── HIGH risk rules ──────────────────────────────────────────────

// Unlimited ERC20 approval — spender can drain the entire token balance.
export function checkUnlimitedApproval(decoded: DecodedTx): Findings {
  if (decoded.actionType === 'ERC20_APPROVE' && decoded.isUnlimited) {
    return [
      createFinding(
        'HIGH',
        'Unlimited token approval',
        'You are granting unlimited token allowance. The spender can drain your entire token balance at any time.',
        'Cancel unless you fully trust the contract. Consider a finite approval instead.',
      ),
    ];
  }
  return [];
}

// NFT setApprovalForAll(true) — operator can transfer ALL NFTs in a collection.
export function checkNftApprovalForAll(decoded: DecodedTx): Findings {
  if (
    decoded.actionType === 'NFT_SET_APPROVAL_FOR_ALL' &&
    decoded.approved === true
  ) {
    return [
      createFinding(
        'HIGH',
        'NFT approval for all',
        'You are approving an operator to transfer ALL your NFTs in this collection.',
        'Cancel unless you fully trust the operator.',
      ),
    ];
  }
  return [];
}

// Very large increaseAllowance — effectively unlimited.
export function checkLargeIncreaseAllowance(decoded: DecodedTx): Findings {
  if (
    decoded.actionType === 'ERC20_INCREASE_ALLOWANCE' &&
    (decoded.amount ?? 0n) >= LARGE_INCREASE_THRESHOLD
  ) {
    return [
      createFinding(
        'HIGH',
        'Very large allowance increase',
        'The allowance increase is extremely large and effectively unlimited.',
        'Cancel unless you understand why such a large allowance is needed.',
      ),
    ];
  }
  return [];
}

// Unknown contract call + warnOnUnknownCalls setting enabled.
export function checkUnknownCall(
  decoded: DecodedTx,
  settings: TxGuardSettings,
): Findings {
  if (
    decoded.actionType === 'UNKNOWN_CONTRACT_CALL' &&
    settings.warnOnUnknownCalls
  ) {
    return [
      createFinding(
        'HIGH',
        'Unknown contract call',
        'TxGuard could not decode this transaction. The calldata does not match any known function.',
        'Cancel if you do not understand what this transaction does.',
      ),
    ];
  }
  return [];
}

// ── MEDIUM risk rules ────────────────────────────────────────────

// Finite (non-zero, non-unlimited) ERC20 approval.
export function checkFiniteApproval(decoded: DecodedTx): Findings {
  if (
    decoded.actionType === 'ERC20_APPROVE' &&
    !decoded.isUnlimited &&
    (decoded.amount ?? 0n) > 0n
  ) {
    return [
      createFinding(
        'MEDIUM',
        'Finite token approval',
        'You are granting a token allowance to a spender.',
        'Verify the spender address and amount before continuing.',
      ),
    ];
  }
  return [];
}

// Chain switch request. SPEC 18.4: switching to a configured (known) chain is
// LOW risk; switching to an unknown chain is MEDIUM.
export function checkChainSwitch(
  decoded: DecodedTx,
  configuredChainIds?: Set<number>,
): Findings {
  if (decoded.actionType === 'CHAIN_SWITCH') {
    const targetKnown =
      decoded.targetChainId !== undefined &&
      configuredChainIds?.has(decoded.targetChainId) === true;
    if (targetKnown) {
      return [
        createFinding(
          'LOW',
          'Chain switch to a known chain',
          'A dApp is requesting to switch your wallet to a chain you have configured.',
          'Verify the target chain is the one you expect.',
        ),
      ];
    }
    return [
      createFinding(
        'MEDIUM',
        'Chain switch request',
        'A dApp is requesting to switch your wallet to a chain that is not configured in TxGuard.',
        'Verify the target chain before continuing. Consider adding its RPC in Settings.',
      ),
    ];
  }
  return [];
}

// Contract has no code at the target address (likely an EOA or wrong address).
// SPEC 18.3: a contract call to an address with no code is suspicious.
export function checkNoCode(decoded: DecodedTx, hasCode?: boolean): Findings {
  // Only flag when we actually checked code and it is empty, for contract calls.
  if (
    hasCode === false &&
    decoded.actionType !== 'NATIVE_TRANSFER' &&
    decoded.actionType !== 'PERSONAL_SIGNATURE' &&
    decoded.actionType !== 'TYPED_DATA_SIGNATURE' &&
    decoded.actionType !== 'CHAIN_SWITCH' &&
    decoded.actionType !== 'UNKNOWN'
  ) {
    return [
      createFinding(
        'MEDIUM',
        'Target address has no contract code',
        'The call targets an address with no deployed code. This is unusual for a contract interaction.',
        'Verify the target address is correct before continuing.',
      ),
    ];
  }
  return [];
}

// Missing RPC — TxGuard cannot enrich the analysis with on-chain data.
export function checkMissingRpc(chainConfig: unknown): Findings {
  if (chainConfig === undefined) {
    return [
      createFinding(
        'MEDIUM',
        'RPC not configured',
        'No RPC endpoint is configured for this chain. TxGuard cannot fetch token metadata or verify contract code.',
        'Add an RPC endpoint in Settings for better analysis.',
      ),
    ];
  }
  return [];
}

// ── LOW risk rules ───────────────────────────────────────────────

// Simple native or ERC20 transfer decoded successfully.
export function checkSimpleTransfer(decoded: DecodedTx): Findings {
  if (
    (decoded.actionType === 'NATIVE_TRANSFER' ||
      decoded.actionType === 'ERC20_TRANSFER') &&
    decoded.isDecoded
  ) {
    return [
      createFinding(
        'LOW',
        'Token transfer',
        'This is a standard token transfer.',
        'Verify the recipient address before continuing.',
      ),
    ];
  }
  return [];
}

// NFT setApprovalForAll(false) — revoking approval (safe).
export function checkNftApprovalRevoke(decoded: DecodedTx): Findings {
  if (
    decoded.actionType === 'NFT_SET_APPROVAL_FOR_ALL' &&
    decoded.approved === false
  ) {
    return [
      createFinding(
        'LOW',
        'NFT approval revoked',
        'You are revoking an operator approval for all NFTs in this collection.',
        'This is a safe operation.',
      ),
    ];
  }
  return [];
}

// ERC20 approve with amount zero — revoking an existing approval.
export function checkApprovalZero(decoded: DecodedTx): Findings {
  if (decoded.actionType === 'ERC20_APPROVE' && (decoded.amount ?? 0n) === 0n) {
    return [
      createFinding(
        'LOW',
        'Approval revoked (amount zero)',
        'You are revoking an existing token approval by setting the allowance to zero.',
        'This is a safe operation.',
      ),
    ];
  }
  return [];
}

// decreaseAllowance — reducing an existing approval (safe direction).
export function checkDecreaseAllowance(decoded: DecodedTx): Findings {
  if (decoded.actionType === 'ERC20_DECREASE_ALLOWANCE') {
    return [
      createFinding(
        'LOW',
        'Allowance decreased',
        'You are decreasing an existing token allowance.',
        'This is generally a safe operation.',
      ),
    ];
  }
  return [];
}
