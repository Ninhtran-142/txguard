import { useState } from 'react';
import type { ChainConfig, RpcTestResult } from '../shared/types';

interface NetworkListProps {
  chains: ChainConfig[];
  onEdit: (chain: ChainConfig) => void;
  onDelete: (chainId: number) => void;
  onTestRpc: (chain: ChainConfig) => Promise<RpcTestResult>;
}

function shortenUrl(url: string, max = 40): string {
  return url.length > max ? url.slice(0, max) + '...' : url;
}

export function NetworkList({
  chains,
  onEdit,
  onDelete,
  onTestRpc,
}: NetworkListProps) {
  const [testResults, setTestResults] = useState<
    Record<number, RpcTestResult | undefined>
  >({});
  const [testing, setTesting] = useState<Record<number, boolean>>({});

  async function handleTest(chain: ChainConfig) {
    setTesting((prev) => ({ ...prev, [chain.chainId]: true }));
    const result = await onTestRpc(chain);
    setTestResults((prev) => ({ ...prev, [chain.chainId]: result }));
    setTesting((prev) => ({ ...prev, [chain.chainId]: false }));
  }

  if (chains.length === 0) {
    return (
      <div className="empty-state">
        <p>No networks configured yet.</p>
        <p>Click &quot;Add Network&quot; to configure your first EVM chain.</p>
      </div>
    );
  }

  return (
    <div className="network-list">
      {chains.map((chain) => {
        const result = testResults[chain.chainId];
        const isTesting = testing[chain.chainId];
        return (
          <div key={chain.chainId} className="network-item">
            <div className="network-info">
              <span className="network-name">{chain.name}</span>
              <span className="network-chainid">Chain ID: {chain.chainId}</span>
              <span className="network-rpc">{shortenUrl(chain.rpcUrl)}</span>
              <span className="network-symbol">
                {chain.nativeCurrencySymbol}
              </span>
            </div>
            {result && (
              <div
                className={`test-result ${result.success ? 'success' : 'error'}`}
              >
                {result.success
                  ? `✅ Chain ${result.chainId} — Block ${result.blockNumber?.toString() ?? ''} — ${result.latencyMs}ms`
                  : `❌ ${result.error}`}
              </div>
            )}
            <div className="network-actions">
              <button onClick={() => handleTest(chain)} disabled={isTesting}>
                {isTesting ? 'Testing...' : 'Test RPC'}
              </button>
              <button onClick={() => onEdit(chain)}>Edit</button>
              <button
                onClick={() => onDelete(chain.chainId)}
                className="danger"
              >
                Delete
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
