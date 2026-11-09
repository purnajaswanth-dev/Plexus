import React, { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from '@xyflow/react';

const getRoadStyle = (relationshipType, roadType, isExecutionPath, isSubdued) => {
  if (isExecutionPath) {
    return {
      roadbedWidth: 16,
      roadbedColor: '#C09A62',
      roadbedOpacity: 0.16,
      laneWidth: 4,
      laneColor: '#C09A62',
      dashArray: '11 8',
      animated: true,
      glow: '0 0 16px rgba(192, 154, 98, 0.8)'
    };
  }

  const rel = (relationshipType || '').toUpperCase();
  if (rel === 'CALLS' || roadType === 'HIGHWAY') {
    return {
      roadbedWidth: 12,
      roadbedColor: isSubdued ? 'rgba(217, 207, 199, 0.25)' : 'rgba(217, 207, 199, 0.75)',
      roadbedOpacity: 1,
      laneWidth: 3,
      laneColor: isSubdued ? 'rgba(113, 134, 155, 0.2)' : '#71869B',
      dashArray: null,
      animated: false
    };
  }
  if (rel === 'PERSISTS_TO' || roadType === 'ARTERIAL') {
    return {
      roadbedWidth: 12,
      roadbedColor: isSubdued ? 'rgba(217, 207, 199, 0.25)' : 'rgba(217, 207, 199, 0.75)',
      roadbedOpacity: 1,
      laneWidth: 3,
      laneColor: isSubdued ? 'rgba(141, 145, 107, 0.2)' : '#8D916B',
      dashArray: null,
      animated: false
    };
  }
  if (rel === 'EXTERNAL') {
    return {
      roadbedWidth: 10,
      roadbedColor: isSubdued ? 'rgba(217, 207, 199, 0.2)' : 'rgba(217, 207, 199, 0.65)',
      roadbedOpacity: 1,
      laneWidth: 2.5,
      laneColor: isSubdued ? 'rgba(183, 124, 97, 0.2)' : '#B77C61',
      dashArray: '5 4',
      animated: false
    };
  }
  if (rel === 'EVENT_ASYNC' || rel === 'ASYNC') {
    return {
      roadbedWidth: 10,
      roadbedColor: isSubdued ? 'rgba(217, 207, 199, 0.2)' : 'rgba(217, 207, 199, 0.65)',
      roadbedOpacity: 1,
      laneWidth: 2.5,
      laneColor: isSubdued ? 'rgba(146, 125, 145, 0.2)' : '#927D91',
      dashArray: '6 5',
      animated: false
    };
  }
  // IMPLEMENTS / EXTENDS / STRUCTURAL
  return {
    roadbedWidth: 8,
    roadbedColor: isSubdued ? 'rgba(217, 207, 199, 0.15)' : 'rgba(217, 207, 199, 0.55)',
    roadbedOpacity: 1,
    laneWidth: 2,
    laneColor: isSubdued ? 'rgba(88, 124, 120, 0.2)' : '#587C78',
    dashArray: '1 6',
    animated: false
  };
};

export const CityRoadEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data = {}
}) => {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 20
  });

  const {
    relationshipType = 'CALLS',
    roadType = 'LOCAL',
    roadName,
    isExecutionPath = false,
    stepIndex = null,
    isSubdued = false
  } = data;

  const cfg = getRoadStyle(relationshipType, roadType, isExecutionPath, isSubdued);

  return (
    <>
      {/* 1. Underlying Asphalt Roadbed Surface */}
      <path
        d={edgePath}
        fill="none"
        stroke={cfg.roadbedColor}
        strokeWidth={cfg.roadbedWidth}
        opacity={cfg.roadbedOpacity !== undefined ? cfg.roadbedOpacity : 1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 2. Center Traffic Lane / High-Speed Conduit */}
      <path
        d={edgePath}
        fill="none"
        stroke={cfg.laneColor}
        strokeWidth={cfg.laneWidth}
        strokeDasharray={cfg.dashArray || undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={isExecutionPath ? 'active-road-pulse' : ''}
        style={{
          filter: cfg.glow ? `drop-shadow(${cfg.glow})` : undefined
        }}
      />

      {/* 3. Interactive Route Step Badge on Active Execution Road */}
      {isExecutionPath && stepIndex != null && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all'
            }}
            className="road-journey-step-tag"
            title={roadName || `Step ${stepIndex}: ${relationshipType}`}
          >
            <span className="step-tag-dot" />
            <span className="step-tag-num">Step {stepIndex}</span>
            <span className="step-tag-type">{relationshipType}</span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

CityRoadEdge.displayName = 'CityRoadEdge';
