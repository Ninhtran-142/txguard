import React from 'react';
import ReactDOM from 'react-dom/client';
import { TxWarningOverlay } from './TxWarningOverlay';
import type { TxAnalysisResult } from '../../shared/types';
import './overlay.css';

// Overlay root — mounts/unmounts the warning overlay on the page.
//
// Creates a DOM element appended to document.body, mounts a React root,
// and cleans up (unmount + remove DOM) after the user's decision.
// Does NOT permanently modify the page DOM.

let currentRoot: ReactDOM.Root | null = null;
let currentContainer: HTMLDivElement | null = null;

export function showOverlay(
  analysis: TxAnalysisResult,
  onDecision: (decision: 'CONTINUE' | 'CANCEL') => void,
): void {
  // Clean up any existing overlay first.
  hideOverlay();

  const container = document.createElement('div');
  container.id = 'txguard-overlay-root';
  document.body.appendChild(container);

  const root = ReactDOM.createRoot(container);
  currentRoot = root;
  currentContainer = container;

  root.render(
    <React.StrictMode>
      <TxWarningOverlay
        analysis={analysis}
        onContinue={() => {
          onDecision('CONTINUE');
          hideOverlay();
        }}
        onCancel={() => {
          onDecision('CANCEL');
          hideOverlay();
        }}
      />
    </React.StrictMode>,
  );
}

export function hideOverlay(): void {
  if (currentRoot) {
    currentRoot.unmount();
    currentRoot = null;
  }
  if (currentContainer && currentContainer.parentNode) {
    currentContainer.parentNode.removeChild(currentContainer);
    currentContainer = null;
  }
}
