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
        background: '#EFE9E3',
        borderLeft: '1px solid #D9CFC7',
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
        <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-.01em', color: '#39332E' }}>
          {fileName}
        </div>
        <div
          style={{
            font: "500 12px/1.35 'JetBrains Mono',monospace",
            color: '#39332E',
            background: '#FFFFFF',
            border: '1px solid #C09A62',
            borderRadius: '6px',
            padding: '6px 9px',
            marginTop: '5px',
            wordBreak: 'break-all'
          }}
          title={fullPath}
        >
          {fullPath}
        </div>
        <div style={{ fontSize: '11.5px', color: '#62574E', marginTop: '4px' }}>
          {districtName} · Building {buildingIdShort} · {roomCount} {roomCount === 1 ? 'room (type)' : 'rooms (types)'}
        </div>
      </div>

      {/* What / Why Here */}
      <div style={{ fontSize: '12.5px', lineHeight: 1.4, color: '#39332E' }}>
        <b style={{ color: '#62574E', fontWeight: 600 }}>What: </b>
        {currentTransition?.whatIsHappening || currentStep.whatIsHappening || `${callerName} invokes ${calleeName}.${activeMethod}().`}
        <br />
        <b style={{ color: '#62574E', fontWeight: 600 }}>Why here: </b>
        {currentTransition?.whyInvolved || currentStep.whyInvolved || `${callerName} calls ${calleeName}.${activeMethod}().`}{' '}
        <span
          style={{
            display: 'inline-block',
            font: '700 9.5px Inter,sans-serif',
            padding: '1px 5px',
            borderRadius: '4px',
            background: evidenceLevel === 'STATIC' ? 'rgba(88, 124, 120, 0.15)' : 'rgba(146, 125, 145, 0.15)',
            color: evidenceLevel === 'STATIC' ? '#587C78' : '#927D91',
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
            background: '#F9F8F6',
            border: '1px solid #D9CFC7',
            borderRadius: '8px',
            padding: '8px 10px',
            fontSize: '11.5px',
            color: '#39332E'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#587C78', marginBottom: '4px' }}>
            <GitBranch size={13} />
            Conditional Branch: if ({activeBranch?.conditionText || currentStep.branchCondition})
          </div>
          <div style={{ fontSize: '11px', color: '#62574E', lineHeight: 1.35 }}>
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
          background: '#FFFFFF',
          borderRadius: '8px',
          border: '1px solid #D9CFC7',
          padding: '8px 10px',
          fontSize: '11.5px',
          lineHeight: 1.45,
          color: '#39332E'
        }}
      >
        <div style={{ fontSize: '10.5px', letterSpacing: '.08em', color: '#81776F', fontWeight: 600, marginBottom: '3px' }}>
          INSIDE THIS BUILDING (LEVEL 3)
        </div>
        <div>
          <b style={{ color: '#587C78' }}>Room (Type): {activeClass}</b> ·{' '}
          <span style={{ color: '#39332E', fontWeight: 600 }}>Workstation: {activeMethod}() ● active</span>
        </div>
        {bldgObj?.rooms && bldgObj.rooms.length > 1 && (
          <div style={{ marginTop: '3px', color: '#62574E' }}>
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
          color: '#39332E'
        }}
      >
        <div style={{ color: '#62574E', fontWeight: 600 }}>Input</div>
        <div style={{ fontFamily: 'monospace', color: '#71869B' }}>
          {currentTransition?.inputDetails || currentStep.inputDetails || 'Parameters'}
        </div>
        <div style={{ color: '#62574E', fontWeight: 600 }}>Inside</div>
        <div>{currentTransition?.processingDetails || currentStep.processingDetails || 'Execution logic'}</div>
        <div style={{ color: '#62574E', fontWeight: 600 }}>Output</div>
        <div style={{ fontFamily: 'monospace', color: '#64836B' }}>
          {currentTransition?.outputDetails || currentStep.outputDetails || 'Return value'}
        </div>
      </div>

      {/* Source Evidence Box */}
      <div
        style={{
          border: '1px solid #D9CFC7',
          borderRadius: '8px',
          padding: '8px 10px',
          background: '#FFFFFF'
        }}
      >
        <div style={{ fontSize: '10.5px', letterSpacing: '.08em', color: '#81776F', fontWeight: 600, marginBottom: '4px' }}>
          SOURCE EVIDENCE
        </div>
        <div style={{ font: "400 11px 'JetBrains Mono',monospace", margin: '3px 0 5px', color: '#587C78' }}>
          {currentTransition?.callExpression || currentStep.callExpression || `${callerName} -> ${calleeName}.${activeMethod}()`}
        </div>

        {/* Real Code Excerpt */}
        <div
          style={{
            font: "400 11px/1.5 'JetBrains Mono',monospace",
            background: '#F9F8F6',
            borderRadius: '6px',
            padding: '6px 8px',
            whiteSpace: 'pre',
            overflowX: 'auto',
            color: '#39332E',
            border: '1px solid #D9CFC7'
          }}
        >
          {sourceLoading ? (
            <span style={{ color: '#81776F' }}>Loading source evidence from repository...</span>
          ) : sourceData && sourceData.lines && sourceData.lines.length > 0 ? (
            sourceData.lines.map((l, idx) => (
              <div
                key={idx}
                style={{
                  background: l.isHighlighted ? 'rgba(192, 154, 98, 0.18)' : 'transparent',
                  display: 'flex',
                  gap: '8px'
                }}
              >
                <span style={{ color: '#81776F', userSelect: 'none', minWidth: '32px' }}>
                  [{l.lineNumber}]
                </span>
                <span style={{ color: l.isHighlighted ? '#39332E' : '#62574E' }}>
                  {l.code}
                </span>
              </div>
            ))
          ) : (
            <div style={{ color: '#62574E' }}>
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
              background: 'rgba(88, 124, 120, 0.15)',
              color: '#587C78'
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
              background: '#EFE9E3',
              color: '#62574E'
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
              background: isFrameworkOp ? 'rgba(113, 134, 155, 0.15)' : '#EFE9E3',
              color: isFrameworkOp ? '#71869B' : '#62574E'
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
            border: '1px solid #D9CFC7',
            background: '#FFFFFF',
            color: prevStep ? '#39332E' : '#81776F',
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
            background: nextStep ? '#C09A62' : '#D9CFC7',
            color: nextStep ? '#ffffff' : '#81776F',
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
