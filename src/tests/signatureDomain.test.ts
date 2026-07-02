import { describe, it, expect } from 'vitest';
import { decodeSignature } from '../core/decoder/signatureDecoder';
import { evaluateSignatureRisk } from '../core/risk/signatureRules';
import type { TxGuardSettings } from '../shared/types';

const SETTINGS: TxGuardSettings = {
  enabled: true,
  warnOnUnknownCalls: true,
  warnOnPersonalSign: true,
  blockHighRiskByDefault: false,
};

describe('personal_sign domain awareness (SPEC 18.2)', () => {
  it('personal_sign on an unknown domain with warnOnPersonalSign = HIGH', () => {
    const decoded = decodeSignature(
      'personal_sign',
      ['0xdeadbeef', '0x1234'],
      'unknown.com',
    );
    const findings = evaluateSignatureRisk(
      decoded,
      'unknown.com',
      SETTINGS,
      false,
    );
    expect(findings.some((f) => f.severity === 'HIGH')).toBe(true);
  });

  it('personal_sign on a known (allowlisted) domain = MEDIUM', () => {
    const decoded = decodeSignature(
      'personal_sign',
      ['0xdeadbeef', '0x1234'],
      'trusted.com',
    );
    const findings = evaluateSignatureRisk(
      decoded,
      'trusted.com',
      SETTINGS,
      true,
    );
    expect(findings.some((f) => f.severity === 'MEDIUM')).toBe(true);
    expect(findings.some((f) => f.severity === 'HIGH')).toBe(false);
  });

  it('personal_sign on unknown domain without warnOnPersonalSign = MEDIUM', () => {
    const decoded = decodeSignature(
      'personal_sign',
      ['0xdeadbeef', '0x1234'],
      'unknown.com',
    );
    const noWarn = { ...SETTINGS, warnOnPersonalSign: false };
    const findings = evaluateSignatureRisk(
      decoded,
      'unknown.com',
      noWarn,
      false,
    );
    expect(findings.some((f) => f.severity === 'MEDIUM')).toBe(true);
    expect(findings.some((f) => f.severity === 'HIGH')).toBe(false);
  });
});
