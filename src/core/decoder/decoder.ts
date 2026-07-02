// TxGuard transaction decoder.
//
// Parses EVM calldata into a structured DecodedTx. This module is pure and
// framework-independent: it never touches the network, never signs, and never
// modifies the original transaction request (rawTx is stored unchanged).
//
// Security note: decoding MUST NOT crash TxGuard. Any decode failure degrades
// to an UNKNOWN_CONTRACT_CALL so the risk engine can still warn the user rather
// than silently letting a dangerous request through.

import { decodeFunctionData } from 'viem';
import type {
  DecodedTx,
  HexAddress,
  HexString,
  TransactionRequestLike,
} from '../../shared/types';
import { SELECTORS } from './selectors';
import { ERC20_ABI, ERC721_ERC1155_APPROVAL_ABI } from './abis';
import { isUnlimitedApproval } from './approval';

/**
 * Decode an EVM transaction request into a structured representation.
 *
 * @param tx - The original (never modified) transaction request.
 * @param _chainId - Reserved for future chain-aware decoding; currently unused
 *   but kept on the signature so call sites do not need to change later.
 * @returns A DecodedTx describing the inferred action.
 */
export function decodeTransaction(
  tx: TransactionRequestLike,
  _chainId?: number,
): DecodedTx {
  // No destination address — neither a contract call nor a meaningful transfer.
  if (!tx.to) {
    return { isDecoded: false, actionType: 'UNKNOWN' };
  }

  const to = tx.to;
  const from = tx.from;

  // Empty calldata (missing or '0x') with a recipient is a native ETH transfer.
  if (!tx.data || tx.data === '0x') {
    return {
      isDecoded: true,
      actionType: 'NATIVE_TRANSFER',
      to,
      from,
      value: tx.value ? BigInt(tx.value) : 0n,
      rawTx: tx,
    };
  }

  // First 4 bytes (8 hex chars after the 0x prefix) = the function selector.
  const selector = tx.data.slice(0, 10) as HexString;

  try {
    switch (selector) {
      case SELECTORS.ERC20_APPROVE: {
        const decoded = decodeFunctionData({ abi: ERC20_ABI, data: tx.data });
        const args = (decoded.args ?? []) as readonly unknown[];
        const spender = args[0] as HexAddress;
        const amount = args[1] as bigint;
        return {
          isDecoded: true,
          actionType: 'ERC20_APPROVE',
          to,
          from,
          spender,
          amount,
          isUnlimited: isUnlimitedApproval(amount),
          selector,
          rawTx: tx,
        };
      }
      case SELECTORS.ERC20_TRANSFER: {
        const decoded = decodeFunctionData({ abi: ERC20_ABI, data: tx.data });
        const args = (decoded.args ?? []) as readonly unknown[];
        const recipient = args[0] as HexAddress;
        const amount = args[1] as bigint;
        return {
          isDecoded: true,
          actionType: 'ERC20_TRANSFER',
          to,
          from,
          recipient,
          amount,
          selector,
          rawTx: tx,
        };
      }
      case SELECTORS.ERC20_TRANSFER_FROM: {
        const decoded = decodeFunctionData({ abi: ERC20_ABI, data: tx.data });
        const args = (decoded.args ?? []) as readonly unknown[];
        const transferFrom = args[0] as HexAddress;
        const recipient = args[1] as HexAddress;
        const amount = args[2] as bigint;
        return {
          isDecoded: true,
          actionType: 'ERC20_TRANSFER_FROM',
          to,
          from,
          transferFrom,
          recipient,
          amount,
          selector,
          rawTx: tx,
        };
      }
      case SELECTORS.ERC20_INCREASE_ALLOWANCE: {
        const decoded = decodeFunctionData({ abi: ERC20_ABI, data: tx.data });
        const args = (decoded.args ?? []) as readonly unknown[];
        const spender = args[0] as HexAddress;
        const addedValue = args[1] as bigint;
        return {
          isDecoded: true,
          actionType: 'ERC20_INCREASE_ALLOWANCE',
          to,
          from,
          spender,
          amount: addedValue,
          isUnlimited: isUnlimitedApproval(addedValue),
          selector,
          rawTx: tx,
        };
      }
      case SELECTORS.ERC20_DECREASE_ALLOWANCE: {
        const decoded = decodeFunctionData({ abi: ERC20_ABI, data: tx.data });
        const args = (decoded.args ?? []) as readonly unknown[];
        const spender = args[0] as HexAddress;
        const subtractedValue = args[1] as bigint;
        return {
          isDecoded: true,
          actionType: 'ERC20_DECREASE_ALLOWANCE',
          to,
          from,
          spender,
          amount: subtractedValue,
          selector,
          rawTx: tx,
        };
      }
      case SELECTORS.SET_APPROVAL_FOR_ALL: {
        const decoded = decodeFunctionData({
          abi: ERC721_ERC1155_APPROVAL_ABI,
          data: tx.data,
        });
        const args = (decoded.args ?? []) as readonly unknown[];
        const operator = args[0] as HexAddress;
        const approved = args[1] as boolean;
        return {
          isDecoded: true,
          actionType: 'NFT_SET_APPROVAL_FOR_ALL',
          to,
          from,
          spender: operator,
          approved,
          selector,
          rawTx: tx,
        };
      }
      default: {
        // Selector did not match any known MVP function — treat as unknown.
        return {
          isDecoded: false,
          actionType: 'UNKNOWN_CONTRACT_CALL',
          to,
          selector,
          rawTx: tx,
        };
      }
    }
  } catch {
    // Decode failure must never crash TxGuard — degrade to an unknown call.
    return {
      isDecoded: false,
      actionType: 'UNKNOWN_CONTRACT_CALL',
      to,
      selector,
      rawTx: tx,
    };
  }
}
