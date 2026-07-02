import { useState, useEffect, useCallback } from 'react';
import { NetworkList } from './NetworkList';
import { NetworkForm } from './NetworkForm';
import {
  getChains,
  setChains as setChainsStorage,
  getSettings,
  setSettings as setSettingsStorage,
} from '../background/storage';
import { MESSAGE_TYPES, MESSAGE_SOURCES } from '../shared/messages';
import {
  DEFAULT_CHAINS,
  templateToPreset,
} from '../core/chains/defaultChains';
import type {
  ChainConfig,
  RpcTestResult,
  TxGuardSettings,
} from '../shared/types';

// TxGuard Settings page — manage custom EVM chains, RPC endpoints, and
// protection toggles.
export function Settings() {
  const [chains, setChainsState] = useState<ChainConfig[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingChain, setEditingChain] = useState<ChainConfig | undefined>();
  const [presetChain, setPresetChain] = useState<ChainConfig | undefined>();
  const [settings, setSettingsState] = useState<TxGuardSettings | null>(null);

  useEffect(() => {
    getChains().then(setChainsState);
    getSettings().then(setSettingsState);
  }, []);

  const handleSave = useCallback(async (chain: ChainConfig) => {
    const current = await getChains();
    const existing = current.find((c) => c.chainId === chain.chainId);
    const updated = existing
      ? current.map((c) => (c.chainId === chain.chainId ? chain : c))
      : [...current, chain];
    await setChainsStorage(updated);
    setChainsState(updated);
    setShowForm(false);
    setEditingChain(undefined);
    setPresetChain(undefined);
  }, []);

  const handleDelete = useCallback(async (chainId: number) => {
    const current = await getChains();
    const updated = current.filter((c) => c.chainId !== chainId);
    await setChainsStorage(updated);
    setChainsState(updated);
  }, []);

  const handleTestRpc = useCallback(
    async (chain: ChainConfig): Promise<RpcTestResult> => {
      return new Promise((resolve) => {
        if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
          resolve({ success: false, error: 'Extension context unavailable' });
          return;
        }
        chrome.runtime.sendMessage(
          {
            source: MESSAGE_SOURCES.TXGUARD_SETTINGS,
            type: MESSAGE_TYPES.RPC_TEST_REQUEST,
            config: chain,
          },
          (response: unknown) => {
            const r = response as { result?: RpcTestResult } | undefined;
            resolve(
              r?.result ?? {
                success: false,
                error: 'No response from background',
              },
            );
          },
        );
      });
    },
    [],
  );

  // Toggle a boolean protection setting and persist immediately.
  function toggleSetting<K extends keyof TxGuardSettings>(key: K): void {
    setSettingsState((prev) => {
      if (!prev) return prev;
      const updated: TxGuardSettings = { ...prev, [key]: !prev[key] };
      void setSettingsStorage(updated);
      return updated;
    });
  }

  // Suggested networks = default templates the user has not added yet. Each
  // offers a one-click "Add" that opens the form pre-filled with the template's
  // public RPC. The user still must click "Save Network" — TxGuard never
  // auto-uses a public RPC.
  const suggested = DEFAULT_CHAINS.filter(
    (t) => !chains.some((c) => c.chainId === t.chainId),
  );

  return (
    <div className="settings">
      <h1>TxGuard Settings</h1>
      <p className="subtitle">
        Configure EVM chains and RPC endpoints for local transaction analysis.
      </p>

      <section className="privacy-notice">
        <h2>🔒 Privacy Notice</h2>
        <p>
          TxGuard is local-first. Your transaction data, wallet address, and
          activity are never sent to a remote server. RPC endpoints are used
          only for read-only calls (chain ID, block number, token metadata).
          TxGuard does not store private keys or sign transactions.
        </p>
      </section>

      <section className="protection-settings">
        <h2>Protection Settings</h2>
        {settings ? (
          <>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={() => toggleSetting('enabled')}
              />
              <span className="toggle-label">Enable TxGuard</span>
              <span className="toggle-desc">
                Master switch. When off, requests are forwarded unchanged with no
                analysis, overlay, or history.
              </span>
            </label>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={settings.warnOnUnknownCalls}
                onChange={() => toggleSetting('warnOnUnknownCalls')}
              />
              <span className="toggle-label">Warn on unknown contract calls</span>
              <span className="toggle-desc">
                Warn when TxGuard cannot decode a transaction's calldata.
              </span>
            </label>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={settings.warnOnPersonalSign}
                onChange={() => toggleSetting('warnOnPersonalSign')}
              />
              <span className="toggle-label">Warn on personal_sign requests</span>
              <span className="toggle-desc">
                Escalate personal signatures from unknown sites to HIGH risk.
              </span>
            </label>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={settings.blockHighRiskByDefault}
                onChange={() => toggleSetting('blockHighRiskByDefault')}
              />
              <span className="toggle-label">Block high-risk requests by default</span>
              <span className="toggle-desc">
                Auto-cancel HIGH-risk requests (code 4001) without showing the
                overlay. Recorded in history as CANCELLED_BY_POLICY.
              </span>
            </label>
          </>
        ) : (
          <p className="toggle-loading">Loading settings...</p>
        )}
      </section>

      <section className="networks-section">
        <div className="section-header">
          <h2>Networks</h2>
          <button
            className="primary"
            onClick={() => {
              setEditingChain(undefined);
              setPresetChain(undefined);
              setShowForm(true);
            }}
          >
            + Add Network
          </button>
        </div>
        {showForm ? (
          <NetworkForm
            initial={editingChain}
            preset={presetChain}
            onSave={handleSave}
            onCancel={() => {
              setShowForm(false);
              setEditingChain(undefined);
              setPresetChain(undefined);
            }}
            onTestRpc={handleTestRpc}
          />
        ) : (
          <>
            {suggested.length > 0 && (
              <div className="suggested-networks">
                <div className="suggested-title">
                  Suggested Networks (try with one click)
                </div>
                {suggested.map((t) => (
                  <div key={t.chainId} className="suggested-item">
                    <div className="suggested-info">
                      <span className="network-name">{t.name}</span>
                      <span className="network-chainid">
                        Chain ID: {t.chainId}
                      </span>
                      {t.publicRpcUrl && (
                        <span className="network-rpc">{t.publicRpcUrl}</span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setEditingChain(undefined);
                        setPresetChain(templateToPreset(t));
                        setShowForm(true);
                      }}
                    >
                      Add
                    </button>
                  </div>
                ))}
                <p className="suggested-note">
                  These public RPCs are shared and may rate-limit. Click Add,
                  then Test RPC and Save. You can always replace the URL with
                  your own provider.
                </p>
              </div>
            )}
            <NetworkList
              chains={chains}
              onEdit={(chain) => {
                setEditingChain(chain);
                setPresetChain(undefined);
                setShowForm(true);
              }}
              onDelete={handleDelete}
              onTestRpc={handleTestRpc}
            />
          </>
        )}
      </section>
    </div>
  );
}
