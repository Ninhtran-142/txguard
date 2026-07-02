import type {
  ChainConfig,
  DecodedTx,
  RiskFinding,
  RiskLevel,
  TxGuardSettings,
  HexAddress,
} from '../../shared/types';
import { formatAmount } from '../decoder/approval';
import * as rules from './rules';

export interface RiskEvaluation {
  riskLevel: RiskLevel;
  findings: RiskFinding[];
  summary: string;
}

/** Optional analysis-time inputs that influence rule behaviour. */
export interface RiskOptions {
  /** Set of chain IDs the user has configured (for chain-switch risk). */
  configuredChainIds?: Set<number>;
  /** Whether eth_getCode found code at the target address (undefined = unchecked). */
  hasCode?: boolean;
}

/**
 * Rule-based risk evaluator. No AI scoring — all rules are deterministic.
 *
 * @param decoded - The decoded transaction from the decoder.
 * @param chainConfig - The chain config for the current chain (undefined if missing).
 * @param settings - User settings that influence rule behaviour.
 * @param options - Analysis-time inputs (configured chain IDs, code presence).
 */
export function evaluateRisk(
  decoded: DecodedTx,
  chainConfig: ChainConfig | undefined,
  settings: TxGuardSettings,
  options: RiskOptions = {},
): RiskEvaluation {
  // Collect findings from all applicable rules.
  const findings: RiskFinding[] = [];
  findings.push(...rules.checkUnlimitedApproval(decoded));
  findings.push(...rules.checkNftApprovalForAll(decoded));
  findings.push(...rules.checkLargeIncreaseAllowance(decoded));
  findings.push(...rules.checkUnknownCall(decoded, settings));
  findings.push(...rules.checkFiniteApproval(decoded));
  findings.push(...rules.checkChainSwitch(decoded, options.configuredChainIds));
  findings.push(...rules.checkNoCode(decoded, options.hasCode));
  findings.push(...rules.checkMissingRpc(chainConfig));
  findings.push(...rules.checkSimpleTransfer(decoded));
  findings.push(...rules.checkNftApprovalRevoke(decoded));
  findings.push(...rules.checkApprovalZero(decoded));
  findings.push(...rules.checkDecreaseAllowance(decoded));

  // Determine overall risk level: HIGH > MEDIUM > LOW > UNKNOWN.
  const hasLevel = (lvl: RiskLevel) => findings.some((f) => f.severity === lvl);
  let riskLevel: RiskLevel = 'UNKNOWN';
  if (hasLevel('HIGH')) riskLevel = 'HIGH';
  else if (hasLevel('MEDIUM')) riskLevel = 'MEDIUM';
  else if (hasLevel('LOW')) riskLevel = 'LOW';

  // If decode failed and no findings surfaced, risk is UNKNOWN.
  if (!decoded.isDecoded && findings.length === 0) riskLevel = 'UNKNOWN';

  const summary = buildSummary(decoded, riskLevel, chainConfig);
  return { riskLevel, findings, summary };
}

// Shorten an address for display: 0x1234...abcd
function shortAddr(addr: HexAddress | undefined): string {
  if (!addr) return 'unknown';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// Build a human-readable summary based on action type + risk level.
function buildSummary(
  decoded: DecodedTx,
  riskLevel: RiskLevel,
  chainConfig: ChainConfig | undefined,
): string {
  const symbol =
    decoded.tokenMetadata?.symbol ??
    chainConfig?.nativeCurrencySymbol ??
    'tokens';
  const decimals =
    decoded.tokenMetadata?.decimals ??
    chainConfig?.nativeCurrencyDecimals ??
    18;

  switch (decoded.actionType) {
    case 'ERC20_APPROVE':
      if (decoded.isUnlimited) {
        return `HIGH RISK — You are granting unlimited ${symbol} approval to ${shortAddr(decoded.spender)}`;
      }
      if ((decoded.amount ?? 0n) === 0n) {
        return `You are revoking ${symbol} approval from ${shortAddr(decoded.spender)}`;
      }
      return `You are approving ${formatAmount(decoded.amount ?? 0n, decimals)} ${symbol} to ${shortAddr(decoded.spender)}`;
    case 'ERC20_TRANSFER':
      return `You are transferring ${formatAmount(decoded.amount ?? 0n, decimals)} ${symbol} to ${shortAddr(decoded.recipient)}`;
    case 'ERC20_TRANSFER_FROM':
      return `You are transferring ${formatAmount(decoded.amount ?? 0n, decimals)} ${symbol} from ${shortAddr(decoded.transferFrom)} to ${shortAddr(decoded.recipient)}`;
    case 'ERC20_INCREASE_ALLOWANCE':
      return `You are increasing ${symbol} allowance for ${shortAddr(decoded.spender)} by ${formatAmount(decoded.amount ?? 0n, decimals)}`;
    case 'ERC20_DECREASE_ALLOWANCE':
      return `You are decreasing ${symbol} allowance for ${shortAddr(decoded.spender)} by ${formatAmount(decoded.amount ?? 0n, decimals)}`;
    case 'NFT_SET_APPROVAL_FOR_ALL':
      if (decoded.approved) {
        return `HIGH RISK — You are approving ALL your NFTs to ${shortAddr(decoded.spender)}`;
      }
      return `You are revoking NFT approval from ${shortAddr(decoded.spender)}`;
    case 'NATIVE_TRANSFER':
      return `You are sending ${formatAmount(decoded.value ?? 0n, decimals)} ${symbol} to ${shortAddr(decoded.to)}`;
    case 'CHAIN_SWITCH':
      return `A dApp is requesting to switch your wallet chain${decoded.targetChainId ? ` to chain ID ${decoded.targetChainId}` : ''}`;
    case 'UNKNOWN_CONTRACT_CALL':
      return `${riskLevel} RISK — Unknown contract call to ${shortAddr(decoded.to)}`;
    default:
      return `${riskLevel} RISK — Unrecognized request`;
  }
}
