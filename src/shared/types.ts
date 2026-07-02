// TxGuard shared type definitions.
//
// These types are imported across the extension (background, content, popup,
// settings, core). Core logic types are framework-independent.

/** EVM hex address, e.g. "0x1234...abcd". */
export type HexAddress = `0x${string}`;

/** Generic hex string, e.g. calldata or a hash. */
export type HexString = `0x${string}`;

/** Risk severity assigned by the rule-based risk engine. */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';

/** Domain risk classification used by the popup. */
export type DomainRisk = 'KNOWN' | 'UNKNOWN' | 'BLOCKED';

/** Categorised action inferred from a decoded provider request. */
export type TxActionType =
  | 'NATIVE_TRANSFER'
  | 'ERC20_APPROVE'
  | 'ERC20_TRANSFER'
  | 'ERC20_TRANSFER_FROM'
  | 'ERC20_INCREASE_ALLOWANCE'
  | 'ERC20_DECREASE_ALLOWANCE'
  | 'NFT_SET_APPROVAL_FOR_ALL'
  | 'UNKNOWN_CONTRACT_CALL'
  | 'PERSONAL_SIGNATURE'
  | 'TYPED_DATA_SIGNATURE'
  | 'CHAIN_SWITCH'
  | 'UNKNOWN';

/** User-defined EVM chain configuration. */
export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorerUrl?: string;
  nativeCurrencySymbol: string;
  nativeCurrencyDecimals: number;
}

/** Result of validating an RPC endpoint. */
export interface RpcTestResult {
  success: boolean;
  chainId?: number;
  blockNumber?: bigint;
  latencyMs?: number;
  error?: string;
  /** True when the endpoint responded with a rate-limit / 429 style message. */
  rateLimited?: boolean;
}

/** A provider request intercepted by the injected hook. */
export interface InterceptedProviderRequest {
  requestId: string;
  method: string;
  params: unknown[];
  domain: string;
  origin?: string;
  chainId?: number;
}

/**
 * Minimal shape of an EVM transaction request.
 * Security note: TxGuard must NEVER modify any of these fields.
 */
export interface TransactionRequestLike {
  from?: HexAddress;
  to?: HexAddress;
  data?: HexString;
  value?: HexString;
  gas?: HexString;
  gasPrice?: HexString;
  maxFeePerGas?: HexString;
  maxPriorityFeePerGas?: HexString;
  nonce?: HexString;
  chainId?: HexString;
}

/** ERC20/ERC721/ERC1155 token metadata read via RPC. */
export interface TokenMetadata {
  name?: string;
  symbol?: string;
  decimals?: number;
}

/** A decoded transaction (or signature) produced by the decoder. */
export interface DecodedTx {
  isDecoded: boolean;
  actionType: TxActionType;
  /** Contract address the call targets, if any. */
  to?: HexAddress;
  /** Sender, if known. */
  from?: HexAddress;
  /** Native value transferred, in wei (as bigint). */
  value?: bigint;
  /** ERC20/NFT spender or operator. */
  spender?: HexAddress;
  /** ERC20 transfer recipient. */
  recipient?: HexAddress;
  /** Approval / transfer amount (raw bigint). */
  amount?: bigint;
  /** Whether an approval amount is unlimited. */
  isUnlimited?: boolean;
  /** setApprovalForAll approved flag. */
  approved?: boolean;
  /** transferFrom source. */
  transferFrom?: HexAddress;
  /** Token metadata if resolved via RPC. */
  tokenMetadata?: TokenMetadata;
  /** The raw (never modified) transaction request. */
  rawTx?: TransactionRequestLike;
  /** Function selector for contract calls. */
  selector?: HexString;
  targetChainId?: number;
}

/** A single risk finding with a recommendation. */
export interface RiskFinding {
  title: string;
  description: string;
  recommendation: string;
  severity: RiskLevel;
}

/**
 * How an intercepted request was resolved. Stored on the history item so the
 * user can see not just the risk result but also the outcome.
 * - `CONTINUE` / `CANCEL`: the user's explicit choice in the overlay.
 * - `CANCELLED_BY_POLICY`: auto-cancelled because `blockHighRiskByDefault`
 *   was on and the risk level was HIGH (no overlay shown).
 */
export type TxDecision = 'CONTINUE' | 'CANCEL' | 'CANCELLED_BY_POLICY';

/** Full analysis result stored in history and shown in the overlay. */
export interface TxAnalysisResult {
  requestId: string;
  riskLevel: RiskLevel;
  findings: RiskFinding[];
  summary: string;
  decoded: DecodedTx;
  actionType: TxActionType;
  timestamp: number;
  domain: string;
  chainId?: number;
  /** Outcome of the request (set for policy cancels; optional otherwise). */
  decision?: TxDecision;
}

/** User decision for an intercepted request. */
export interface TxUserDecision {
  requestId: string;
  decision: 'CONTINUE' | 'CANCEL';
}

/**
 * Policy returned by the background alongside an analysis. Drives the content
 * script's behaviour without changing the injected hook contract:
 * - `ASK_USER`: show the warning overlay and wait for the user's decision.
 * - `CONTINUE`: bypass the overlay and forward the original request unchanged
 *   (used when TxGuard is disabled via `settings.enabled`).
 * - `CANCEL`: bypass the overlay and reject with EIP-1193 code 4001 (used when
 *   `blockHighRiskByDefault` cancels a HIGH-risk request by policy).
 */
export type Policy = 'ASK_USER' | 'CONTINUE' | 'CANCEL';

/** TxGuard user settings (persisted in chrome.storage.local). */
export interface TxGuardSettings {
  enabled: boolean;
  warnOnUnknownCalls: boolean;
  warnOnPersonalSign: boolean;
  blockHighRiskByDefault: boolean;
}
