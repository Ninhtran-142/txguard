import { describe, it, expect } from 'vitest';
import { encodeFunctionData, parseAbi } from 'viem';
import { decodeTransaction } from '../core/decoder/decoder';
import {
  isUnlimitedApproval,
  formatAmount,
  UINT256_MAX,
} from '../core/decoder/approval';
import { ERC20_ABI, ERC721_ERC1155_APPROVAL_ABI } from '../core/decoder/abis';
import type { HexAddress } from '../shared/types';

// Helper to build a valid 20-byte (40 hex char) address from a repeated byte.
function addr(hex: string): HexAddress {
  return `0x${hex}` as HexAddress;
}

const SPENDER = addr('11'.repeat(20));
const RECIPIENT = addr('22'.repeat(20));
const FROM_ADDR = addr('33'.repeat(20));
const TOKEN = addr('aa'.repeat(20));
const SENDER = addr('bb'.repeat(20));
const OPERATOR = addr('cc'.repeat(20));

const AMOUNT = 1000n;

describe('decodeTransaction', () => {
  it('ERC20 approve decoded correctly', () => {
    const data = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [SPENDER, AMOUNT],
    });
    const decoded = decodeTransaction({ from: SENDER, to: TOKEN, data });

    expect(decoded.isDecoded).toBe(true);
    expect(decoded.actionType).toBe('ERC20_APPROVE');
    expect(decoded.to).toBe(TOKEN);
    expect(decoded.from).toBe(SENDER);
    expect(decoded.spender).toBe(SPENDER);
    expect(decoded.amount).toBe(AMOUNT);
    expect(decoded.isUnlimited).toBe(false);
  });

  it('ERC20 unlimited approve is flagged', () => {
    const data = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [SPENDER, UINT256_MAX],
    });
    const decoded = decodeTransaction({ from: SENDER, to: TOKEN, data });

    expect(decoded.actionType).toBe('ERC20_APPROVE');
    expect(decoded.amount).toBe(UINT256_MAX);
    expect(decoded.isUnlimited).toBe(true);
  });

  it('ERC20 transfer decoded correctly', () => {
    const data = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [RECIPIENT, AMOUNT],
    });
    const decoded = decodeTransaction({ from: SENDER, to: TOKEN, data });

    expect(decoded.isDecoded).toBe(true);
    expect(decoded.actionType).toBe('ERC20_TRANSFER');
    expect(decoded.recipient).toBe(RECIPIENT);
    expect(decoded.amount).toBe(AMOUNT);
  });

  it('ERC20 transferFrom decoded correctly', () => {
    const data = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'transferFrom',
      args: [FROM_ADDR, RECIPIENT, AMOUNT],
    });
    const decoded = decodeTransaction({ from: SENDER, to: TOKEN, data });

    expect(decoded.isDecoded).toBe(true);
    expect(decoded.actionType).toBe('ERC20_TRANSFER_FROM');
    expect(decoded.transferFrom).toBe(FROM_ADDR);
    expect(decoded.recipient).toBe(RECIPIENT);
    expect(decoded.amount).toBe(AMOUNT);
  });

  it('ERC20 increaseAllowance decoded correctly', () => {
    const data = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'increaseAllowance',
      args: [SPENDER, AMOUNT],
    });
    const decoded = decodeTransaction({ from: SENDER, to: TOKEN, data });

    expect(decoded.isDecoded).toBe(true);
    expect(decoded.actionType).toBe('ERC20_INCREASE_ALLOWANCE');
    expect(decoded.spender).toBe(SPENDER);
    expect(decoded.amount).toBe(AMOUNT);
  });

  it('ERC20 decreaseAllowance decoded correctly', () => {
    const data = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'decreaseAllowance',
      args: [SPENDER, AMOUNT],
    });
    const decoded = decodeTransaction({ from: SENDER, to: TOKEN, data });

    expect(decoded.isDecoded).toBe(true);
    expect(decoded.actionType).toBe('ERC20_DECREASE_ALLOWANCE');
    expect(decoded.spender).toBe(SPENDER);
    expect(decoded.amount).toBe(AMOUNT);
  });

  it('NFT setApprovalForAll true decoded correctly', () => {
    const data = encodeFunctionData({
      abi: ERC721_ERC1155_APPROVAL_ABI,
      functionName: 'setApprovalForAll',
      args: [OPERATOR, true],
    });
    const decoded = decodeTransaction({ from: SENDER, to: TOKEN, data });

    expect(decoded.isDecoded).toBe(true);
    expect(decoded.actionType).toBe('NFT_SET_APPROVAL_FOR_ALL');
    expect(decoded.spender?.toLowerCase()).toBe(OPERATOR);
    expect(decoded.approved).toBe(true);
  });

  it('NFT setApprovalForAll false decoded correctly', () => {
    const data = encodeFunctionData({
      abi: ERC721_ERC1155_APPROVAL_ABI,
      functionName: 'setApprovalForAll',
      args: [OPERATOR, false],
    });
    const decoded = decodeTransaction({ from: SENDER, to: TOKEN, data });

    expect(decoded.isDecoded).toBe(true);
    expect(decoded.actionType).toBe('NFT_SET_APPROVAL_FOR_ALL');
    expect(decoded.spender?.toLowerCase()).toBe(OPERATOR);
    expect(decoded.approved).toBe(false);
  });

  it('Unknown selector returns UNKNOWN_CONTRACT_CALL', () => {
    const data = encodeFunctionData({
      abi: parseAbi(['function foobar(uint256 x) returns (uint256)']),
      functionName: 'foobar',
      args: [123n],
    });
    const decoded = decodeTransaction({ from: SENDER, to: TOKEN, data });

    expect(decoded.isDecoded).toBe(false);
    expect(decoded.actionType).toBe('UNKNOWN_CONTRACT_CALL');
  });

  it('Native transfer detected when data is empty', () => {
    const decoded = decodeTransaction({
      from: SENDER,
      to: TOKEN,
      data: '0x',
      value: '0xde0b6b3a7640000',
    });

    expect(decoded.isDecoded).toBe(true);
    expect(decoded.actionType).toBe('NATIVE_TRANSFER');
    expect(decoded.value).toBe(BigInt('0xde0b6b3a7640000'));
  });

  it('Missing to address returns UNKNOWN', () => {
    const data = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [SPENDER, AMOUNT],
    });
    const decoded = decodeTransaction({ from: SENDER, data });

    expect(decoded.isDecoded).toBe(false);
    expect(decoded.actionType).toBe('UNKNOWN');
  });
});

describe('isUnlimitedApproval', () => {
  it('UINT256_MAX is unlimited', () => {
    expect(isUnlimitedApproval(UINT256_MAX)).toBe(true);
  });

  it('UINT256_MAX / 2 is unlimited', () => {
    expect(isUnlimitedApproval(UINT256_MAX / 2n)).toBe(true);
  });

  it('normal amount is not unlimited', () => {
    expect(isUnlimitedApproval(1000n)).toBe(false);
  });

  it('zero is not unlimited', () => {
    expect(isUnlimitedApproval(0n)).toBe(false);
  });
});

describe('formatAmount', () => {
  it('formats 1 token with 6 decimals', () => {
    expect(formatAmount(1000000n, 6)).toBe('1');
  });

  it('formats 1.5 tokens with 6 decimals', () => {
    expect(formatAmount(1500000n, 6)).toBe('1.5');
  });
});
