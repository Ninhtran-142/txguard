import { useState } from 'react';
import { z } from 'zod';
import type { ChainConfig, RpcTestResult } from '../shared/types';

// Form validation schema. URL fields are validated with the native URL
// constructor to stay compatible across zod versions.
const networkSchema = z.object({
  name: z.string().min(1, 'Chain name is required'),
  chainId: z.number().int().positive('Chain ID must be a positive integer'),
  rpcUrl: z.string().min(1, 'RPC URL is required'),
  explorerUrl: z.string(),
  nativeCurrencySymbol: z.string().min(1, 'Symbol is required'),
  nativeCurrencyDecimals: z.number().int().min(0, 'Must be >= 0'),
});

type NetworkFormData = z.infer<typeof networkSchema>;

interface NetworkFormProps {
  initial?: ChainConfig;
  onSave: (chain: ChainConfig) => void;
  onCancel: () => void;
  onTestRpc: (chain: ChainConfig) => Promise<RpcTestResult>;
}

function isValidUrl(value: string): boolean {
  if (!value) return true;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function NetworkForm({
  initial,
  onSave,
  onCancel,
  onTestRpc,
}: NetworkFormProps) {
  const [form, setForm] = useState<NetworkFormData>({
    name: initial?.name ?? '',
    chainId: initial?.chainId ?? 0,
    rpcUrl: initial?.rpcUrl ?? '',
    explorerUrl: initial?.explorerUrl ?? '',
    nativeCurrencySymbol: initial?.nativeCurrencySymbol ?? '',
    nativeCurrencyDecimals: initial?.nativeCurrencyDecimals ?? 18,
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof NetworkFormData, string>>
  >({});
  const [testResult, setTestResult] = useState<RpcTestResult | null>(null);
  const [testing, setTesting] = useState(false);

  function update<K extends keyof NetworkFormData>(
    key: K,
    value: NetworkFormData[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): ChainConfig | null {
    const result = networkSchema.safeParse(form);
    const fieldErrors: Partial<Record<keyof NetworkFormData, string>> = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        const path = issue.path[0] as keyof NetworkFormData;
        if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
      }
    }
    if (!isValidUrl(form.rpcUrl))
      fieldErrors.rpcUrl = 'Must be a valid HTTP(S) URL';
    if (form.explorerUrl && !isValidUrl(form.explorerUrl))
      fieldErrors.explorerUrl = 'Must be a valid URL';
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return null;
    return {
      chainId: form.chainId,
      name: form.name,
      rpcUrl: form.rpcUrl,
      explorerUrl: form.explorerUrl || undefined,
      nativeCurrencySymbol: form.nativeCurrencySymbol,
      nativeCurrencyDecimals: form.nativeCurrencyDecimals,
    };
  }

  function handleSave() {
    const chain = validate();
    if (chain) onSave(chain);
  }

  async function handleTest() {
    const chain = validate();
    if (!chain) return;
    setTesting(true);
    setTestResult(null);
    const result = await onTestRpc(chain);
    setTestResult(result);
    setTesting(false);
  }

  return (
    <div className="network-form">
      <h2>{initial ? 'Edit Network' : 'Add Network'}</h2>
      <div className="form-field">
        <label>Chain Name</label>
        <input
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder="Ethereum"
        />
        {errors.name && <span className="error">{errors.name}</span>}
      </div>
      <div className="form-field">
        <label>Chain ID</label>
        <input
          type="number"
          value={form.chainId || ''}
          onChange={(e) => update('chainId', Number(e.target.value))}
          placeholder="1"
        />
        {errors.chainId && <span className="error">{errors.chainId}</span>}
      </div>
      <div className="form-field">
        <label>RPC URL</label>
        <input
          value={form.rpcUrl}
          onChange={(e) => update('rpcUrl', e.target.value)}
          placeholder="https://eth.llamarpc.com"
        />
        {errors.rpcUrl && <span className="error">{errors.rpcUrl}</span>}
      </div>
      <div className="form-field">
        <label>Explorer URL (optional)</label>
        <input
          value={form.explorerUrl}
          onChange={(e) => update('explorerUrl', e.target.value)}
          placeholder="https://etherscan.io"
        />
        {errors.explorerUrl && (
          <span className="error">{errors.explorerUrl}</span>
        )}
      </div>
      <div className="form-field">
        <label>Native Currency Symbol</label>
        <input
          value={form.nativeCurrencySymbol}
          onChange={(e) => update('nativeCurrencySymbol', e.target.value)}
          placeholder="ETH"
        />
        {errors.nativeCurrencySymbol && (
          <span className="error">{errors.nativeCurrencySymbol}</span>
        )}
      </div>
      <div className="form-field">
        <label>Native Currency Decimals</label>
        <input
          type="number"
          value={form.nativeCurrencyDecimals}
          onChange={(e) =>
            update('nativeCurrencyDecimals', Number(e.target.value))
          }
        />
        {errors.nativeCurrencyDecimals && (
          <span className="error">{errors.nativeCurrencyDecimals}</span>
        )}
      </div>
      {testResult && (
        <div
          className={`test-result ${testResult.success ? 'success' : 'error'}`}
        >
          {testResult.rateLimited
            ? `⚠️ ${testResult.error}`
            : testResult.success
              ? `✅ Connected — Chain ID: ${testResult.chainId}, Block: ${testResult.blockNumber?.toString() ?? 'n/a'}, Latency: ${testResult.latencyMs}ms`
              : `❌ ${testResult.error}`}
        </div>
      )}
      <div className="form-actions">
        <button onClick={handleTest} disabled={testing}>
          {testing ? 'Testing...' : 'Test RPC'}
        </button>
        <button onClick={handleSave} className="primary">
          Save Network
        </button>
        <button onClick={onCancel} className="secondary">
          Cancel
        </button>
      </div>
    </div>
  );
}
