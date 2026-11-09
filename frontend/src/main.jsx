import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AuthProvider } from './context/AuthContext';
import { AuthPage } from './pages/auth/AuthPage';

const roots = new Map();

export const AuthStandalone = ({ onAuthenticated, initialMode = 'login' }) => (
  <AuthProvider>
    <AuthPage initialMode={initialMode} onAuthenticated={onAuthenticated} />
  </AuthProvider>
);

export function mountAuth(container, props = {}) {
  if (!container) return;
  let root = roots.get(container);
  if (!root) {
    root = createRoot(container);
    roots.set(container, root);
  }
  root.render(<AuthStandalone {...props} />);
}

export function unmountAuth(container) {
  if (!container) return;
  const root = roots.get(container);
  if (root) {
    root.unmount();
    roots.delete(container);
  }
}

export function mountGraphExplorer(container, props = {}) {
  if (!container) return;

  let root = roots.get(container);
  if (!root) {
    root = createRoot(container);
    roots.set(container, root);
  }

  root.render(<App {...props} />);
}

export function unmountGraphExplorer(container) {
  if (!container) return;
  const root = roots.get(container);
  if (root) {
    root.unmount();
    roots.delete(container);
  }
}

// Global hooks for parent application
if (typeof window !== 'undefined') {
  window.mountAuth = mountAuth;
  window.unmountAuth = unmountAuth;
  window.mountGraphExplorer = mountGraphExplorer;
  window.unmountGraphExplorer = unmountGraphExplorer;

  // Auto-mount if default root element exists
  const autoContainer = document.getElementById('graph-explorer-root');
  if (autoContainer) {
    mountGraphExplorer(autoContainer);
  }
}
