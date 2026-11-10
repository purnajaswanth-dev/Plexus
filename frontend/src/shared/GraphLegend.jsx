import React from 'react';

export const GraphLegend = ({ mode = 'architecture' }) => {
  let items = [];

  if (mode === 'architecture') {
    items = [
      { label: 'Repository', color: 'var(--a, #6d8cff)' },
      { label: 'Package / Module', color: 'var(--m, #8b8b9a)' },
      { label: 'Controller', color: 'var(--cy, #38bdf8)' },
      { label: 'Service', color: 'var(--a, #6d8cff)' },
      { label: 'Repository / DAO', color: 'var(--ok, #34d399)' },
      { label: 'Entity / Model', color: 'var(--wa, #f5b942)' },
      { label: 'API Endpoint', color: 'var(--cy, #38bdf8)' },
      { label: 'External Lib', color: 'var(--er, #f26d6d)' }
    ];
  } else if (mode === 'ecosystem') {
    items = [
      { label: 'Repository', color: 'var(--a, #6d8cff)' },
      { label: 'Maven Package', color: 'var(--cy, #38bdf8)' },
      { label: 'NPM Package', color: 'var(--ok, #34d399)' },
      { label: 'Divergent Version', color: 'var(--wa, #f5b942)' }
    ];
  } else if (mode === 'relationships') {
    items = [
      { label: 'Repository', color: 'var(--a, #6d8cff)' },
      { label: 'High Similarity (>50%)', color: 'var(--ok, #34d399)' },
      { label: 'Medium Similarity (20-50%)', color: 'var(--cy, #38bdf8)' },
      { label: 'Low Similarity (<20%)', color: 'var(--m, #8b8b9a)' }
    ];
  }

  return (
    <div className="graph-legend-box">
      <div className="legend-header">Legend • {mode.toUpperCase()}</div>
      <div className="legend-items">
        {items.map((it, idx) => (
          <div key={idx} className="legend-item">
            <span className="legend-color-dot" style={{ backgroundColor: it.color }} />
            <span>{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

