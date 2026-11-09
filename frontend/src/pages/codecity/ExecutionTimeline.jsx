import React, { useState, useEffect, useRef } from 'react';

export const ExecutionTimeline = ({
  executionPath = null,
  journeyGraph = null,
  activeStepIndex = 1,
  onStepChange,
  onClose,
  showExplanationPanel,
  onToggleExplanationPanel,
  journeyMode = 'REQUEST',
  onJourneyModeChange
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0); // 0.5x, 1.0x, 2.0x
  const [selectedBranchOutcome, setSelectedBranchOutcome] = useState({});
  const timerRef = useRef(null);

  const isResponse = journeyMode === 'RESPONSE';
  const steps = isResponse && executionPath?.responseSteps?.length > 0
    ? executionPath.responseSteps
    : (executionPath?.steps || []);

  const totalSteps = steps.length;
  const branchGroups = journeyGraph?.branchGroups || [];
  const asyncFlows = journeyGraph?.asyncFlows || [];

  // Auto-play timer
  useEffect(() => {
    if (isPlaying && totalSteps > 0) {
      const intervalMs = 2000 / playbackSpeed;
      timerRef.current = setInterval(() => {
        onStepChange(prev => {
          if (prev >= totalSteps) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, intervalMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, totalSteps, playbackSpeed, onStepChange]);

  if (!executionPath || totalSteps === 0) {
    return null;
  }

  const handlePlayPause = () => {
    if (activeStepIndex >= totalSteps && !isPlaying) {
      onStepChange(1);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handlePrev = () => {
    setIsPlaying(false);
    onStepChange(Math.max(1, activeStepIndex - 1));
  };

  const handleNext = () => {
    setIsPlaying(false);
    onStepChange(Math.min(totalSteps, activeStepIndex + 1));
  };

  const handleToggleSpeed = () => {
    if (playbackSpeed === 1.0) setPlaybackSpeed(2.0);
    else if (playbackSpeed === 2.0) setPlaybackSpeed(0.5);
    else setPlaybackSpeed(1.0);
  };

  const progressPercent = totalSteps > 1
    ? ((activeStepIndex - 1) / (totalSteps - 1)) * 100
    : 100;

  return (
    <div
      className="codecity-playback-bar"
      style={{
        boxSizing: 'border-box',
        borderTop: '1px solid #D9CFC7',
        background: '#EFE9E3',
        display: 'flex',
        flexDirection: 'column',
        padding: '10px 24px',
        minHeight: asyncFlows.length > 0 ? '108px' : '74px',
        width: '100%',
        position: 'relative',
        zIndex: 40
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '22px', width: '100%' }}>
        {/* Play/Pause Button */}
        <button
          aria-label={isPlaying ? 'Pause' : 'Play'}
          onClick={handlePlayPause}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            border: 0,
            background: '#C09A62',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 'none',
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(192, 154, 98, 0.3)',
            transition: 'transform 0.15s ease'
          }}
        >
          {isPlaying ? (
            <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
              <rect x="4" y="3" width="4" height="14" rx="1" fill="#ffffff" />
              <rect x="12" y="3" width="4" height="14" rx="1" fill="#ffffff" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 22 22" aria-hidden="true" style={{ marginLeft: '2px' }}>
              <path d="M6 3l13 8-13 8z" fill="#ffffff" />
            </svg>
          )}
        </button>

        {/* Step Backward / Forward */}
        <div style={{ display: 'flex', gap: '4px', flex: 'none' }}>
          <button
            aria-label="Previous step"
            onClick={handlePrev}
            disabled={activeStepIndex <= 1}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              border: '1px solid #D9CFC7',
              background: '#FFFFFF',
              color: activeStepIndex <= 1 ? '#81776F' : '#39332E',
              fontSize: '18px',
              cursor: activeStepIndex <= 1 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ‹
          </button>
          <button
            aria-label="Next step"
            onClick={handleNext}
            disabled={activeStepIndex >= totalSteps}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              border: '1px solid #D9CFC7',
              background: '#FFFFFF',
              color: activeStepIndex >= totalSteps ? '#81776F' : '#39332E',
              fontSize: '18px',
              cursor: activeStepIndex >= totalSteps ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ›
          </button>
        </div>

        {/* Numbered Step Progress Track */}
        <div style={{ flex: 1, position: 'relative', height: '54px', minWidth: '240px' }}>
          {/* Background track bar */}
          <div
            style={{
              position: 'absolute',
              left: '30px',
              right: '30px',
              top: '12px',
              height: '4px',
              background: '#D9CFC7',
              borderRadius: '2px'
            }}
          />

          {/* Active progress fill */}
          <div
            style={{
              position: 'absolute',
              left: '30px',
              width: `calc(${progressPercent}% * (1 - 60px / 100%))`,
              maxWidth: 'calc(100% - 60px)',
              top: '12px',
              height: '4px',
              background: isResponse ? '#B77C61' : '#C09A62',
              borderRadius: '2px',
              transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          />

          {/* Step Node Circles and Labels */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              textAlign: 'center'
            }}
          >
            {steps.map(step => {
              const isCompleted = step.stepIndex < activeStepIndex;
              const isActive = step.stepIndex === activeStepIndex;
              const isReturn = step.relationshipType === 'RETURN' || step.relationshipType === 'RESPONSE_RETURN';
              const displayName = step.targetComponentName
                || step.sourceComponentName
                || `Step ${step.stepIndex}`;

              const hasBranch = step.branchCondition || (branchGroups.length > 0 && step.stepIndex === 2);

              return (
                <div
                  key={step.stepIndex}
                  style={{ width: '74px', cursor: 'pointer', position: 'relative' }}
                  onClick={() => onStepChange(step.stepIndex)}
                >
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      margin: '0 auto 6px',
                      borderRadius: '50%',
                      background: isCompleted ? (isReturn ? '#B77C61' : '#64836B') : (isActive ? '#C09A62' : '#FFFFFF'),
                      color: (isCompleted || isActive) ? '#FFFFFF' : (isReturn ? '#B77C61' : '#C09A62'),
                      border: (!isCompleted && !isActive) ? `2px solid ${isReturn ? '#B77C61' : '#C09A62'}` : 'none',
                      fontWeight: 700,
                      fontSize: '11px',
                      lineHeight: (!isCompleted && !isActive) ? '24px' : '28px',
                      boxSizing: 'border-box',
                      boxShadow: isActive ? '0 0 0 3px rgba(192, 154, 98, 0.4)' : 'none',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {isReturn ? '↩' : step.stepIndex}
                  </div>
                  <span
                    style={{
                      color: isActive ? '#39332E' : '#62574E',
                      fontWeight: isActive ? 600 : 400,
                      display: 'block',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      fontSize: '10.5px'
                    }}
                    title={`${displayName} (${step.relationshipType || 'CALL'})`}
                  >
                    {displayName}
                  </span>

                  {/* Alternative Branch Indicator if this step has an if-condition */}
                  {hasBranch && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '-14px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: '9px',
                        background: 'rgba(113, 134, 155, 0.15)',
                        color: '#71869B',
                        padding: '1px 4px',
                        borderRadius: '4px',
                        whiteSpace: 'nowrap',
                        fontWeight: 600,
                        border: '1px solid #D9CFC7'
                      }}
                      title="Conditional Branch (Alternative Outcomes Available)"
                    >
                      🔀 Branch
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Journey Mode: Request / Response Toggle */}
        <div style={{ flex: 'none', width: '210px' }}>
          <div
            style={{
              display: 'flex',
              gap: '4px',
              background: '#D9CFC7',
              borderRadius: '8px',
              padding: '3px',
              width: 'max-content'
            }}
          >
            <button
              style={{
                height: '30px',
                padding: '0 12px',
                border: 0,
                borderRadius: '6px',
                background: !isResponse ? '#C09A62' : 'transparent',
                color: !isResponse ? '#ffffff' : '#62574E',
                fontSize: '12px',
                fontWeight: !isResponse ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onClick={() => onJourneyModeChange && onJourneyModeChange('REQUEST')}
            >
              Request
            </button>
            <button
              style={{
                height: '30px',
                padding: '0 12px',
                border: 0,
                borderRadius: '6px',
                background: isResponse ? '#B77C61' : 'transparent',
                color: isResponse ? '#ffffff' : '#62574E',
                fontSize: '12px',
                fontWeight: isResponse ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onClick={() => onJourneyModeChange && onJourneyModeChange('RESPONSE')}
            >
              Response
            </button>
          </div>
          <div style={{ fontSize: '9.5px', lineHeight: 1.3, color: '#81776F', marginTop: '4px' }}>
            {isResponse
              ? 'Response follows actual return transitions unwinding the stack.'
              : 'Request follows forward method invocations & branch options.'}
          </div>
        </div>

        {/* Speed toggle */}
        <button
          style={{
            height: '38px',
            padding: '0 12px',
            borderRadius: '8px',
            border: '1px solid #D9CFC7',
            background: '#FFFFFF',
            color: '#39332E',
            fontSize: '12px',
            fontWeight: 500,
            flex: 'none',
            cursor: 'pointer'
          }}
          onClick={handleToggleSpeed}
          title="Toggle playback speed"
        >
          {playbackSpeed}×
        </button>
      </div>

      {/* Asynchronous Event Processing Lane (Prompt Part 8) */}
      {asyncFlows.length > 0 && (
        <div
          style={{
            marginTop: '8px',
            paddingTop: '6px',
            borderTop: '1px dashed #D9CFC7',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '11px',
            color: '#927D91'
          }}
        >
          <span style={{ fontWeight: 600 }}>⚡ Asynchronous Event Flow:</span>
          {asyncFlows.map((af, idx) => (
            <div
              key={af.journeyId || idx}
              style={{
                background: 'rgba(146, 125, 145, 0.15)',
                border: '1px solid #927D91',
                borderRadius: '4px',
                padding: '2px 8px',
                fontSize: '10.5px',
                color: '#39332E'
              }}
            >
              {af.inferredSummary || 'Event Consumer Flow'} (decoupled)
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
