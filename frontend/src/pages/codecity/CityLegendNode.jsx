import React, { memo } from 'react';

export const CityLegendNode = memo(() => {
  return (
    <div
      style={{
        width: '221px',
        height: '232px',
        background: '#FFFFFF',
        border: '1.5px solid #D9CFC7',
        borderRadius: '14px',
        padding: '12px 16px',
        boxSizing: 'border-box',
        color: '#39332E',
        fontFamily: "'Inter', system-ui, sans-serif",
        userSelect: 'none',
        pointerEvents: 'none'
      }}
    >
      <div style={{ fontSize: '11px', letterSpacing: '.12em', color: '#81776F', fontWeight: 600, marginBottom: '8px' }}>
        ROAD TYPES
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
        <svg width="28" height="6"><line x1="0" y1="3" x2="28" y2="3" stroke="#C09A62" strokeWidth="3" /></svg>
        <span style={{ fontSize: '10.5px' }}>Selected request route</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
        <svg width="28" height="6"><line x1="0" y1="3" x2="28" y2="3" stroke="#71869B" strokeWidth="3" /></svg>
        <span style={{ fontSize: '10.5px' }}>Method call (arrow = dir)</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
        <svg width="28" height="6"><line x1="0" y1="3" x2="28" y2="3" stroke="#8D916B" strokeWidth="3" /></svg>
        <span style={{ fontSize: '10.5px' }}>Database operation</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
        <svg width="28" height="6"><line x1="0" y1="3" x2="28" y2="3" stroke="#B77C61" strokeWidth="3" /></svg>
        <span style={{ fontSize: '10.5px' }}>External API</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
        <svg width="28" height="6"><line x1="0" y1="3" x2="28" y2="3" stroke="#927D91" strokeWidth="3" strokeDasharray="5 4" /></svg>
        <span style={{ fontSize: '10.5px' }}>Event (async)</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <svg width="28" height="6"><line x1="0" y1="3" x2="28" y2="3" stroke="#587C78" strokeWidth="2" strokeDasharray="1 5" /></svg>
        <span style={{ fontSize: '10.5px' }}>Inheritance / structural</span>
      </div>

      <div style={{ fontSize: '11px', letterSpacing: '.12em', color: '#81776F', fontWeight: 600, marginBottom: '8px' }}>
        EVIDENCE LABELS
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
        <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'rgba(88, 124, 120, 0.15)', border: '1.5px solid #587C78', color: '#587C78', fontSize: '8px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          S
        </div>
        <span style={{ fontSize: '10.5px' }}>Static · from source (AST)</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
        <div style={{ width: '12px', height: '12px', transform: 'rotate(45deg)', background: '#FFFFFF', border: '1.5px solid #64836B' }} />
        <span style={{ fontSize: '10.5px' }}>Runtime · traced execution</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'transparent', border: '1.5px dashed #927D91' }} />
        <span style={{ fontSize: '10.5px' }}>Inferred · incomplete</span>
      </div>
    </div>
  );
});

CityLegendNode.displayName = 'CityLegendNode';

