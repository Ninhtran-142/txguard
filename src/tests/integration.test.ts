import { describe, it, expect } from 'vitest';
import { encodeFunctionData } from 'viem';
import { decodeTransaction } from '../core/decoder/decoder';
import { evaluateRisk } from '../core/risk/evaluator';
import { ERC20_ABI } from '../core/decoder/abis';
import { UINT256_MAX } from '../core/decoder/approval';
import type { ChainConfig, TxGuardSettings, HexAddress } from '../shared/types';

// End-to-end integration test: intercept → decode → risk → decision.
// Simulates the full analysis pipeline without the actual extension runtime.

const SETTINGS: TxGuardSettings = {
  enabled: true,
  warnOnUnknownCalls: true,
  warnOnPersonalSign: true,
  blockHighRiskByDefault: false,
};

const SAMPLE_CHAIN: ChainConfig = {
  chainId: 1,
  name: 'Ethereum',
  rpcUrl: 'https://eth.llamarpc.com',
  nativeCurrencySymbol: 'ETH',
  nativeCurrencyDecimals: 18,
};

const SPENDER = '0x1111111111111111111111111111111111111111' as HexAddress;
const TOKEN = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as HexAddress;
const SENDER = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as HexAddress;

describe('Integration: intercept → decode → risk → decision', () => {
  it('unlimited ERC20 approval flows through the full pipeline', () => {
    // 1. Simulate intercepted eth_sendTransaction with unlimited approve.
    const calldata = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [SPENDER, UINT256_MAX],
    });

    // 2. Decode the transaction.
    const decoded = decodeTransaction(
      { from: SENDER, to: TOKEN, data: calldata },
      1,
    );
    expect(decoded.isDecoded).toBe(true);
    expect(decoded.actionType).toBe('ERC20_APPROVE');
    expect(decoded.isUnlimited).toBe(true);

    // 3. Evaluate risk.
    const evaluation = evaluateRisk(decoded, SAMPLE_CHAIN, SETTINGS);
    expect(evaluation.riskLevel).toBe('HIGH');
    expect(evaluation.findings.length).toBeGreaterThan(0);
    expect(evaluation.findings.some((f) => f.severity === 'HIGH')).toBe(true);
    expect(evaluation.summary).toContain('unlimited');

    // 4. Simulate user decision (Continue or Cancel).
    // In the real extension, the overlay would call onContinue/onCancel.
    // Here we just verify the analysis result is complete.
    const analysis = {
      requestId: 'test-req-1',
      riskLevel: evaluation.riskLevel,
      findings: evaluation.findings,
      summary: evaluation.summary,
      decoded,
      actionType: decoded.actionType,
      timestamp: Date.now(),
      domain: 'test.dapp.com',
      chainId: 1,
    };
    expect(analysis.riskLevel).toBe('HIGH');
    expect(analysis.actionType).toBe('ERC20_APPROVE');
  });

  it('simple transfer is LOW risk through the full pipeline', () => {
    const calldata = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [SPENDER, 1000n],
    });

    const decoded = decodeTransaction(
      { from: SENDER, to: TOKEN, data: calldata },
      1,
    );
    const evaluation = evaluateRisk(decoded, SAMPLE_CHAIN, SETTINGS);
    expect(evaluation.riskLevel).toBe('LOW');
  });

  it('unknown call with missing RPC escalates appropriately', () => {
    const decoded = decodeTransaction(
      {
        from: SENDER,
        to: TOKEN,
        data: '0xdeadbeef0000000000000000000000000000000000000000000000000000000000000000',
      },
      1,
    );
    // No RPC configured → missing RPC finding + unknown call warning.
    const evaluation = evaluateRisk(decoded, undefined, SETTINGS);
    expect(evaluation.riskLevel).toBe('HIGH'); // unknown call with warnOnUnknownCalls
    expect(
      evaluation.findings.some((f) => f.title === 'RPC not configured'),
    ).toBe(true);
  });
});
