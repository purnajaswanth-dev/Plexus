import React, { memo } from 'react';

export const CityGateNode = memo(({ data }) => {
  const method = data?.endpoint?.httpMethod || 'POST';
  const route = data?.endpoint?.routePath || '/api/orders';

  return (
    <div
      style={{
        position: 'relative',
        width: '260px',
        height: '130px',
        userSelect: 'none',
        pointerEvents: 'none'
      }}
    >
      <svg width="260" height="130" viewBox="0 0 260 130" style={{ overflow: 'visible' }}>
        {/* Gate Pillars & Arch */}
        <rect x="6" y="22" width="7" height="44" fill="#D9CFC7" rx="1" />
        <rect x="31" y="22" width="7" height="44" fill="#D9CFC7" rx="1" />
        <path d="M9.5 24A12.5 12.5 0 0 1 34.5 24" fill="none" stroke="#D9CFC7" strokeWidth="7" />
        <ellipse cx="9" cy="68" rx="10" ry="5" fill="#64836B" />
        <ellipse cx="35" cy="68" rx="10" ry="5" fill="#64836B" />

        {/* Gate 1 Badge */}
        <rect x="0" y="0" width="48" height="14" rx="7" fill="#C09A62" />
        <text
          x="24"
          y="10.5"
          fill="#ffffff"
          style={{ font: "700 8.5px 'Inter',sans-serif", textAnchor: 'middle' }}
        >
          GATE · 1
        </text>

        {/* Route Label */}
        <text
          x="48"
          y="90"
          fontSize="12.5"
          fontWeight="600"
          fill="#587C78"
          fontFamily="'Inter',sans-serif"
        >
          ▶ {method} {route}
        </text>
        <text
          x="48"
          y="106"
          fontSize="10.5"
          fill="#81776F"
          fontFamily="'Inter',sans-serif"
        >
          API entry gate · request enters here
        </text>
      </svg>
    </div>
  );
});

CityGateNode.displayName = 'CityGateNode';

