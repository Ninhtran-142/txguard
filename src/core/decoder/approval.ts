// Unlimited-approval detection and amount formatting.
//
// Phishing contracts frequently request an ERC20 approval of uint256 max (or a
// value very close to it), which lets the spender drain the victim's entire
// token balance. TxGuard flags any approval >= half of uint256 max as
// "unlimited" so the risk engine can surface a HIGH-severity warning.

export const UINT256_MAX = (1n << 256n) - 1n; // 2^256 - 1

// An approval is considered "unlimited" if it is at least half of uint256 max.
// The half-max threshold catches contracts that request values just below the
// true max (e.g. max - 1) which are effectively unlimited.
export function isUnlimitedApproval(amount: bigint): boolean {
  return amount >= UINT256_MAX / 2n;
}

// Format a raw bigint amount (in base units) into a human-readable string using
// the token's decimals, e.g. formatAmount(1500000n, 6) -> "1.5".
export function formatAmount(amount: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  const fractionStr = fraction
    .toString()
    .padStart(decimals, '0')
    .replace(/0+$/, '');
  return fractionStr ? `${whole}.${fractionStr}` : whole.toString();
}
