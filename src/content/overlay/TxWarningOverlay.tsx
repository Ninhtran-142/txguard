import { useState, useEffect } from 'react';
import type { TxAnalysisResult } from '../../shared/types';

interface TxWarningOverlayProps {
  analysis: TxAnalysisResult;
  onContinue: () => void;
  onCancel: () => void;
}

const RISK_COLORS: Record<string, string> = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  UNKNOWN: 'unknown',
};

function shortAddr(addr?: string): string {
  if (!addr) return 'unknown';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// TxGuard warning overlay — shown before the wallet confirmation.
// Blocks page interaction, shows risk level + findings, Continue/Cancel.
// ESC key → Cancel. Click outside does NOT close (user must pick one).
export function TxWarningOverlay({
  analysis,
  onContinue,
  onCancel,
}: TxWarningOverlayProps) {
  const [showTech, setShowTech] = useState(false);

  // ESC key → Cancel.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const riskClass = RISK_COLORS[analysis.riskLevel] ?? 'unknown';
  const decoded = analysis.decoded;

  return (
    <div className="txguard-overlay-backdrop" role="dialog" aria-modal="true">
      <div
        className="txguard-overlay-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="txguard-overlay-header">
          <h2 className="txguard-overlay-title">🛡️ TxGuard Security Check</h2>
          <span className={`txguard-risk-badge ${riskClass}`}>
            {analysis.riskLevel} RISK
          </span>
        </div>

        <div className="txguard-overlay-body">
          <p className="txguard-summary">{analysis.summary}</p>

          {/* Signature-specific notice */}
          {analysis.actionType === 'PERSONAL_SIGNATURE' && (
            <div className="txguard-unlimited-warning">
              ℹ️ This is a signature request, not a transaction. Signing can
              authorize actions on your behalf.
            </div>
          )}
          {analysis.actionType === 'TYPED_DATA_SIGNATURE' && (
            <div className="txguard-unlimited-warning">
              ℹ️ This is a typed data signature request, not a transaction.
              Signing can authorize actions on your behalf.
            </div>
          )}

          {decoded.isUnlimited && (
            <div className="txguard-unlimited-warning">
              ⚠️ UNLIMITED APPROVAL — the spender can drain your entire token
              balance.
            </div>
          )}

          <div className="txguard-section">
            <div className="txguard-section-title">Details</div>
            <div className="txguard-detail-row">
              <span className="txguard-detail-label">Action</span>
              <span className="txguard-detail-value">
                {analysis.actionType}
              </span>
            </div>
            {decoded.to && (
              <div className="txguard-detail-row">
                <span className="txguard-detail-label">Contract</span>
                <span className="txguard-detail-value">
                  {shortAddr(decoded.to)}
                </span>
              </div>
            )}
            {decoded.spender && (
              <div className="txguard-detail-row">
                <span className="txguard-detail-label">Spender/Operator</span>
                <span className="txguard-detail-value">
                  {shortAddr(decoded.spender)}
                </span>
              </div>
            )}
            {decoded.recipient && (
              <div className="txguard-detail-row">
                <span className="txguard-detail-label">Recipient</span>
                <span className="txguard-detail-value">
                  {shortAddr(decoded.recipient)}
                </span>
              </div>
            )}
            {decoded.amount !== undefined && (
              <div className="txguard-detail-row">
                <span className="txguard-detail-label">Amount</span>
                <span className="txguard-detail-value">
                  {decoded.amount.toString()}{' '}
                  {decoded.tokenMetadata?.symbol ?? ''}
                </span>
              </div>
            )}
            {decoded.approved !== undefined && (
              <div className="txguard-detail-row">
                <span className="txguard-detail-label">Approved</span>
                <span className="txguard-detail-value">
                  {String(decoded.approved)}
                </span>
              </div>
            )}
          </div>

          {analysis.findings.length > 0 && (
            <div className="txguard-section">
              <div className="txguard-section-title">Findings</div>
              <div className="txguard-findings">
                {analysis.findings.map((f, i) => (
                  <div
                    key={i}
                    className={`txguard-finding ${RISK_COLORS[f.severity] ?? 'unknown'}`}
                  >
                    <p className="txguard-finding-title">{f.title}</p>
                    <p className="txguard-finding-desc">{f.description}</p>
                    <p className="txguard-finding-rec">{f.recommendation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="txguard-tech-details">
            <button
              className="txguard-tech-toggle"
              onClick={() => setShowTech(!showTech)}
            >
              {showTech ? '▼' : '▶'} Technical Details
            </button>
            {showTech && (
              <div className="txguard-tech-content">
                {JSON.stringify(decoded.rawTx ?? decoded, null, 2)}
              </div>
            )}
          </div>
        </div>

        <div className="txguard-overlay-actions">
          <button className="txguard-btn txguard-btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="txguard-btn txguard-btn-continue"
            onClick={onContinue}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
