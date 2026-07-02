import { useState, useEffect, useCallback } from 'react';
import { NetworkList } from './NetworkList';
import { NetworkForm } from './NetworkForm';
import {
  getChains,
  setChains as setChainsStorage,
} from '../background/storage';
import { MESSAGE_TYPES } from '../shared/messages';
import type { ChainConfig, RpcTestResult } from '../shared/types';

// TxGuard Settings page — manage custom EVM chains and RPC endpoints.
export function Settings() {
  const [chains, setChainsState] = useState<ChainConfig[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingChain, setEditingChain] = useState<ChainConfig | undefined>();

  useEffect(() => {
    getChains().then(setChainsState);
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
          { type: MESSAGE_TYPES.RPC_TEST_REQUEST, config: chain },
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

      <section className="networks-section">
        <div className="section-header">
          <h2>Networks</h2>
          <button
            className="primary"
            onClick={() => {
              setEditingChain(undefined);
              setShowForm(true);
            }}
          >
            + Add Network
          </button>
        </div>
        {showForm ? (
          <NetworkForm
            initial={editingChain}
            onSave={handleSave}
            onCancel={() => {
              setShowForm(false);
              setEditingChain(undefined);
            }}
            onTestRpc={handleTestRpc}
          />
        ) : (
          <NetworkList
            chains={chains}
            onEdit={(chain) => {
              setEditingChain(chain);
              setShowForm(true);
            }}
            onDelete={handleDelete}
            onTestRpc={handleTestRpc}
          />
        )}
      </section>
    </div>
  );
}
