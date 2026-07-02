import { MESSAGE_TYPES } from '../shared/messages';
import { validateRpc, getCode } from '../core/rpc/client';
import { decodeTransaction } from '../core/decoder/decoder';
import { decodeSignature } from '../core/decoder/signatureDecoder';
import { evaluateRisk } from '../core/risk/evaluator';
import { evaluateSignatureRisk } from '../core/risk/signatureRules';
import { readTokenMetadataCached } from '../core/rpc/tokenMetadataCached';
import {
  getChains,
  getSettings,
  addTxHistoryItem,
  getTxHistory,
  clearTxHistory,
  getWalletChainId,
  setWalletChainId,
  getDomainAllowlist,
  getDomainBlocklist,
} from './storage';
import type {
  ChainConfig,
  DomainRisk,
  InterceptedProviderRequest,
  TransactionRequestLike,
  TxAnalysisResult,
  TxUserDecision,
  HexAddress,
} from '../shared/types';

// Background message router.
//
// Handles messages from content scripts, popup, and settings page.
// Security note: validate message sources and request shapes before
// processing. This router must NEVER handle private keys or sign
// transactions — it only routes messages and triggers read-only RPC calls.
export async function handleBackgroundMessage(message: {
  type: string;
  [key: string]: unknown;
}): Promise<unknown> {
  switch (message.type) {
    case MESSAGE_TYPES.RPC_TEST_REQUEST: {
      const config = message.config as ChainConfig;
      const result = await validateRpc(config);
      return { type: MESSAGE_TYPES.RPC_TEST_RESULT, result };
    }

    case MESSAGE_TYPES.PROVIDER_REQUEST_INTERCEPTED: {
      // Analyse an intercepted provider request and return the result.
      const request = message as unknown as InterceptedProviderRequest & {
        origin?: string;
      };
      const analysis = await analyzeProviderRequest(request);
      return { type: MESSAGE_TYPES.ANALYSIS_RESULT, analysis };
    }

    case MESSAGE_TYPES.USER_DECISION: {
      // Record the user's decision in history (the actual continue/cancel
      // is handled by the injected script via the content bridge).
      const decision = message as unknown as TxUserDecision;
      // History recording happens during analysis; here we could update
      // the history item with the decision. For MVP, the analysis is
      // stored when the request is intercepted.
      return { type: 'ACK', decision };
    }

    case MESSAGE_TYPES.WALLET_CHAIN_CHANGED: {
      // Cache the wallet's current chain ID so the popup and analysis can use it.
      const chainId = message.chainId as number | undefined;
      await setWalletChainId(chainId);
      return { type: 'ACK' };
    }

    case MESSAGE_TYPES.GET_POPUP_STATE: {
      // Return current tab info, chains, wallet chain ID, domain risk, and
      // tx history for the popup.
      const [chains, history, walletChainId, allowlist, blocklist] =
        await Promise.all([
          getChains(),
          getTxHistory(),
          getWalletChainId(),
          getDomainAllowlist(),
          getDomainBlocklist(),
        ]);
      // Get the current active tab domain.
      let domain = 'Unknown';
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (tab?.url) {
          domain = new URL(tab.url).hostname;
        }
      } catch {
        // Ignore tab query errors.
      }
      const domainRisk = classifyDomain(domain, allowlist, blocklist);
      return {
        type: 'POPUP_STATE',
        state: {
          domain,
          domainRisk,
          walletChainId,
          chains,
          history,
        },
      };
    }

    case MESSAGE_TYPES.CLEAR_HISTORY: {
      await clearTxHistory();
      return { type: 'ACK' };
    }

    default:
      return undefined;
  }
}

// Classify the current domain against the local allowlist/blocklist.
function classifyDomain(
  domain: string,
  allowlist: string[],
  blocklist: string[],
): DomainRisk {
  if (blocklist.includes(domain)) return 'BLOCKED';
  if (allowlist.includes(domain)) return 'KNOWN';
  return 'UNKNOWN';
}

// Parse a chain ID value (hex string or number) from wallet_switchEthereumChain.
function parseSwitchChainId(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    try {
      return Number.parseInt(value, 16);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

// Analyse an intercepted provider request: decode -> enrich via RPC -> evaluate
// risk -> store. Security note: never stores full signature payloads.
async function analyzeProviderRequest(
  request: InterceptedProviderRequest & { origin?: string },
): Promise<TxAnalysisResult> {
  const settings = await getSettings();
  const chains = await getChains();
  const allowlist = await getDomainAllowlist();

  // Try to get the chain config for the current chain (from the wallet-reported
  // chainId carried in the intercepted request, or cached wallet chainId).
  const walletChainId = request.chainId;
  const chainConfig = walletChainId
    ? chains.find((c) => c.chainId === walletChainId)
    : undefined;

  const configuredChainIds = new Set(chains.map((c) => c.chainId));

  let decoded;
  if (request.method === 'eth_sendTransaction') {
    // Extract the transaction request from params[0].
    const txParams = request.params?.[0] as TransactionRequestLike | undefined;
    decoded = txParams
      ? decodeTransaction(txParams, walletChainId)
      : { isDecoded: false, actionType: 'UNKNOWN' as const };
  } else if (request.method === 'wallet_switchEthereumChain') {
    const target = parseSwitchChainId(
      (request.params?.[0] as { chainId?: unknown } | undefined)?.chainId,
    );
    decoded = {
      isDecoded: true,
      actionType: 'CHAIN_SWITCH' as const,
      targetChainId: target,
    };
  } else if (
    request.method === 'personal_sign' ||
    request.method === 'eth_signTypedData' ||
    request.method === 'eth_signTypedData_v3' ||
    request.method === 'eth_signTypedData_v4'
  ) {
    // Signature methods — use the signature decoder.
    // Security note: never store full signature payloads in history.
    decoded = decodeSignature(
      request.method,
      request.params ?? [],
      request.domain,
    );
  } else {
    decoded = { isDecoded: false, actionType: 'UNKNOWN' as const };
  }

  // ── RPC enrichment (only when a chain config with RPC is available) ──
  // Best-effort: failures must never break analysis. We catch all errors and
  // continue with partial data so the user still gets a warning overlay.
  let hasCode: boolean | undefined;
  if (chainConfig) {
    // Token metadata for ERC20 contract calls (approvals/transfers).
    if (
      decoded.to &&
      (decoded.actionType === 'ERC20_APPROVE' ||
        decoded.actionType === 'ERC20_TRANSFER' ||
        decoded.actionType === 'ERC20_TRANSFER_FROM' ||
        decoded.actionType === 'ERC20_INCREASE_ALLOWANCE' ||
        decoded.actionType === 'ERC20_DECREASE_ALLOWANCE')
    ) {
      try {
        decoded.tokenMetadata = await readTokenMetadataCached(
          chainConfig,
          decoded.to as HexAddress,
        );
      } catch {
        // Metadata read failure — continue without it.
      }
    }

    // eth_getCode for contract calls (skip native transfers / signatures).
    if (
      decoded.to &&
      decoded.actionType !== 'NATIVE_TRANSFER' &&
      decoded.actionType !== 'UNKNOWN' &&
      decoded.actionType !== 'PERSONAL_SIGNATURE' &&
      decoded.actionType !== 'TYPED_DATA_SIGNATURE' &&
      decoded.actionType !== 'CHAIN_SWITCH'
    ) {
      try {
        const code = await getCode(chainConfig, decoded.to as HexAddress);
        hasCode = code !== undefined && code !== '0x';
      } catch {
        // getCode failure — leave hasCode undefined (no no-code finding).
      }
    }
  }

  const evaluation = evaluateRisk(decoded, chainConfig, settings, {
    configuredChainIds,
    hasCode,
  });

  // For signature requests, also evaluate signature-specific rules.
  if (
    decoded.actionType === 'PERSONAL_SIGNATURE' ||
    decoded.actionType === 'TYPED_DATA_SIGNATURE'
  ) {
    const domainKnown = allowlist.includes(request.domain);
    const sigFindings = evaluateSignatureRisk(
      decoded,
      request.domain,
      settings,
      domainKnown,
    );
    evaluation.findings = [...evaluation.findings, ...sigFindings];
    // Re-evaluate risk level: HIGH > MEDIUM > LOW.
    if (sigFindings.some((f) => f.severity === 'HIGH')) {
      evaluation.riskLevel = 'HIGH';
    } else if (
      sigFindings.some((f) => f.severity === 'MEDIUM') &&
      evaluation.riskLevel !== 'HIGH'
    ) {
      evaluation.riskLevel = 'MEDIUM';
    }
  }

  const analysis: TxAnalysisResult = {
    requestId: request.requestId,
    riskLevel: evaluation.riskLevel,
    findings: evaluation.findings,
    summary: evaluation.summary,
    decoded,
    actionType: decoded.actionType,
    timestamp: Date.now(),
    domain: request.domain,
    chainId: walletChainId,
  };

  // Store in local history (capped at 100, never stores full signature payloads).
  // Security note: we only store the summary + risk result, not raw params.
  await addTxHistoryItem(analysis);

  return analysis;
}
