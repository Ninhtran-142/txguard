import { useState, useEffect } from 'react';
import type {
  ChainConfig,
  DomainRisk,
  TxAnalysisResult,
} from '../shared/types';
import { MESSAGE_TYPES } from '../shared/messages';

interface PopupState {
  domain: string;
  domainRisk?: DomainRisk;
  walletChainId?: number;
  chains: ChainConfig[];
  history: TxAnalysisResult[];
}

const RISK_COLORS: Record<string, string> = {
  HIGH: '#c00',
  MEDIUM: '#e65100',
  LOW: '#2e7d32',
  UNKNOWN: '#666',
};

const DOMAIN_RISK_LABEL: Record<DomainRisk, string> = {
  KNOWN: 'Known',
  UNKNOWN: 'Unknown',
  BLOCKED: 'Blocked',
};

const DOMAIN_RISK_CLASS: Record<DomainRisk, string> = {
  KNOWN: 'known',
  UNKNOWN: 'unknown',
  BLOCKED: 'blocked',
};

// TxGuard popup — shows status, current domain + risk, chain, RPC status,
// and the latest 5 transaction checks.
export function Popup() {
  const [state, setState] = useState<PopupState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Query the background for popup state.
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      setLoading(false);
      return;
    }
    chrome.runtime.sendMessage(
      { type: MESSAGE_TYPES.GET_POPUP_STATE },
      (response: unknown) => {
        const r = response as { state?: PopupState } | undefined;
        if (r?.state) setState(r.state);
        setLoading(false);
      },
    );
  }, []);

  function openHistory() {
    if (typeof chrome !== 'undefined' && chrome.tabs?.create)
      chrome.tabs.create({
        url: chrome.runtime.getURL('history/index.html'),
      });
  }

  if (loading) {
    return (
      <div className="popup">
        <h1>🛡️ TxGuard</h1>
        <p>Loading...</p>
      </div>
    );
  }

  const chain = state?.walletChainId
    ? state.chains.find((c) => c.chainId === state.walletChainId)
    : undefined;
  const rpcStatus = chain
    ? 'Configured'
    : state?.walletChainId
      ? 'Not configured'
      : 'No wallet detected';
  const statusIndicator = state?.walletChainId ? 'Active' : 'No wallet';
  const domainRisk = state?.domainRisk ?? 'UNKNOWN';

  return (
    <div className="popup">
      <div className="popup-header">
        <h1>🛡️ TxGuard</h1>
        <span
          className={`status-indicator ${statusIndicator === 'Active' ? 'active' : 'inactive'}`}
        >
          {statusIndicator}
        </span>
      </div>

      <div className="popup-section">
        <div className="section-label">Current dApp</div>
        <div className="section-value">{state?.domain ?? 'Unknown'}</div>
        <span className={`domain-risk ${DOMAIN_RISK_CLASS[domainRisk]}`}>
          {DOMAIN_RISK_LABEL[domainRisk]}
        </span>
      </div>

      <div className="popup-section">
        <div className="section-label">Current Chain</div>
        <div className="section-value">
          {state?.walletChainId
            ? `Chain ID: ${state.walletChainId}${chain ? ` (${chain.name})` : ''}`
            : 'Not detected'}
        </div>
        <div
          className={`rpc-status ${rpcStatus === 'Configured' ? 'ok' : 'warn'}`}
        >
          RPC: {rpcStatus}
        </div>
      </div>

      <div className="popup-section">
        <div className="section-label">Latest Checks</div>
        {state?.history && state.history.length > 0 ? (
          <div className="history-list">
            {state.history.slice(0, 5).map((item, i) => (
              <div key={i} className="history-item">
                <span
                  className="risk-dot"
                  style={{ color: RISK_COLORS[item.riskLevel] ?? '#666' }}
                >
                  ●
                </span>
                <span className="history-summary">{item.summary}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">No checks yet</div>
        )}
      </div>

      <div className="popup-actions">
        <button onClick={() => chrome.runtime.openOptionsPage()}>
          Open Settings
        </button>
        <button onClick={openHistory}>View History</button>
      </div>
    </div>
  );
}
