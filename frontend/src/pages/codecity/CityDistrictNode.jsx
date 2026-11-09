import React, { memo } from 'react';

export const CityDistrictNode = memo(({ data }) => {
  const {
    name = 'DISTRICT',
    districtType = 'GENERAL',
    width = 240,
    height = 200
  } = data;

  const isExternal = districtType === 'EXTERNAL' || name.toUpperCase().includes('EXTERNAL');
  const isDataCenter = districtType === 'DATA_CENTER' || name.toUpperCase().includes('DATA CENTER');
  const isEventDistrict = districtType === 'EVENT_DISTRICT' || name.toUpperCase().includes('EVENT');
  const isAnalysisStatus = districtType === 'ANALYSIS_STATUS' || name.toUpperCase().includes('STATUS');

  return (
    <div
      style={{
        width: `${width}px`,
        height: `${height}px`,
        background: '#EFE9E3',
        border: '1.5px solid #D9CFC7',
        borderRadius: '14px',
        borderStyle: isExternal ? 'dashed' : 'solid',
        padding: '14px 18px',
        boxSizing: 'border-box',
        position: 'relative',
        userSelect: 'none',
        pointerEvents: 'none'
      }}
    >
      {/* District Header Label */}
      <div
        style={{
          font: "600 10.5px 'Inter', sans-serif",
          letterSpacing: '0.12em',
          color: '#39332E',
          textTransform: 'uppercase',
          marginBottom: '12px'
        }}
      >
        {name}
      </div>

      {/* DATA CENTER: Database 3D Cylinder */}
      {isDataCenter && (
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            right: '24px',
            width: '90px',
            height: '90px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto'
          }}
          title="Relational Database Vault"
        >
          <svg width="90" height="90" viewBox="0 0 90 90">
            <rect x="0" y="13" width="90" height="64" fill="#8D916B" />
            <ellipse cx="45" cy="77" rx="45" ry="13" fill="#8D916B" />
            <ellipse cx="45" cy="13" rx="45" ry="13" fill="#A0A57C" />
            <text
              x="45"
              y="50"
              textAnchor="middle"
              style={{
                font: "600 10.5px 'Inter', sans-serif",
                fill: '#ffffff'
              }}
            >
              Database
            </text>
          </svg>
        </div>
      )}

      {/* EVENT DISTRICT: Message Hub */}
      {isEventDistrict && (
        <div
          style={{
            position: 'absolute',
            bottom: '28px',
            right: '60px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px',
            pointerEvents: 'auto'
          }}
          title="Asynchronous Message Broker"
        >
          <svg width="44" height="44" viewBox="0 0 44 44">
            <circle cx="22" cy="22" r="20" fill="#F5F0F5" stroke="#927D91" strokeWidth="3" />
            <circle cx="22" cy="22" r="6" fill="#927D91" />
          </svg>
          <span style={{ fontSize: '10.5px', color: '#39332E', fontFamily: 'Inter, sans-serif' }}>
            message hub
          </span>
        </div>
      )}

      {/* ANALYSIS STATUS: Status Legend District */}
      {isAnalysisStatus && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px', pointerEvents: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <div style={{ width: '18px', height: '18px', borderRadius: '3px', background: '#D9CFC7', opacity: 0.7 }} />
            <span style={{ fontSize: '10px', color: '#39332E', fontFamily: 'Inter, sans-serif' }}>No relationship detected</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <div style={{ width: '18px', height: '18px', borderRadius: '3px', border: '1px dashed #D9CFC7', position: 'relative', overflow: 'hidden' }}>
              <div style={{ width: '100%', height: '100%', background: 'repeating-linear-gradient(45deg, transparent, transparent 3px, #D9CFC7 3px, #D9CFC7 4px)', opacity: 0.6 }} />
            </div>
            <span style={{ fontSize: '10px', color: '#39332E', fontFamily: 'Inter, sans-serif' }}>Analysis unsupported for this file</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#B58A4A', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '10px' }}>
              !
            </div>
            <span style={{ fontSize: '10px', color: '#39332E', fontFamily: 'Inter, sans-serif' }}>Analysis incomplete</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <div style={{ width: '18px', height: '18px', borderRadius: '3px', border: '1px dashed #B77C61', color: '#B77C61', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '10px' }}>
              ?
            </div>
            <span style={{ fontSize: '10px', color: '#39332E', fontFamily: 'Inter, sans-serif' }}>External dependency not resolved</span>
          </div>

          <div style={{ fontSize: '10.5px', color: '#81776F', fontFamily: 'Inter, sans-serif', marginTop: '6px' }}>
            Nothing is drawn without evidence.
          </div>
        </div>
      )}

      {/* EXTERNAL: Subtitle */}
      {isExternal && (
        <div style={{ position: 'absolute', bottom: '14px', left: '18px', fontSize: '9.5px', color: '#B77C61', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
          External · not resolved
        </div>
      )}
    </div>
  );
});

CityDistrictNode.displayName = 'CityDistrictNode';
