import type { DecodedTx, TxActionType } from '../../shared/types';

// Detect permit-like structures in typed data (best-effort, no AI).
// Returns true if the typed data looks like a Permit, PermitSingle, or
// PermitBatch struct with an unlimited or suspicious value.
export interface PermitDetection {
  isPermit: boolean;
  isUnlimited: boolean;
  permitType?: 'Permit' | 'PermitSingle' | 'PermitBatch';
}

// Check if a value (as string or number) represents an unlimited amount.
function checkUnlimitedValue(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const bigVal = BigInt(value);
    // Half of uint256 max.
    const halfMax = (1n << 256n) / 2n;
    return bigVal >= halfMax;
  } catch {
    return false;
  }
}

// Detect permit structures in EIP-712 typed data.
export function detectPermit(typedData: unknown): PermitDetection {
  if (!typedData || typeof typedData !== 'object') {
    return { isPermit: false, isUnlimited: false };
  }

  const data = typedData as Record<string, unknown>;

  // Permit2 PermitSingle: { details: { permit: { amount } }, spender, ... }
  if (data.details && typeof data.details === 'object') {
    const details = data.details as Record<string, unknown>;
    if (details.permit && typeof details.permit === 'object') {
      const permit = details.permit as Record<string, unknown>;
      const amount = permit.amount as string | undefined;
      return {
        isPermit: true,
        permitType: 'PermitSingle',
        isUnlimited: checkUnlimitedValue(amount),
      };
    }
    // PermitBatch: details has an array of permits
    if (Array.isArray(details)) {
      return { isPermit: true, permitType: 'PermitBatch', isUnlimited: false };
    }
  }

  // Standard Permit: { owner, spender, value, nonce, deadline }
  if (data.owner && data.spender && data.value !== undefined) {
    return {
      isPermit: true,
      permitType: 'Permit',
      isUnlimited: checkUnlimitedValue(data.value as string | undefined),
    };
  }

  return { isPermit: false, isUnlimited: false };
}

// Decode a signature request (personal_sign or typed data) into a DecodedTx.
// Security note: this only classifies the request — it never stores or
// transmits the full message payload.
export function decodeSignature(
  method: string,
  params: unknown[],
  _domain: string,
): DecodedTx {
  let actionType: TxActionType;
  let isUnlimited = false;
  let permitType: string | undefined;

  if (method === 'personal_sign') {
    actionType = 'PERSONAL_SIGNATURE';
  } else {
    // eth_signTypedData, _v3, _v4
    actionType = 'TYPED_DATA_SIGNATURE';

    // Typed data is usually params[1] (params[0] is the address).
    const typedData = params[1];
    const detection = detectPermit(typedData);
    if (detection.isPermit) {
      isUnlimited = detection.isUnlimited;
      permitType = detection.permitType;
    }
  }

  return {
    isDecoded: true,
    actionType,
    // Do NOT include the full message/payload in the decoded result.
    // Only metadata needed for risk evaluation and display.
    isUnlimited,
    // Store permit type as the selector for display purposes.
    selector: permitType as `0x${string}` | undefined,
  };
}
