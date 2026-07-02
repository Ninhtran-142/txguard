import { handleBackgroundMessage } from './messageRouter';

// TxGuard background service worker.
// Security note: This context must NEVER handle private keys or sign
// transactions. It only routes messages and performs read-only RPC calls
// (eth_chainId, eth_blockNumber, eth_getCode, eth_call, token metadata).
console.log('TxGuard background started');

// Route incoming messages from content scripts, popup, and settings page.
// Returning true keeps the message channel open for async sendResponse.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && typeof message.type === 'string') {
    handleBackgroundMessage(
      message as { type: string; [key: string]: unknown },
    ).then((result) => sendResponse(result));
    return true; // async response
  }
  return false;
});
