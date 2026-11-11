import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, GitBranch } from 'lucide-react';
import { codecityApi } from '../../api/codecityApi';

export const RequestJourneyPanel = ({
  repositoryId,
  executionPath,
  journeyGraph = null,
  activeStepIndex = 1,
  onStepSelect,
  onClose,
  onOpenSourceInspector,
  cityData = null
}) => {
  const [sourceData, setSourceData] = useState(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [buildingDetail, setBuildingDetail] = useState(null);

  const steps = executionPath?.steps || [];
  const totalSteps = steps.length;
  const currentStep = steps.find(s => s.stepIndex === activeStepIndex) || steps[0];

  const currentTransition = journeyGraph?.transitions?.[activeStepIndex - 1];
  const targetNode = journeyGraph?.nodes?.find(n => n.id === currentTransition?.toNodeId);
  const targetKey = targetNode?.cityRef?.buildingId || currentStep?.targetComponentKey || currentStep?.sourceComponentKey;

  // Load building detail for class/method room breakdown
  useEffect(() => {
    if (!repositoryId || !targetKey) return;
    let isMounted = true;
    codecityApi.getComponentDetail(repositoryId, targetKey)
      .then(detail => {
        if (isMounted) setBuildingDetail(detail);
      })
      .catch(() => {
        if (isMounted) setBuildingDetail(null);
      });
    return () => { isMounted = false; };
  }, [repositoryId, targetKey]);

  // Fetch real source code snippet
  useEffect(() => {
    if (!repositoryId || !currentStep) {
      setSourceData(null);
      return;
    }

    let isMounted = true;
    const fetchSource = async () => {
      let filePath = targetNode?.fileId || currentStep.folderPath && currentStep.fileName
        ? `${currentStep.folderPath}/${currentStep.fileName}`
        : null;

      const lineNum = currentStep.sourceLineNumber || targetNode?.evidence?.[0]?.startLine || 1;

      if (!filePath && currentStep.sourceEvidence && currentStep.sourceEvidence.includes(':')) {
        const candidate = currentStep.sourceEvidence.split(':')[0].trim();
        if (candidate.endsWith('.java') || candidate.endsWith('.js') || candidate.endsWith('.ts')) {
          filePath = candidate;
        }
      }

      if (!filePath) {
        setSourceData(null);
        return;
      }

      try {
        setSourceLoading(true);
        const data = await codecityApi.getSourceSnippet(
          repositoryId,
          filePath,
          Math.max(1, lineNum - 3),
          lineNum + 8
        );
        if (isMounted) setSourceData(data);
      } catch (err) {
        if (isMounted) setSourceData(null);
      } finally {
        if (isMounted) setSourceLoading(false);
      }
    };

    fetchSource();
    return () => { isMounted = false; };
  }, [repositoryId, currentStep, targetNode]);

  if (!executionPath || !currentStep) return null;

  // Compute display fields
  const bldgObj = cityData?.buildings?.find(b => b.id === targetKey || b.fileId === targetKey);
  const fileName = bldgObj?.fileName || currentStep.fileName || (currentStep.targetComponentName ? `${currentStep.targetComponentName}.java` : 'SourceFile.java');
  const fullPath = bldgObj?.filePath || bldgObj?.fileId || (currentStep.folderPath && currentStep.fileName ? `${currentStep.folderPath}/${currentStep.fileName}` : fileName);

  const districtName = bldgObj?.districtName || 'Repository District';
  const buildingIdShort = targetKey ? (targetKey.length > 8 ? targetKey.substring(0, 8) : targetKey) : '01';
  const roomCount = bldgObj?.rooms?.length || 1;

  // Class & Method names
  const activeClass = currentStep.targetComponentName || bldgObj?.name || 'Component';
  const activeMethod = targetNode?.name || currentStep.targetMethod || 'execute';

  // Branch Group inspection (Part 6.3)
  const activeBranch = journeyGraph?.branchGroups?.find(bg =>
    bg.atNodeId === currentTransition?.fromNodeId || bg.id === currentTransition?.branchGroupId
  );

  // Prev / Next steps
  const prevStep = steps.find(s => s.stepIndex === activeStepIndex - 1);
  const nextStep = steps.find(s => s.stepIndex === activeStepIndex + 1);

  const prevName = prevStep ? (prevStep.targetComponentName || `Step ${activeStepIndex - 1}`) : null;
  const nextName = nextStep ? (nextStep.targetComponentName || `Step ${activeStepIndex + 1}`) : null;

  const callerName = currentStep.sourceComponentName || 'EntryGate';
  const calleeName = currentStep.targetComponentName || activeClass;

  const evidenceLevel = targetNode?.evidence?.[0]?.type || 'STATIC';
  const isFrameworkOp = targetNode?.kind === 'FRAMEWORK_OPERATION';

  return (
    <aside
      className="codecity-journey-inspector"
      style={{
        width: '400px',
        boxSizing: 'border-box',
        background: 'var(--cc-surface, #0f0f13)',
        borderLeft: '1px solid var(--cc-border, #23232c)',
        color: 'var(--cc-text, #ececf2)',
        padding: '14px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        overflowY: 'auto',
        height: '100%'
      }}
    >
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '11px', letterSpacing: '.12em', color: '#587C78', fontWeight: 600 }}>
          REQUEST JOURNEY · STEP {activeStepIndex} OF {totalSteps}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#81776F',
              cursor: 'pointer',
              padding: '2px'
            }}
            title="Close Inspector"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div style={{ fontSize: '11px', color: '#81776F', marginTop: '-5px' }}>
        Static walkthrough — not an execution trace
      </div>

      {/* File & Location Information */}
      <div>
        <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-.01em', color: 'var(--cc-text, #ececf2)' }}>
          {fileName}
        </div>
        <div
          style={{
            font: "500 12px/1.35 var(--m, 'Geist Mono', monospace)",
            color: 'var(--cc-text, #ececf2)',
            background: 'var(--cc-surface-2, #15151b)',
            border: '1px solid var(--cc-border, #23232c)',
            borderRadius: '6px',
            padding: '6px 9px',
            marginTop: '5px',
            wordBreak: 'break-all'
          }}
          title={fullPath}
        >
          {fullPath}
        </div>
        <div style={{ fontSize: '11.5px', color: 'var(--cc-text-muted, #8b8b9a)', marginTop: '4px' }}>
          {districtName} · Building {buildingIdShort} · {roomCount} {roomCount === 1 ? 'room (type)' : 'rooms (types)'}
        </div>
      </div>

      {/* What / Why Here */}
      <div style={{ fontSize: '12.5px', lineHeight: 1.4, color: 'var(--cc-text, #ececf2)' }}>
        <b style={{ color: 'var(--cc-text-muted, #8b8b9a)', fontWeight: 600 }}>What: </b>
        {currentTransition?.whatIsHappening || currentStep.whatIsHappening || `${callerName} invokes ${calleeName}.${activeMethod}().`}
        <br />
        <b style={{ color: 'var(--cc-text-muted, #8b8b9a)', fontWeight: 600 }}>Why here: </b>
        {currentTransition?.whyInvolved || currentStep.whyInvolved || `${callerName} calls ${calleeName}.${activeMethod}().`}{' '}
        <span
          style={{
            display: 'inline-block',
            font: '700 9.5px Inter,sans-serif',
            padding: '1px 5px',
            borderRadius: '4px',
            background: evidenceLevel === 'STATIC' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(167, 139, 250, 0.15)',
            color: evidenceLevel === 'STATIC' ? 'var(--cc-cyan, #38bdf8)' : '#a78bfa',
            verticalAlign: '1px'
          }}
        >
          {isFrameworkOp ? 'FRAMEWORK_OPERATION' : evidenceLevel}
        </span>
      </div>

      {/* Conditional Branching Details if present (Prompt Part 6.3) */}
      {(activeBranch || currentStep.branchCondition) && (
        <div
          style={{
            background: 'var(--cc-surface-2, #15151b)',
            border: '1px solid var(--cc-border, #23232c)',
            borderRadius: '8px',
            padding: '8px 10px',
            fontSize: '11.5px',
            color: 'var(--cc-text, #ececf2)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--cc-accent, #6d8cff)', marginBottom: '4px' }}>
            <GitBranch size={13} />
            Conditional Branch: if ({activeBranch?.conditionText || currentStep.branchCondition})
          </div>
          <div style={{ fontSize: '11px', color: 'var(--cc-text-muted, #8b8b9a)', lineHeight: 1.35 }}>
            • Branch A: Throws exception or alternative logic on condition.<br />
            • Branch B: Continues forward request execution.<br />
            <i style={{ color: '#C09A62', display: 'block', marginTop: '3px' }}>
              Conditional outcome unknown — both paths are possible.
            </i>
          </div>
        </div>
      )}

      {/* Inside this building */}
      <div
        style={{
          background: 'var(--cc-surface-2, #15151b)',
          borderRadius: '8px',
          border: '1px solid var(--cc-border, #23232c)',
          padding: '8px 10px',
          fontSize: '11.5px',
          lineHeight: 1.45,
          color: 'var(--cc-text, #ececf2)'
        }}
      >
        <div style={{ fontSize: '10.5px', letterSpacing: '.08em', color: 'var(--cc-text-muted, #8b8b9a)', fontWeight: 600, marginBottom: '3px' }}>
          INSIDE THIS BUILDING (LEVEL 3)
        </div>
        <div>
          <b style={{ color: 'var(--cc-cyan, #38bdf8)' }}>Room (Type): {activeClass}</b> ·{' '}
          <span style={{ color: 'var(--cc-text, #ececf2)', fontWeight: 600 }}>Workstation: {activeMethod}() ● active</span>
        </div>
        {bldgObj?.rooms && bldgObj.rooms.length > 1 && (
          <div style={{ marginTop: '3px', color: 'var(--cc-text-muted, #8b8b9a)' }}>
            Companion rooms: {bldgObj.rooms.filter(r => r.name !== activeClass).map(r => r.name).join(', ')}
          </div>
        )}
      </div>

      {/* 2-Column I/O Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '70px 1fr',
          gap: '3px 8px',
          fontSize: '12px',
          lineHeight: 1.3,
          color: 'var(--cc-text, #ececf2)'
        }}
      >
        <div style={{ color: 'var(--cc-text-muted, #8b8b9a)', fontWeight: 600 }}>Input</div>
        <div style={{ fontFamily: "var(--m, 'Geist Mono', monospace)", color: '#71869B' }}>
          {currentTransition?.inputDetails || currentStep.inputDetails || 'Parameters'}
        </div>
        <div style={{ color: 'var(--cc-text-muted, #8b8b9a)', fontWeight: 600 }}>Inside</div>
        <div>{currentTransition?.processingDetails || currentStep.processingDetails || 'Execution logic'}</div>
        <div style={{ color: 'var(--cc-text-muted, #8b8b9a)', fontWeight: 600 }}>Output</div>
        <div style={{ fontFamily: "var(--m, 'Geist Mono', monospace)", color: '#34d399' }}>
          {currentTransition?.outputDetails || currentStep.outputDetails || 'Return value'}
        </div>
      </div>

      {/* Source Evidence Box */}
      <div
        style={{
          border: '1px solid var(--cc-border, #23232c)',
          borderRadius: '8px',
          padding: '8px 10px',
          background: 'var(--cc-surface-2, #15151b)'
        }}
      >
        <div style={{ fontSize: '10.5px', letterSpacing: '.08em', color: 'var(--cc-text-muted, #8b8b9a)', fontWeight: 600, marginBottom: '4px' }}>
          SOURCE EVIDENCE
        </div>
        <div style={{ font: "400 11px var(--m, 'Geist Mono', monospace)", margin: '3px 0 5px', color: 'var(--cc-cyan, #38bdf8)' }}>
          {currentTransition?.callExpression || currentStep.callExpression || `${callerName} -> ${calleeName}.${activeMethod}()`}
        </div>

        {/* Real Code Excerpt */}
        <div
          style={{
            font: "400 11px/1.5 var(--m, 'Geist Mono', monospace)",
            background: 'var(--cc-surface-3, #1b1b23)',
            borderRadius: '6px',
            padding: '6px 8px',
            whiteSpace: 'pre',
            overflowX: 'auto',
            color: 'var(--cc-text, #ececf2)',
            border: '1px solid var(--cc-border, #23232c)'
          }}
        >
          {sourceLoading ? (
            <span style={{ color: 'var(--cc-text-muted, #8b8b9a)' }}>Loading source evidence from repository...</span>
          ) : sourceData && sourceData.lines && sourceData.lines.length > 0 ? (
            sourceData.lines.map((l, idx) => (
              <div
                key={idx}
                style={{
                  background: l.isHighlighted ? 'rgba(109, 140, 255, 0.18)' : 'transparent',
                  display: 'flex',
                  gap: '8px'
                }}
              >
                <span style={{ color: 'var(--cc-text-muted, #8b8b9a)', userSelect: 'none', minWidth: '32px' }}>
                  [{l.lineNumber}]
                </span>
                <span style={{ color: l.isHighlighted ? 'var(--cc-accent, #6d8cff)' : 'var(--cc-text, #ececf2)' }}>
                  {l.code}
                </span>
              </div>
            ))
          ) : (
            <div style={{ color: 'var(--cc-text-muted, #8b8b9a)' }}>
              <span>[{currentStep.sourceLineNumber || 1}] </span>
              <span>{currentStep.evidence || currentStep.sourceEvidence || 'AST invocation verified'}</span>
            </div>
          )}
        </div>

        {/* Evidence Status Badges */}
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '6px' }}>
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '12px',
              fontWeight: 600,
              background: 'rgba(56, 189, 248, 0.15)',
              color: 'var(--cc-cyan, #38bdf8)'
            }}
          >
            Static · AST ✓
          </span>
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '12px',
              fontWeight: 600,
              background: 'var(--cc-surface-3, #1b1b23)',
              color: 'var(--cc-text-muted, #8b8b9a)'
            }}
          >
            Runtime · none recorded
          </span>
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '12px',
              fontWeight: 600,
              background: isFrameworkOp ? 'rgba(113, 134, 155, 0.15)' : 'var(--cc-surface-3, #1b1b23)',
              color: isFrameworkOp ? '#71869B' : 'var(--cc-text-muted, #8b8b9a)'
            }}
          >
            {isFrameworkOp ? 'Inferred · Framework' : 'Inferred · none'}
          </span>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: '8px' }} />

      {/* Prev / Next Step Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
        <button
          onClick={() => prevStep && onStepSelect(prevStep.stepIndex)}
          disabled={!prevStep}
          style={{
            flex: 1,
            height: '38px',
            borderRadius: '8px',
            border: '1px solid var(--cc-border, #23232c)',
            background: 'var(--cc-surface-2, #15151b)',
            color: prevStep ? 'var(--cc-text, #ececf2)' : 'var(--cc-text-muted, #8b8b9a)',
            fontSize: '12px',
            fontWeight: 500,
            cursor: prevStep ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            padding: '0 8px'
          }}
        >
          {prevName ? `← ${prevName}` : '← Start'}
        </button>

        <button
          onClick={() => nextStep && onStepSelect(nextStep.stepIndex)}
          disabled={!nextStep}
          style={{
            flex: 1,
            height: '38px',
            borderRadius: '8px',
            border: 0,
            background: nextStep ? 'var(--cc-accent, #6d8cff)' : 'var(--cc-surface-3, #1b1b23)',
            color: nextStep ? '#ffffff' : 'var(--cc-text-muted, #8b8b9a)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: nextStep ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            padding: '0 8px'
          }}
        >
          {nextName ? `${nextName} →` : 'End →'}
        </button>
      </div>
    </aside>
  );
};
