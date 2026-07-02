import type {
  DecodedTx,
  RiskFinding,
  TxGuardSettings,
} from '../../shared/types';
import { createFinding } from './findings';

type Findings = ReturnType<typeof createFinding>[];

// Evaluate risk for signature requests.
//
// personal_sign -> MEDIUM, or HIGH if warnOnPersonalSign AND the domain is not
//   in the user's allowlist (unknown domain) per SPEC 18.2.
// Unknown typed data -> MEDIUM.
// Permit-like with unlimited -> HIGH.
// Permit-like with finite -> MEDIUM.
export function evaluateSignatureRisk(
  decoded: DecodedTx,
  _domain: string,
  settings: TxGuardSettings,
  domainKnown = false,
): Findings {
  const findings: RiskFinding[] = [];

  if (decoded.actionType === 'PERSONAL_SIGNATURE') {
    // Personal signatures can authorize actions on the user's behalf.
    // Escalate to HIGH only for unknown domains when the setting is on.
    if (settings.warnOnPersonalSign && !domainKnown) {
      findings.push(
        createFinding(
          'HIGH',
          'Personal signature from an unknown site',
          'An unknown dApp is asking you to sign a personal message. Signing can authorize actions on your behalf.',
          'Cancel unless you fully understand what you are signing and trust this site.',
        ),
      );
    } else {
      findings.push(
        createFinding(
          'MEDIUM',
          'Personal signature request',
          'A dApp is asking you to sign a personal message.',
          'Verify the message content before signing.',
        ),
      );
    }
  }

  if (decoded.actionType === 'TYPED_DATA_SIGNATURE') {
    if (decoded.isUnlimited) {
      // Permit-like typed data with unlimited value — HIGH risk.
      findings.push(
        createFinding(
          'HIGH',
          'Unlimited permit signature',
          'You are signing a permit that grants unlimited token allowance. The spender can drain your entire balance.',
          'Cancel unless you fully trust the spender. Consider a finite permit instead.',
        ),
      );
    } else if (decoded.selector) {
      // Permit-like with finite value — MEDIUM.
      findings.push(
        createFinding(
          'MEDIUM',
          'Permit signature request',
          'You are signing a permit that grants a finite token allowance.',
          'Verify the spender and amount before signing.',
        ),
      );
    } else {
      // Unknown typed data — MEDIUM.
      findings.push(
        createFinding(
          'MEDIUM',
          'Typed data signature request',
          'A dApp is asking you to sign typed data. This can authorize actions on your behalf.',
          'Review the typed data carefully before signing.',
        ),
      );
    }
  }

  return findings;
}
