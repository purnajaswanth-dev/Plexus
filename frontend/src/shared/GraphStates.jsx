import React from 'react';
import { Layers, AlertTriangle, RefreshCw } from 'lucide-react';

export const GraphLoading = ({ message = 'Computing graph layout and AST relationships...' }) => (
  <div className="graph-state-container">
    <div className="graph-spinner" />
    <div className="graph-state-title">Loading Graph</div>
    <div className="graph-state-desc">{message}</div>
  </div>
);

export const GraphEmptyState = ({
  title = 'No graph data found',
  description = 'No nodes or relationships match your current filters or repository selection.',
  actionLabel,
  onAction
}) => (
  <div className="graph-state-container">
    <div style={{ color: 'var(--text-muted, #81776F)', marginBottom: 12 }}>
      <Layers size={40} strokeWidth={1.5} />
    </div>
    <div className="graph-state-title">{title}</div>
    <div className="graph-state-desc">{description}</div>
    {actionLabel && onAction && (
      <button className="graph-btn primary" onClick={onAction}>
        {actionLabel}
      </button>
    )}
  </div>
);

export const GraphErrorState = ({
  title = 'Failed to load graph',
  error,
  onRetry
}) => (
  <div className="graph-state-container">
    <div style={{ color: 'var(--status-danger, #B7655D)', marginBottom: 12 }}>
      <AlertTriangle size={40} strokeWidth={1.5} />
    </div>
    <div className="graph-state-title">{title}</div>
    <div className="graph-state-desc" style={{ color: 'var(--status-danger, #B7655D)' }}>
      {error || 'An unexpected error occurred while communicating with the backend.'}
    </div>
    {onRetry && (
      <button className="graph-btn" onClick={onRetry}>
        <RefreshCw size={14} /> Retry Request
      </button>
    )}
  </div>
);

