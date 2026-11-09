import React from 'react';

export const GraphLegend = ({ mode = 'architecture' }) => {
  let items = [];

  if (mode === 'architecture') {
    items = [
      { label: 'Repository', color: '#C9B59C' },
      { label: 'Package / Module', color: '#71869B' },
      { label: 'Controller', color: '#587C78' },
      { label: 'Service', color: '#71869B' },
      { label: 'Repository / DAO', color: '#8D916B' },
      { label: 'Entity / Model', color: '#9EA37E' },
      { label: 'API Endpoint', color: '#587C78' },
      { label: 'External Lib', color: '#B77C61' }
    ];
  } else if (mode === 'ecosystem') {
    items = [
      { label: 'Repository', color: '#C9B59C' },
      { label: 'Maven Package', color: '#71869B' },
      { label: 'NPM Package', color: '#587C78' },
      { label: 'Divergent Version', color: '#B7655D' }
    ];
  } else if (mode === 'relationships') {
    items = [
      { label: 'Repository', color: '#C9B59C' },
      { label: 'High Similarity (>50%)', color: '#64836B' },
      { label: 'Medium Similarity (20-50%)', color: '#587C78' },
      { label: 'Low Similarity (<20%)', color: '#81776F' }
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

