import { describe, it, expect } from 'vitest';
import {
  decodeSignature,
  detectPermit,
} from '../core/decoder/signatureDecoder';
import { evaluateSignatureRisk } from '../core/risk/signatureRules';
import type { TxGuardSettings } from '../shared/types';

const SETTINGS: TxGuardSettings = {
  enabled: true,
  warnOnUnknownCalls: true,
  warnOnPersonalSign: true,
  blockHighRiskByDefault: false,
};

describe('Signature handling', () => {
  it('personal_sign detected correctly', () => {
    const decoded = decodeSignature(
      'personal_sign',
      ['0xdeadbeef', '0x1234'],
      'example.com',
    );
    expect(decoded.actionType).toBe('PERSONAL_SIGNATURE');
    expect(decoded.isDecoded).toBe(true);
  });

  it('eth_signTypedData_v4 detected correctly', () => {
    const typedData = {
      types: {},
      primaryType: 'Test',
      message: { foo: 'bar' },
    };
    const decoded = decodeSignature(
      'eth_signTypedData_v4',
      ['0x1234', JSON.stringify(typedData)],
      'example.com',
    );
    expect(decoded.actionType).toBe('TYPED_DATA_SIGNATURE');
    expect(decoded.isDecoded).toBe(true);
  });

  it('Permit struct detected', () => {
    const typedData = {
      owner: '0x1111',
      spender: '0x2222',
      value: '1000000000000000000',
      nonce: '0',
      deadline: '9999999999',
    };
    const detection = detectPermit(typedData);
    expect(detection.isPermit).toBe(true);
    expect(detection.permitType).toBe('Permit');
    expect(detection.isUnlimited).toBe(false);
  });

  it('PermitSingle detected', () => {
    const halfMax = ((1n << 256n) / 2n).toString();
    const typedData = {
      details: {
        permit: { amount: halfMax },
      },
      spender: '0x2222',
      nonce: '0',
      deadline: '9999999999',
    };
    const detection = detectPermit(typedData);
    expect(detection.isPermit).toBe(true);
    expect(detection.permitType).toBe('PermitSingle');
    expect(detection.isUnlimited).toBe(true);
  });

  it('Permit with unlimited value = HIGH', () => {
    const maxUint = ((1n << 256n) - 1n).toString();
    const typedData = {
      owner: '0x1111',
      spender: '0x2222',
      value: maxUint,
      nonce: '0',
      deadline: '9999999999',
    };
    const decoded = decodeSignature(
      'eth_signTypedData_v4',
      ['0x1234', typedData],
      'example.com',
    );
    expect(decoded.isUnlimited).toBe(true);
    const findings = evaluateSignatureRisk(decoded, 'example.com', SETTINGS);
    expect(findings.some((f) => f.severity === 'HIGH')).toBe(true);
  });

  it('Permit with finite value = MEDIUM', () => {
    const typedData = {
      owner: '0x1111',
      spender: '0x2222',
      value: '1000000000000000000',
      nonce: '0',
      deadline: '9999999999',
    };
    const decoded = decodeSignature(
      'eth_signTypedData_v4',
      ['0x1234', typedData],
      'example.com',
    );
    expect(decoded.isUnlimited).toBe(false);
    const findings = evaluateSignatureRisk(decoded, 'example.com', SETTINGS);
    expect(findings.some((f) => f.severity === 'MEDIUM')).toBe(true);
  });

  it('unknown typed data = MEDIUM', () => {
    const typedData = { types: {}, primaryType: 'Foo', message: {} };
    const decoded = decodeSignature(
      'eth_signTypedData_v4',
      ['0x1234', typedData],
      'example.com',
    );
    const findings = evaluateSignatureRisk(decoded, 'example.com', SETTINGS);
    expect(findings.some((f) => f.severity === 'MEDIUM')).toBe(true);
  });

  it('personal_sign with warnOnPersonalSign = HIGH', () => {
    const decoded = decodeSignature(
      'personal_sign',
      ['0xdeadbeef', '0x1234'],
      'unknown.com',
    );
    const findings = evaluateSignatureRisk(decoded, 'unknown.com', SETTINGS);
    expect(findings.some((f) => f.severity === 'HIGH')).toBe(true);
  });

  it('personal_sign without warnOnPersonalSign = MEDIUM', () => {
    const decoded = decodeSignature(
      'personal_sign',
      ['0xdeadbeef', '0x1234'],
      'unknown.com',
    );
    const noWarnSettings = { ...SETTINGS, warnOnPersonalSign: false };
    const findings = evaluateSignatureRisk(
      decoded,
      'unknown.com',
      noWarnSettings,
    );
    expect(findings.some((f) => f.severity === 'MEDIUM')).toBe(true);
    expect(findings.some((f) => f.severity === 'HIGH')).toBe(false);
  });

  it('non-permit typed data not flagged as permit', () => {
    const typedData = { foo: 'bar', baz: 123 };
    const detection = detectPermit(typedData);
    expect(detection.isPermit).toBe(false);
  });
});
