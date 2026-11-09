import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  X,
  Layers,
  ArrowRight,
  Flame,
  Activity,
  History,
  GitCommit,
  ShieldCheck,
  FileCode,
  Gauge
} from 'lucide-react';
import { codecityApi } from '../../api/codecityApi';

export const ArchitectureIntelligenceDrawer = ({
  repositoryId,
  isOpen,
  onClose,
  onNavigateToEntity = () => {},
  onSelectCycle = () => {}
}) => {
  const [activeTab, setActiveTab] = useState('overview'); // overview, hotspots, cycles, coupling, warnings, history
  const [intelligence, setIntelligence] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [warningFilter, setWarningFilter] = useState('ALL'); // ALL, CRITICAL, WARNING, INFO

  useEffect(() => {
    if (!isOpen || !repositoryId) return;

    let isMounted = true;
    const fetchIntelligence = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await codecityApi.getArchitectureIntelligence(repositoryId);
        if (isMounted) {
          setIntelligence(data);
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to load intelligence');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchIntelligence();
    return () => { isMounted = false; };
  }, [isOpen, repositoryId]);

  if (!isOpen) return null;

  const warnings = intelligence?.warnings || [];
  const criticalCount = warnings.filter(w => w.severity === 'CRITICAL').length;
  const warningCount = warnings.filter(w => w.severity === 'WARNING').length;
  const infoCount = warnings.filter(w => w.severity === 'INFO').length;

  const filteredWarnings = warnings.filter(w => {
    if (warningFilter === 'ALL') return true;
    return w.severity === warningFilter;
  });

  return (
    <div
      style={{
        position: 'fixed',
        top: '56px',
        right: 0,
        bottom: 0,
        width: '520px',
        maxWidth: '90vw',
        background: '#EFE9E3',
        borderLeft: '1px solid #D9CFC7',
        boxShadow: '-8px 0 32px rgba(57, 51, 46, 0.15)',
        zIndex: 80,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Inter', system-ui, sans-serif",
        color: '#39332E'
      }}
    >
      {/* Drawer Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #D9CFC7',
          background: '#161d30',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0a0f1d'
            }}
          >
            <Sparkles size={18} />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.01em' }}>
              Architecture Intelligence
            </div>
            <div style={{ fontSize: '11px', color: '#62574E', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{intelligence?.repositoryName || 'Repository'}</span>
              <span>•</span>
              <span style={{ fontFamily: 'monospace', color: '#587C78' }}>
                {intelligence?.commitSha?.substring(0, 7) || 'HEAD'}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#62574E',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Close drawer"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid #D9CFC7',
          background: '#121828',
          overflowX: 'auto',
          padding: '0 8px'
        }}
      >
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'hotspots', label: `Hotspots (${intelligence?.hotspots?.length || 0})` },
          { id: 'cycles', label: `Cycles (${intelligence?.circularDependencies?.length || 0})` },
          { id: 'coupling', label: 'Coupling' },
          {
            id: 'warnings',
            label: 'Warnings',
            badge: warnings.length > 0 ? warnings.length : null,
            badgeColor: criticalCount > 0 ? '#B7655D' : '#B58A4A'
          },
          { id: 'history', label: 'Snapshots' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 14px',
              fontSize: '12px',
              fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? '#587C78' : '#62574E',
              borderBottom: activeTab === tab.id ? '2px solid #587C78' : '2px solid transparent',
              background: 'none',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>{tab.label}</span>
            {tab.badge && (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: tab.badgeColor,
                  color: '#ffffff'
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#62574E' }}>
            <RefreshCw size={24} className="spin-anim" style={{ margin: '0 auto 12px' }} />
            <div>Computing architecture intelligence metrics...</div>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '16px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid #B7655D',
              borderRadius: '8px',
              color: '#f87171',
              fontSize: '13px'
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>Error Loading Intelligence</div>
            <div>{error}</div>
          </div>
        )}

        {!loading && !error && intelligence && (
          <>
            {/* ========================================================= */}
            {/* OVERVIEW TAB                                              */}
            {/* ========================================================= */}
            {activeTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Primary Metrics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  <div style={{ background: '#FFFFFF', padding: '14px', borderRadius: '8px', border: '1px solid #D9CFC7' }}>
                    <div style={{ fontSize: '11px', color: '#62574E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Analyzed Files
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: '#587C78', marginTop: '4px' }}>
                      {intelligence.totalAnalyzedFiles}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      Source AST declarations
                    </div>
                  </div>

                  <div style={{ background: '#FFFFFF', padding: '14px', borderRadius: '8px', border: '1px solid #D9CFC7' }}>
                    <div style={{ fontSize: '11px', color: '#62574E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Declarations & Methods
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: '#64836B', marginTop: '4px' }}>
                      {intelligence.totalDeclarations} <span style={{ fontSize: '14px', color: '#62574E' }}>/ {intelligence.totalMethods}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      Classes / Methods & Endpoints
                    </div>
                  </div>

                  <div style={{ background: '#FFFFFF', padding: '14px', borderRadius: '8px', border: '1px solid #D9CFC7' }}>
                    <div style={{ fontSize: '11px', color: '#62574E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Districts & Packages
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: '#c084fc', marginTop: '4px' }}>
                      {intelligence.totalDistricts}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      Architectural modules
                    </div>
                  </div>

                  <div style={{ background: '#FFFFFF', padding: '14px', borderRadius: '8px', border: '1px solid #D9CFC7' }}>
                    <div style={{ fontSize: '11px', color: '#62574E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Analysis Coverage
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: '#B58A4A', marginTop: '4px' }}>
                      {intelligence.analysisCoverage}%
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      {intelligence.resolvedRelationships} resolved / {intelligence.totalDependencies} total
                    </div>
                  </div>
                </div>

                {/* Evidence & Integrity Notice */}
                <div
                  style={{
                    background: '#151c2e',
                    border: '1px solid #243048',
                    borderRadius: '8px',
                    padding: '14px',
                    fontSize: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#64836B', marginBottom: '6px' }}>
                    <ShieldCheck size={16} />
                    <span>Evidence-Based Software Architecture</span>
                  </div>
                  <div style={{ color: '#62574E', lineHeight: 1.5 }}>
                    Every metric is strictly extracted from repository AST nodes, package declarations, and directed graph dependencies. Gaps and external unindexed libraries are displayed honestly without synthetic guesses.
                  </div>
                </div>

                {/* Test Intelligence Card */}
                <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '8px', border: '1px solid #D9CFC7' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={15} style={{ color: '#10b981' }} />
                    <span>Test Intelligence</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', textAlign: 'center' }}>
                    <div style={{ background: '#EFE9E3', padding: '10px', borderRadius: '6px' }}>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#587C78' }}>
                        {intelligence.testIntelligence?.testFilesCount || 0}
                      </div>
                      <div style={{ fontSize: '10px', color: '#62574E' }}>Test Files</div>
                    </div>
                    <div style={{ background: '#EFE9E3', padding: '10px', borderRadius: '6px' }}>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#10b981' }}>
                        {intelligence.testIntelligence?.testedComponentsCount || 0}
                      </div>
                      <div style={{ fontSize: '10px', color: '#62574E' }}>Tested Classes</div>
                    </div>
                    <div style={{ background: '#EFE9E3', padding: '10px', borderRadius: '6px' }}>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#62574E' }}>
                        {intelligence.testIntelligence?.untestedComponentsCount || 0}
                      </div>
                      <div style={{ fontSize: '10px', color: '#62574E' }}>Untested Classes</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '8px', fontStyle: 'italic' }}>
                    Mapped via direct AST import/call edges. Does not claim runtime line coverage.
                  </div>
                </div>

                {/* Runtime Telemetry Card */}
                <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '8px', border: '1px solid #D9CFC7' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Activity size={15} style={{ color: intelligence.runtimePerformance?.telemetryAvailable ? '#06b6d4' : '#64748b' }} />
                    <span>Runtime Telemetry Insights</span>
                  </div>
                  {intelligence.runtimePerformance?.telemetryAvailable ? (
                    <div>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#39332E', marginBottom: '10px' }}>
                        <div>Traces: <strong style={{ color: '#06b6d4' }}>{intelligence.runtimePerformance.totalTraces}</strong></div>
                        <div>Avg Duration: <strong style={{ color: '#06b6d4' }}>{intelligence.runtimePerformance.averageDurationMs} ms</strong></div>
                        <div>Errors: <strong style={{ color: '#f87171' }}>{intelligence.runtimePerformance.errorCount}</strong></div>
                      </div>
                      <div style={{ fontSize: '11px', color: '#62574E', fontWeight: 600, marginBottom: '6px' }}>Slowest Observed Spans:</div>
                      {intelligence.runtimePerformance.slowestSpans?.map((span, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: '#EFE9E3',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            marginBottom: '6px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 600, color: '#39332E' }}>{span.componentName}</span>
                            <span style={{ color: '#64748b' }}> • {span.operationName}</span>
                          </div>
                          <span style={{ fontFamily: 'monospace', color: span.durationMs > 100 ? '#B58A4A' : '#587C78' }}>
                            {span.durationMs}ms
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '11.5px', color: '#62574E', fontStyle: 'italic', padding: '8px 0' }}>
                      No telemetry traces recorded for this repository. CodeCity displays verified static AST architecture without fabricating runtime traces.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* HOTSPOTS TAB                                              */}
            {/* ========================================================= */}
            {activeTab === 'hotspots' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div
                  style={{
                    background: '#151c2e',
                    border: '1px solid #D9CFC7',
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '11px',
                    color: '#62574E'
                  }}
                >
                  <strong style={{ color: '#B58A4A' }}>Hotspot Formula:</strong> Score = (fan-in × 2.0) + (fan-out × 1.5) + (LOC / 50.0) + (unresolved × 3.0). Components with high inbound callers and outbound dependencies are primary candidates for refactoring.
                </div>

                {intelligence.hotspots?.map((hotspot, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #D9CFC7',
                      borderRadius: '8px',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#ffffff' }}>
                          {hotspot.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace', marginTop: '2px' }}>
                          {hotspot.filePath || hotspot.nodeKey}
                        </div>
                      </div>
                      <div
                        style={{
                          background: 'rgba(245, 158, 11, 0.15)',
                          border: '1px solid #B58A4A',
                          color: '#B58A4A',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 700
                        }}
                      >
                        Score {hotspot.score}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '10.5px', background: '#EFE9E3', padding: '3px 8px', borderRadius: '4px', color: '#587C78' }}>
                        Fan-in: {hotspot.fanIn} callers
                      </span>
                      <span style={{ fontSize: '10.5px', background: '#EFE9E3', padding: '3px 8px', borderRadius: '4px', color: '#c084fc' }}>
                        Fan-out: {hotspot.fanOut} deps
                      </span>
                      <span style={{ fontSize: '10.5px', background: '#EFE9E3', padding: '3px 8px', borderRadius: '4px', color: '#62574E' }}>
                        {hotspot.lineCount} LOC
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                      {hotspot.reasons?.map((reason, rIdx) => (
                        <div key={rIdx} style={{ fontSize: '11px', color: '#62574E', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: '#B58A4A' }}>•</span>
                          <span>{reason}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => onNavigateToEntity(hotspot.nodeKey)}
                      style={{
                        marginTop: '6px',
                        background: '#1d263b',
                        border: '1px solid #2e3c59',
                        color: '#587C78',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <span>Locate in Metropolis</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* ========================================================= */}
            {/* CYCLES TAB                                                */}
            {/* ========================================================= */}
            {activeTab === 'cycles' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div
                  style={{
                    background: '#151c2e',
                    border: '1px solid #D9CFC7',
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '11px',
                    color: '#62574E'
                  }}
                >
                  <strong style={{ color: '#64836B' }}>Cycle Detection:</strong> Evaluated using Tarjan's Strongly Connected Components (SCC) algorithm on directed code dependencies (CALLS, PERSISTS_TO, DEPENDS_ON).
                </div>

                {(!intelligence.circularDependencies || intelligence.circularDependencies.length === 0) ? (
                  <div
                    style={{
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid #10b981',
                      borderRadius: '8px',
                      padding: '24px',
                      textAlign: 'center',
                      color: '#6ee7b7'
                    }}
                  >
                    <CheckCircle2 size={32} style={{ margin: '0 auto 10px', color: '#10b981' }} />
                    <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
                      No Circular Dependencies Detected
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#62574E', maxWidth: '380px', margin: '0 auto' }}>
                      All internal components adhere to a clean Directed Acyclic Graph (DAG) hierarchy without mutually recursive coupling loops.
                    </div>
                  </div>
                ) : (
                  intelligence.circularDependencies.map((cycle, cIdx) => (
                    <div
                      key={cIdx}
                      style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid #B7655D',
                        borderRadius: '8px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#f87171' }}>
                          CYCLE #{cIdx + 1} ({cycle.length} Components)
                        </span>
                        <span style={{ fontSize: '10px', background: '#B7655D', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                          CRITICAL
                        </span>
                      </div>

                      {/* Path sequence */}
                      <div
                        style={{
                          background: '#EFE9E3',
                          padding: '10px',
                          borderRadius: '6px',
                          fontFamily: 'monospace',
                          fontSize: '11px',
                          color: '#fca5a5',
                          lineHeight: 1.6
                        }}
                      >
                        {cycle.cyclePath?.join(' ➔ ')}
                      </div>

                      <div style={{ fontSize: '11px', color: '#62574E' }}>
                        Participating Edges:
                      </div>
                      {cycle.participatingEdges?.map((edge, eIdx) => (
                        <div
                          key={eIdx}
                          style={{
                            fontSize: '10.5px',
                            color: '#39332E',
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '4px 8px',
                            background: '#171e2e',
                            borderRadius: '4px'
                          }}
                        >
                          <span>{edge.sourceKey?.split('.').pop()} ➔ {edge.targetKey?.split('.').pop()}</span>
                          <span style={{ color: '#f87171' }}>{edge.relationshipType}</span>
                        </div>
                      ))}

                      <button
                        onClick={() => onSelectCycle(cycle)}
                        style={{
                          background: '#281a20',
                          border: '1px solid #B7655D',
                          color: '#fca5a5',
                          padding: '7px 12px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <span>Highlight Cycle Path in City</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ========================================================= */}
            {/* COUPLING TAB                                              */}
            {/* ========================================================= */}
            {activeTab === 'coupling' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div
                  style={{
                    background: '#151c2e',
                    border: '1px solid #D9CFC7',
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '11px',
                    color: '#62574E'
                  }}
                >
                  <strong style={{ color: '#587C78' }}>Martin's Instability Metric:</strong> Instability (I) = Ce / (Ca + Ce). Value of 0.0 indicates completely stable (depended upon by others), while 1.0 indicates completely fragile/efferent (depends heavily on others).
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #D9CFC7', color: '#62574E', textAlign: 'left' }}>
                        <th style={{ padding: '8px 6px' }}>District</th>
                        <th style={{ padding: '8px 6px' }}>Classes</th>
                        <th style={{ padding: '8px 6px' }}>Ca</th>
                        <th style={{ padding: '8px 6px' }}>Ce</th>
                        <th style={{ padding: '8px 6px' }}>Instability</th>
                      </tr>
                    </thead>
                    <tbody>
                      {intelligence.districtCoupling?.map((dist, idx) => (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: '1px solid #1a2233',
                            background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'
                          }}
                        >
                          <td style={{ padding: '8px 6px', fontWeight: 600, color: '#39332E' }}>
                            {dist.districtName}
                          </td>
                          <td style={{ padding: '8px 6px', color: '#62574E' }}>
                            {dist.componentCount}
                          </td>
                          <td style={{ padding: '8px 6px', color: '#64836B' }}>
                            {dist.afferentCoupling}
                          </td>
                          <td style={{ padding: '8px 6px', color: '#B58A4A' }}>
                            {dist.efferentCoupling}
                          </td>
                          <td style={{ padding: '8px 6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div
                                style={{
                                  width: '40px',
                                  height: '5px',
                                  background: '#242f46',
                                  borderRadius: '3px',
                                  overflow: 'hidden'
                                }}
                              >
                                <div
                                  style={{
                                    width: `${dist.instability * 100}%`,
                                    height: '100%',
                                    background: dist.instability > 0.8 ? '#B7655D' : dist.instability > 0.4 ? '#B58A4A' : '#10b981'
                                  }}
                                />
                              </div>
                              <span style={{ fontFamily: 'monospace', color: '#39332E' }}>
                                {dist.instability.toFixed(2)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* WARNINGS TAB                                              */}
            {/* ========================================================= */}
            {activeTab === 'warnings' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Warning Filter Pills */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[
                    { id: 'ALL', label: `All (${warnings.length})` },
                    { id: 'CRITICAL', label: `Critical (${criticalCount})` },
                    { id: 'WARNING', label: `Warning (${warningCount})` },
                    { id: 'INFO', label: `Info (${infoCount})` }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setWarningFilter(f.id)}
                      style={{
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: warningFilter === f.id ? 700 : 500,
                        background: warningFilter === f.id ? '#253147' : '#171e2e',
                        border: '1px solid #D9CFC7',
                        color: warningFilter === f.id ? '#ffffff' : '#62574E',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {filteredWarnings.map((warn, idx) => {
                  const isCritical = warn.severity === 'CRITICAL';
                  const isWarn = warn.severity === 'WARNING';
                  const borderColor = isCritical ? '#B7655D' : isWarn ? '#B58A4A' : '#587C78';
                  const badgeColor = isCritical ? '#B7655D' : isWarn ? '#B58A4A' : '#587C78';

                  return (
                    <div
                      key={idx}
                      style={{
                        background: '#FFFFFF',
                        border: `1px solid ${borderColor}`,
                        borderRadius: '8px',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: badgeColor,
                            color: '#ffffff'
                          }}
                        >
                          {warn.severity}
                        </span>
                        <span style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
                          {warn.category}
                        </span>
                      </div>

                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                        {warn.entityName}
                      </div>

                      <div style={{ fontSize: '11.5px', color: '#39332E', lineHeight: 1.5 }}>
                        {warn.message}
                      </div>

                      <div style={{ fontSize: '10.5px', color: '#62574E', background: '#EFE9E3', padding: '6px 8px', borderRadius: '4px' }}>
                        <strong>Evidence:</strong> {warn.evidence}
                      </div>

                      <div style={{ fontSize: '10.5px', color: '#64836B' }}>
                        <strong>Recommendation:</strong> {warn.suggestedAction}
                      </div>

                      {warn.entityKey && !warn.entityKey.startsWith('repo:') && (
                        <button
                          onClick={() => onNavigateToEntity(warn.entityKey)}
                          style={{
                            marginTop: '4px',
                            background: '#1e283d',
                            border: '1px solid #2e3c59',
                            color: '#587C78',
                            padding: '5px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px'
                          }}
                        >
                          <span>Locate in City</span>
                          <ArrowRight size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ========================================================= */}
            {/* HISTORY / SNAPSHOTS TAB                                   */}
            {/* ========================================================= */}
            {activeTab === 'history' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div
                  style={{
                    background: '#151c2e',
                    border: '1px solid #D9CFC7',
                    borderRadius: '8px',
                    padding: '14px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff', fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
                    <History size={16} style={{ color: '#587C78' }} />
                    <span>Snapshot Delta Comparison</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#62574E', lineHeight: 1.5 }}>
                    {intelligence.snapshotDelta?.message}
                  </div>
                </div>

                {intelligence.snapshotDelta?.hasMultipleSnapshots ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                      <div style={{ background: '#FFFFFF', padding: '12px', borderRadius: '6px', border: '1px solid #D9CFC7' }}>
                        <div style={{ fontSize: '11px', color: '#10b981' }}>Added Files</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>
                          +{intelligence.snapshotDelta.addedFilesCount}
                        </div>
                      </div>
                      <div style={{ background: '#FFFFFF', padding: '12px', borderRadius: '6px', border: '1px solid #D9CFC7' }}>
                        <div style={{ fontSize: '11px', color: '#f87171' }}>Removed Files</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>
                          -{intelligence.snapshotDelta.removedFilesCount}
                        </div>
                      </div>
                      <div style={{ background: '#FFFFFF', padding: '12px', borderRadius: '6px', border: '1px solid #D9CFC7' }}>
                        <div style={{ fontSize: '11px', color: '#10b981' }}>Added Relationships</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>
                          +{intelligence.snapshotDelta.addedRelationshipsCount}
                        </div>
                      </div>
                      <div style={{ background: '#FFFFFF', padding: '12px', borderRadius: '6px', border: '1px solid #D9CFC7' }}>
                        <div style={{ fontSize: '11px', color: '#f87171' }}>Removed Relationships</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>
                          -{intelligence.snapshotDelta.removedRelationshipsCount}
                        </div>
                      </div>
                    </div>

                    {intelligence.snapshotDelta.addedFiles?.length > 0 && (
                      <div style={{ background: '#FFFFFF', padding: '12px', borderRadius: '6px', border: '1px solid #D9CFC7' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', marginBottom: '6px' }}>
                          Recently Added Files:
                        </div>
                        {intelligence.snapshotDelta.addedFiles.slice(0, 10).map((f, i) => (
                          <div key={i} style={{ fontSize: '10.5px', color: '#62574E', fontFamily: 'monospace', marginBottom: '3px' }}>
                            + {f}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #D9CFC7',
                      borderRadius: '8px',
                      padding: '20px',
                      textAlign: 'center',
                      color: '#62574E',
                      fontSize: '12px'
                    }}
                  >
                    <GitCommit size={28} style={{ margin: '0 auto 8px', color: '#64748b' }} />
                    <div style={{ color: '#39332E', fontWeight: 600, marginBottom: '4px' }}>
                      Single Baseline Snapshot
                    </div>
                    <div>
                      When code changes are pushed or the repository is re-indexed at a new commit SHA, CodeCity will compute diffs, added/removed nodes, and architectural drift.
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

