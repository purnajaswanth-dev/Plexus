import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

export const CityBuildingNode = memo(({ data, selected }) => {
  const {
    name = 'Component',
    fileName,
    componentType = 'CLASS',
    methods = [],
    rooms = [],
    isActivePath = false,
    activeStepIndex = null,
    isCurrentActiveStep = false,
    activeWorkstationId = null,
    activeRoomId = null,
    activeScope = 'BUILDING',
    isSubdued = false,
    color,
    gapStatus = 'NONE',
    gapReason = null,
    width = 110,
    height = 62
  } = data;

  // Determine building color by componentType
  const typeUpper = (componentType || '').toUpperCase();
  let bg = color || '#D9CFC7';

  if (typeUpper.includes('CONTROLLER')) {
    bg = '#587C78';
  } else if (typeUpper.includes('SERVICE')) {
    bg = isCurrentActiveStep ? '#8599ad' : '#71869B';
  } else if (typeUpper.includes('REPOSITORY') || typeUpper.includes('DAO')) {
    bg = '#8D916B';
  } else if (typeUpper.includes('ENTITY') || typeUpper.includes('TABLE') || typeUpper.includes('MODEL')) {
    bg = '#9EA37E';
  } else if (typeUpper.includes('CONFIG') || typeUpper.includes('SECURITY')) {
    bg = '#C09A62';
  } else if (typeUpper.includes('EVENT')) {
    bg = '#927D91';
  }

  // Display name and extension
  const cleanName = name.replace(/\.java$/, '').replace(/\.js$/, '');
  const ext = fileName && fileName.endsWith('.yml') ? '.yml' : (fileName && fileName.endsWith('.js') ? '.js' : '.java');

  // Find active room or workstation name if inside this building
  let activeWorkstationName = null;
  if (rooms && rooms.length > 0 && activeWorkstationId) {
    for (const r of rooms) {
      if (r.workstations) {
        const matchW = r.workstations.find(w => w.id === activeWorkstationId || activeWorkstationId.endsWith('#' + w.name));
        if (matchW) {
          activeWorkstationName = matchW.name;
          break;
        }
      }
    }
  }

  return (
    <div
      className={`city-building-card ${isCurrentActiveStep ? 'active-step-glow' : ''} ${isSubdued ? 'opacity-35' : ''}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        borderRadius: '6px',
        background: bg,
        position: 'relative',
        boxSizing: 'border-box',
        border: isCurrentActiveStep ? '3px solid #C09A62' : 'none',
        boxShadow: isCurrentActiveStep ? '0 0 24px rgba(192,154,98,0.7)' : 'none',
        padding: '5px 7px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'all 0.2s ease'
      }}
      title={`${cleanName}${ext} (${componentType}) - ${gapStatus !== 'NONE' ? gapReason : 'Verified'}`}
    >
      {/* Structural Connection Handles */}
      <Handle type="target" position={Position.Top} id="top" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left} id="left" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} id="right" style={{ opacity: 0 }} />

      {/* Step Badge */}
      {activeStepIndex != null && (
        <div
          style={{
            position: 'absolute',
            top: '-12px',
            left: '-12px',
            zIndex: 10
          }}
        >
          {isCurrentActiveStep ? (
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: '#C09A62',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 0 4px rgba(192,154,98,.4)',
                fontFamily: 'Inter, sans-serif'
              }}
            >
              {activeStepIndex}
            </div>
          ) : (
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: isActivePath ? '#64836B' : '#FFFFFF',
                border: isActivePath ? 'none' : '2px solid #C09A62',
                color: isActivePath ? '#ffffff' : '#C09A62',
                fontWeight: 700,
                fontSize: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'Inter, sans-serif'
              }}
            >
              {activeStepIndex}
            </div>
          )}
        </div>
      )}

      {/* Honest Gap Status or Evidence Badge */}
      {gapStatus !== 'NONE' ? (
        <div
          style={{
            position: 'absolute',
            top: '-7px',
            right: '-7px',
            padding: '1px 5px',
            borderRadius: '4px',
            background: gapStatus === 'NO_RELATIONSHIP' ? '#EFE9E3' : 'rgba(181, 138, 74, 0.15)',
            border: `1px solid ${gapStatus === 'NO_RELATIONSHIP' ? '#D9CFC7' : '#B58A4A'}`,
            color: gapStatus === 'NO_RELATIONSHIP' ? '#62574E' : '#B58A4A',
            fontSize: '8px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Inter, sans-serif'
          }}
          title={gapReason || gapStatus}
        >
          {gapStatus === 'NO_RELATIONSHIP' ? '·' : '!'}
        </div>
      ) : (
        isCurrentActiveStep && (
          <div
            style={{
              position: 'absolute',
              top: '-7px',
              right: '-7px',
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              background: 'rgba(100, 131, 107, 0.15)',
              border: '1.5px solid #64836B',
              color: '#64836B',
              fontSize: '8px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Inter, sans-serif'
            }}
            title="Active Step"
          >
            ✓
          </div>
        )
      )}

      {/* File Header */}
      <div style={{ textAlign: 'center', color: '#FFFFFF', lineHeight: 1.15 }}>
        <div style={{ fontSize: '10.5px', fontWeight: 600, fontFamily: 'Inter, sans-serif' }} className="truncate">
          {cleanName}
        </div>
        <div style={{ fontSize: '9px', fontWeight: 500, opacity: 0.85, fontFamily: 'Inter, sans-serif' }}>
          {ext}
        </div>
      </div>

      {/* Scope Indicator when Active */}
      {isCurrentActiveStep && activeWorkstationName && (
        <div
          style={{
            fontSize: '8.5px',
            fontWeight: 700,
            color: '#39332E',
            background: 'rgba(255, 255, 255, 0.92)',
            borderRadius: '3px',
            padding: '1px 3px',
            textAlign: 'center',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
          title={`Active Workstation: ${activeWorkstationName}`}
        >
          ⚙ {activeWorkstationName}()
        </div>
      )}

      {/* Rooms and Workstations (Level 3 Detail) */}
      <div style={{ display: 'flex', gap: '3px', height: '6px', marginTop: '2px' }}>
        {rooms && rooms.length > 0 ? (
          rooms.slice(0, 5).map((room, rIdx) => {
            const isRoomActive = isCurrentActiveStep && (activeRoomId === room.id || activeRoomId === room.name);
            return (
              <div
                key={room.id || rIdx}
                style={{
                  flex: 1,
                  height: '6px',
                  borderRadius: '2px',
                  background: isRoomActive ? '#C09A62' : '#FFFFFF',
                  opacity: isRoomActive ? 1 : 0.35,
                  transition: 'all 0.2s'
                }}
                title={`Room: ${room.name} (${room.workstations?.length || 0} workstations)`}
              />
            );
          })
        ) : (
          <div
            style={{
              flex: 1,
              height: '6px',
              borderRadius: '2px',
              background: isCurrentActiveStep ? '#C09A62' : '#FFFFFF',
              opacity: isCurrentActiveStep ? 1 : 0.3
            }}
          />
        )}
      </div>
    </div>
  );
});

CityBuildingNode.displayName = 'CityBuildingNode';
