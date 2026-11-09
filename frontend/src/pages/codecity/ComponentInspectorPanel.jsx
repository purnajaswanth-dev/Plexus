import React, { useState, useEffect } from 'react';
import {
  Box,
  Code2,
  Layers,
  GitBranch,
  ArrowUpRight,
  ArrowDownLeft,
  Shield,
  Terminal,
  Database,
  FileText,
  ChevronRight,
  X,
  FileCode,
  FolderTree,
  ExternalLink,
  MapPin,
  Clock,
  Radio,
  AlertTriangle,
  Play,
  RotateCcw,
  Zap,
  Info,
  CheckCircle,
  Activity,
  Maximize2
} from 'lucide-react';
import { codecityApi } from '../../api/codecityApi';

export const ComponentInspectorPanel = ({
  repositoryId,
  selectedEntity = null, // { type, name, data, id }
  componentDetail = null,
  cityData = null,
  repositoryData = null,
  onClose,
  onSelectEndpoint,
  onNavigateToEntity,
  onAnalyzeImpact,
  onReindex
}) => {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'methods' | 'callers' | 'callees' | 'source' | 'traces' | 'impact'
  const [sourceData, setSourceData] = useState(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [traces, setTraces] = useState([]);
  const [tracesLoading, setTracesLoading] = useState(false);
  const [impactResult, setImpactResult] = useState(null);
  const [impactLoading, setImpactLoading] = useState(false);

  // Determine current entity type
  const entityType = selectedEntity?.type || (componentDetail ? 'BUILDING' : 'REPOSITORY');

  // Reset tab when entity changes
  useEffect(() => {
    setActiveTab('overview');
    setImpactResult(null);
  }, [selectedEntity?.type, selectedEntity?.name, componentDetail?.nodeKey]);

  // Load Traces if tab is traces or if entity is Repository
  useEffect(() => {
    if (activeTab === 'traces' && repositoryId) {
      let isMounted = true;
      setTracesLoading(true);
      codecityApi.getTraces(repositoryId).then(data => {
        if (isMounted) setTraces(data || []);
      }).catch(err => {
        if (isMounted) setTraces([]);
      }).finally(() => {
        if (isMounted) setTracesLoading(false);
      });
      return () => { isMounted = false; };
    }
  }, [activeTab, repositoryId]);

  // Fetch real source code when 'source' tab is active
  useEffect(() => {
    const targetFilePath = componentDetail?.filePath || selectedEntity?.data?.filePath || selectedEntity?.data?.fileId;
    if (!targetFilePath || !repositoryId) {
      setSourceData(null);
      return;
    }

    if (activeTab === 'source') {
      let isMounted = true;
      const fetchSource = async () => {
        try {
          setSourceLoading(true);
          const startL = selectedEntity?.data?.startLine || componentDetail?.startLine || 1;
          const endL = selectedEntity?.data?.endLine || componentDetail?.endLine || (startL + 40);
          const data = await codecityApi.getSourceSnippet(repositoryId, targetFilePath, startL, endL);
          if (isMounted) setSourceData(data);
        } catch (err) {
          if (isMounted) setSourceData({ available: false, reason: err.message, filePath: targetFilePath });
        } finally {
          if (isMounted) setSourceLoading(false);
        }
      };
      fetchSource();
      return () => { isMounted = false; };
    }
  }, [componentDetail, selectedEntity, repositoryId, activeTab]);

  // Run impact analysis for third-party libraries if present
  const handleRunImpactAnalysis = async (depName) => {
    try {
      setImpactLoading(true);
      const res = await codecityApi.analyzeImpact({
        artifactId: depName,
        toVersion: '3.1.0'
      });
      setImpactResult(res);
      setActiveTab('impact');
    } catch (err) {
      setImpactResult({ error: err.message });
      setActiveTab('impact');
    } finally {
      setImpactLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // Helper: Render Evidence Pill
  // --------------------------------------------------------------------------
  const renderEvidencePill = (evidenceLevel, evidenceText) => {
    const lvl = (evidenceLevel || '').toUpperCase();
    let badge = '[S] Static AST';
    let color = '#587C78';
    let bg = 'rgba(88, 124, 120, 0.15)';

    if (lvl.includes('RUNTIME') || lvl.includes('TRACE')) {
      badge = '[R] Runtime Trace';
      color = '#64836B';
      bg = 'rgba(100, 131, 107, 0.15)';
    } else if (lvl.includes('INFERRED') || lvl.includes('STATIC_INFERENCE')) {
      badge = '[I] Static Inferred';
      color = '#C09A62';
      bg = 'rgba(192, 154, 98, 0.15)';
    } else if (lvl.includes('MANIFEST') || lvl.includes('PACKAGE')) {
      badge = '[P] Package Manifest';
      color = '#71869B';
      bg = 'rgba(113, 134, 155, 0.15)';
    } else if (lvl.includes('UNRESOLVED')) {
      badge = '[?] Unresolved';
      color = '#B7655D';
      bg = 'rgba(183, 101, 93, 0.15)';
    } else if (lvl.includes('UNSUPPORTED')) {
      badge = '[Hatch] Unsupported';
      color = '#81776F';
      bg = '#EFE9E3';
    }

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '10px',
          fontWeight: 700,
          background: bg,
          color: color,
          border: `1px solid ${color}40`,
          whiteSpace: 'nowrap'
        }}
        title={evidenceText || evidenceLevel || 'Evidence Classification'}
      >
        {badge}
      </span>
    );
  };

  // --------------------------------------------------------------------------
  // 1. REPOSITORY INSPECTOR
  // --------------------------------------------------------------------------
  if (entityType === 'REPOSITORY') {
    const rName = cityData?.repositoryName || repositoryData?.repoName || 'Current Repository';
    const rUrl = repositoryData?.repoUrl || `https://github.com/${rName}`;
    const branch = repositoryData?.defaultBranch || 'main';
    const sha = cityData?.commitSha || repositoryData?.commitSha || 'HEAD (Indexed)';
    const lang = cityData?.primaryLanguage || repositoryData?.language || 'Java';
    const stats = cityData?.stats || {};

    return (
      <div className="component-inspector-panel">
        <div className="inspector-header">
          <div className="flex items-center gap-2 min-w-0">
            <div className="inspector-icon-box" style={{ background: 'rgba(88, 124, 120, 0.15)' }}>
              <GitBranch size={16} className="text-teal-400" />
            </div>
            <div className="min-w-0">
              <h3 className="inspector-title truncate" title={rName}>{rName}</h3>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-teal-400 font-semibold">Repository Metropolis</span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-400 font-mono truncate">{branch}</span>
              </div>
            </div>
          </div>
          <button className="inspector-close-btn" onClick={onClose} title="Close Inspector">
            <X size={16} />
          </button>
        </div>

        <div className="inspector-tabs">
          <button className={`inspector-tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
            Architecture
          </button>
          <button className={`inspector-tab-btn ${activeTab === 'traces' ? 'active' : ''}`} onClick={() => setActiveTab('traces')}>
            Runtime Traces ({cityData?.stats?.totalTraces || 0})
          </button>
        </div>

        {activeTab === 'overview' && (
          <div className="inspector-content-scroll">
            <div className="meta-card">
              <div className="meta-item">
                <span className="meta-label">Indexed Repository</span>
                <span className="meta-value font-mono text-xs text-teal-300 break-all">{rName}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Source URL</span>
                <a href={rUrl} target="_blank" rel="noreferrer" className="meta-value font-mono text-xs text-sky-400 hover:underline flex items-center gap-1 break-all">
                  <span>{rUrl}</span>
                  <ExternalLink size={11} />
                </a>
              </div>
              <div className="meta-row">
                <div className="meta-item flex-1">
                  <span className="meta-label">Commit SHA</span>
                  <span className="meta-value font-mono text-xs text-slate-300">{sha.substring(0, 10)}</span>
                </div>
                <div className="meta-item flex-1">
                  <span className="meta-label">Language</span>
                  <span className="meta-value text-xs text-amber-300">{lang}</span>
                </div>
              </div>
            </div>

            <div className="section-block">
              <span className="section-title">City Structural Scale</span>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="stat-box" style={{ background: '#FFFFFF', padding: '8px', borderRadius: '6px', border: '1px solid #D9CFC7' }}>
                  <div className="text-lg font-bold text-teal-400">{cityData?.districts?.length || 0}</div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Districts (Packages)</div>
                </div>
                <div className="stat-box" style={{ background: '#FFFFFF', padding: '8px', borderRadius: '6px', border: '1px solid #D9CFC7' }}>
                  <div className="text-lg font-bold text-sky-400">{cityData?.buildings?.length || 0}</div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Buildings (Files)</div>
                </div>
                <div className="stat-box" style={{ background: '#FFFFFF', padding: '8px', borderRadius: '6px', border: '1px solid #D9CFC7' }}>
                  <div className="text-lg font-bold text-indigo-400">{cityData?.roads?.length || 0}</div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Semantic Roads</div>
                </div>
                <div className="stat-box" style={{ background: '#FFFFFF', padding: '8px', borderRadius: '6px', border: '1px solid #D9CFC7' }}>
                  <div className="text-lg font-bold text-amber-400">{stats.totalEndpoints || 0}</div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">API Endpoints</div>
                </div>
              </div>
            </div>

            <div className="section-block">
              <span className="section-title">Architectural Truth & Evidence</span>
              <div style={{ background: '#F9F8F6', border: '1px solid #D9CFC7', borderRadius: '6px', padding: '10px', fontSize: '11px', color: '#62574E', lineHeight: 1.5 }}>
                <p style={{ margin: 0, marginBottom: '6px' }}>
                  <strong style={{ color: '#587C78' }}>Evidence Rule:</strong> CodeCity renders software geography strictly from AST parsing and verified build manifests.
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {renderEvidencePill('STATIC_AST', 'Verified via JavaParser AST')}
                  {renderEvidencePill('PACKAGE_MANIFEST', 'pom.xml / package.json')}
                  {renderEvidencePill('STATIC_INFERRED', 'Spring Route Heuristics')}
                </div>
              </div>
            </div>

            {onReindex && (
              <button
                onClick={onReindex}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  background: 'rgba(88, 124, 120, 0.15)',
                  border: '1px solid #587C78',
                  color: '#587C78',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <RotateCcw size={14} />
                <span>Re-Analyze & Sync City Model</span>
              </button>
            )}
          </div>
        )}

        {activeTab === 'traces' && (
          <div className="inspector-content-scroll">
            {tracesLoading && (
              <div className="p-6 text-center text-xs text-slate-400">
                <div className="spinner-sm mx-auto mb-2" />
                <span>Checking runtime trace database...</span>
              </div>
            )}
            {!tracesLoading && traces.length > 0 && (
              <div className="space-y-3">
                <div style={{ background: 'rgba(100, 131, 107, 0.15)', border: '1px solid #64836B', borderRadius: '6px', padding: '8px 10px', fontSize: '11px', color: '#64836B' }}>
                  ✓ {traces.length} verified runtime trace(s) recorded via telemetry agent.
                </div>
                {traces.map((tr, i) => (
                  <div key={i} style={{ background: '#FFFFFF', border: '1px solid #D9CFC7', borderRadius: '6px', padding: '10px' }}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-teal-300">{tr.traceId}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 font-bold border border-emerald-800">
                        {tr.durationMs}ms
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 font-mono">
                      Environment: {tr.environment || 'production'} • Status: {tr.statusCode || 200}
                    </div>
                    {tr.spans && tr.spans.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Recorded Execution Spans:</span>
                        {tr.spans.map((sp, sIdx) => (
                          <div key={sIdx} className="flex items-center justify-between text-[11px] font-mono bg-slate-900/60 p-1 rounded">
                            <span className="text-slate-300 truncate">{sp.componentName || sp.operationName}</span>
                            <span className="text-teal-400">{sp.durationMs}ms</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {!tracesLoading && traces.length === 0 && (
              <div style={{ background: '#F9F8F6', border: '1px solid #D9CFC7', borderRadius: '8px', padding: '14px', fontSize: '12px', color: '#62574E', lineHeight: 1.6 }}>
                <div className="flex items-center gap-2 text-amber-400 font-bold mb-2">
                  <Info size={16} />
                  <span>No Runtime Telemetry Recorded</span>
                </div>
                <p style={{ margin: 0, marginBottom: '8px' }}>
                  CodeCity is currently visualizing <strong>verified static AST relationships</strong>. Static analysis predicted possible paths, but runtime trace execution has not been streamed for this repository.
                </p>
                <div style={{ background: '#EFE9E3', borderRadius: '6px', padding: '8px', fontFamily: 'monospace', fontSize: '10.5px', color: '#39332E' }}>
                  Agent Ingestion Endpoint: POST /api/codecity/traces/ingest
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 2. DISTRICT INSPECTOR
  // --------------------------------------------------------------------------
  if (entityType === 'DISTRICT') {
    const district = selectedEntity?.data || {};
    const dName = district.name || selectedEntity?.name || 'District';
    const containedBlocks = (cityData?.blocks || []).filter(b => b.districtId === district.id);
    const containedBuildings = (cityData?.buildings || []).filter(b => b.districtId === district.id);

    return (
      <div className="component-inspector-panel">
        <div className="inspector-header">
          <div className="flex items-center gap-2 min-w-0">
            <div className="inspector-icon-box" style={{ background: 'rgba(192, 154, 98, 0.15)' }}>
              <MapPin size={16} className="text-amber-400" />
            </div>
            <div className="min-w-0">
              <h3 className="inspector-title truncate" title={dName}>{dName}</h3>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-amber-400 font-semibold">Architectural District</span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-400 truncate">{containedBuildings.length} Buildings</span>
              </div>
            </div>
          </div>
          <button className="inspector-close-btn" onClick={onClose} title="Close Inspector">
            <X size={16} />
          </button>
        </div>

        <div className="inspector-tabs">
          <button className="inspector-tab-btn active">Contained Components</button>
        </div>

        <div className="inspector-content-scroll">
          <div className="meta-card">
            <div className="meta-item">
              <span className="meta-label">Package / Module Grouping</span>
              <span className="meta-value font-mono text-xs text-amber-300 break-all">{district.packageName || dName}</span>
            </div>
            <div className="meta-row">
              <div className="meta-item flex-1">
                <span className="meta-label">Neighbourhoods</span>
                <span className="meta-value text-xs">{containedBlocks.length} Blocks</span>
              </div>
              <div className="meta-item flex-1">
                <span className="meta-label">Total Buildings</span>
                <span className="meta-value text-xs">{containedBuildings.length} Files</span>
              </div>
            </div>
          </div>

          <div className="section-block">
            <span className="section-title">Contained Buildings ({containedBuildings.length})</span>
            <div className="space-y-1.5 mt-1 max-h-72 overflow-y-auto">
              {containedBuildings.map(b => (
                <div
                  key={b.id}
                  onClick={() => onNavigateToEntity && onNavigateToEntity('BUILDING', b.id, b)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: '5px',
                    background: '#FFFFFF',
                    border: '1px solid #D9CFC7',
                    cursor: 'pointer'
                  }}
                  className="hover:border-teal-500"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-200 truncate">{b.fileName || b.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono truncate">{b.componentType} • {b.lineCount || 50} LOC</div>
                  </div>
                  <ChevronRight size={14} className="text-slate-500 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 3. BLOCK / NEIGHBOURHOOD INSPECTOR
  // --------------------------------------------------------------------------
  if (entityType === 'BLOCK') {
    const block = selectedEntity?.data || {};
    const bName = block.name || selectedEntity?.name || 'Neighbourhood';
    const containedBuildings = (cityData?.buildings || []).filter(b => b.blockId === block.id);

    return (
      <div className="component-inspector-panel">
        <div className="inspector-header">
          <div className="flex items-center gap-2 min-w-0">
            <div className="inspector-icon-box" style={{ background: 'rgba(113, 134, 155, 0.15)' }}>
              <FolderTree size={16} className="text-sky-400" />
            </div>
            <div className="min-w-0">
              <h3 className="inspector-title truncate" title={bName}>{bName}</h3>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-sky-400 font-semibold">Neighbourhood Block</span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-400">{containedBuildings.length} Buildings</span>
              </div>
            </div>
          </div>
          <button className="inspector-close-btn" onClick={onClose} title="Close Inspector">
            <X size={16} />
          </button>
        </div>

        <div className="inspector-content-scroll">
          <div className="meta-card">
            <div className="meta-item">
              <span className="meta-label">Directory Path</span>
              <span className="meta-value font-mono text-xs text-sky-300 break-all">{block.folderPath || block.name}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Parent District</span>
              <span className="meta-value text-xs text-amber-300">{block.districtName || 'Core District'}</span>
            </div>
          </div>

          <div className="section-block">
            <span className="section-title">Buildings in this Block ({containedBuildings.length})</span>
            <div className="space-y-1.5 mt-1 max-h-72 overflow-y-auto">
              {containedBuildings.map(b => (
                <div
                  key={b.id}
                  onClick={() => onNavigateToEntity && onNavigateToEntity('BUILDING', b.id, b)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: '5px',
                    background: '#FFFFFF',
                    border: '1px solid #D9CFC7',
                    cursor: 'pointer'
                  }}
                  className="hover:border-sky-500"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-200 truncate">{b.fileName || b.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono truncate">{b.componentType} • {b.lineCount || 50} LOC</div>
                  </div>
                  <ChevronRight size={14} className="text-slate-500 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 4. LANDMARK / INFRASTRUCTURE INSPECTOR
  // --------------------------------------------------------------------------
  if (entityType === 'LANDMARK') {
    const lm = selectedEntity?.data || {};
    const lmType = lm.landmarkType || lm.type || 'INFRASTRUCTURE';
    const connectedRoads = (cityData?.roads || []).filter(r => r.targetBuildingId === lm.id || r.sourceBuildingId === lm.id);

    return (
      <div className="component-inspector-panel">
        <div className="inspector-header">
          <div className="flex items-center gap-2 min-w-0">
            <div className="inspector-icon-box" style={{ background: 'rgba(183, 101, 93, 0.15)' }}>
              <Database size={16} className="text-pink-400" />
            </div>
            <div className="min-w-0">
              <h3 className="inspector-title truncate" title={lm.name}>{lm.name || lm.title}</h3>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-pink-400 font-semibold">{lmType}</span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-400">Infrastructure Landmark</span>
              </div>
            </div>
          </div>
          <button className="inspector-close-btn" onClick={onClose} title="Close Inspector">
            <X size={16} />
          </button>
        </div>

        <div className="inspector-content-scroll">
          <div className="meta-card">
            <div className="meta-item">
              <span className="meta-label">Landmark Role</span>
              <span className="meta-value text-xs text-pink-300 font-semibold">{lm.description || 'System Infrastructure Boundary'}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Detected Technology / Evidence</span>
              <span className="meta-value font-mono text-xs text-slate-300">{lm.technology || lm.evidence || 'Spring Data JPA / Database Cluster'}</span>
            </div>
            <div className="meta-row">
              <div className="meta-item flex-1">
                <span className="meta-label">Connected Roads</span>
                <span className="meta-value text-xs font-mono text-teal-400">{connectedRoads.length} semantic links</span>
              </div>
              <div className="meta-item flex-1">
                <span className="meta-label">Evidence State</span>
                {renderEvidencePill('STATIC_AST', 'AST Inferred from Annotations')}
              </div>
            </div>
          </div>

          {connectedRoads.length > 0 && (
            <div className="section-block">
              <span className="section-title">Connected Component Roads ({connectedRoads.length})</span>
              <div className="space-y-1 mt-1 max-h-60 overflow-y-auto">
                {connectedRoads.map((r, i) => (
                  <div
                    key={i}
                    onClick={() => onNavigateToEntity && onNavigateToEntity('ROAD', r.id, r)}
                    style={{ background: '#FFFFFF', border: '1px solid #D9CFC7', padding: '6px 8px', borderRadius: '5px', cursor: 'pointer' }}
                    className="hover:border-teal-400"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200">{r.roadName || r.relationshipType}</span>
                      <span className="text-[10px] text-teal-400 font-mono">{r.relationshipType}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 5. ROAD / RELATIONSHIP INSPECTOR
  // --------------------------------------------------------------------------
  if (entityType === 'ROAD') {
    const road = selectedEntity?.data || {};
    const srcBuilding = (cityData?.buildings || []).find(b => b.id === road.sourceBuildingId || b.fileId === road.sourceBuildingId);
    const tgtBuilding = (cityData?.buildings || []).find(b => b.id === road.targetBuildingId || b.fileId === road.targetBuildingId);

    return (
      <div className="component-inspector-panel">
        <div className="inspector-header">
          <div className="flex items-center gap-2 min-w-0">
            <div className="inspector-icon-box" style={{ background: 'rgba(88, 124, 120, 0.15)' }}>
              <Layers size={16} className="text-teal-400" />
            </div>
            <div className="min-w-0">
              <h3 className="inspector-title truncate" title={road.roadName || road.relationshipType}>
                {road.roadName || `${road.relationshipType} Highway`}
              </h3>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-teal-400 font-semibold">{road.relationshipType}</span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-400">{road.roadType || 'ARTERIAL'}</span>
              </div>
            </div>
          </div>
          <button className="inspector-close-btn" onClick={onClose} title="Close Inspector">
            <X size={16} />
          </button>
        </div>

        <div className="inspector-content-scroll">
          <div className="meta-card">
            <div className="meta-item">
              <span className="meta-label">Relationship Classification</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-xs font-bold text-teal-300">{road.relationshipType}</span>
                {renderEvidencePill(road.evidenceLevel, road.evidence)}
              </div>
            </div>
            <div className="meta-item">
              <span className="meta-label">AST Evidence Detail</span>
              <span className="meta-value font-mono text-xs text-slate-300 break-all">
                {road.evidence || 'Static invocation discovered via method call resolution'}
              </span>
            </div>
          </div>

          <div className="section-block">
            <span className="section-title">Connected Software Endpoints</span>
            <div className="space-y-2 mt-1.5">
              {/* Source Endpoint */}
              <div
                onClick={() => srcBuilding && onNavigateToEntity && onNavigateToEntity('BUILDING', srcBuilding.id, srcBuilding)}
                style={{ background: '#FFFFFF', border: '1px solid #D9CFC7', padding: '8px 10px', borderRadius: '6px', cursor: 'pointer' }}
                className="hover:border-teal-400"
              >
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold uppercase">
                  <ArrowUpRight size={12} className="text-teal-400" />
                  <span>Source Caller</span>
                </div>
                <div className="text-xs font-bold text-slate-200 mt-1">{srcBuilding ? (srcBuilding.fileName || srcBuilding.name) : (road.sourceBuildingId || 'Unknown')}</div>
                <div className="text-[10px] text-slate-400 font-mono">{srcBuilding?.filePath || road.sourceRoomId || 'AST Node'}</div>
              </div>

              {/* Target Endpoint */}
              <div
                onClick={() => tgtBuilding && onNavigateToEntity && onNavigateToEntity('BUILDING', tgtBuilding.id, tgtBuilding)}
                style={{ background: '#FFFFFF', border: '1px solid #D9CFC7', padding: '8px 10px', borderRadius: '6px', cursor: 'pointer' }}
                className="hover:border-sky-400"
              >
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold uppercase">
                  <ArrowDownLeft size={12} className="text-sky-400" />
                  <span>Target Callee</span>
                </div>
                <div className="text-xs font-bold text-slate-200 mt-1">{tgtBuilding ? (tgtBuilding.fileName || tgtBuilding.name) : (road.targetBuildingId || 'Unknown')}</div>
                <div className="text-[10px] text-slate-400 font-mono">{tgtBuilding?.filePath || road.targetRoomId || 'AST Node'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 6, 7 & 8: BUILDING, ROOM, & WORKSTATION INSPECTOR
  // --------------------------------------------------------------------------
  const activeBuilding = componentDetail || selectedEntity?.data || {};
  const {
    name = 'Component',
    qualifiedName = name,
    componentType = 'COMPONENT',
    packageName = '',
    districtName = '',
    filePath = activeBuilding.filePath || '',
    startLine = activeBuilding.startLine || 1,
    endLine = activeBuilding.endLine || (startLine + 50),
    lineCount = (endLine - startLine + 1) || 50,
    annotations = [],
    methods = activeBuilding.rooms?.[0]?.workstations || [],
    callers = [],
    callees = [],
    associatedEndpoints = []
  } = componentDetail || {};

  return (
    <div className="component-inspector-panel">
      {/* Header */}
      <div className="inspector-header">
        <div className="flex items-center gap-2 min-w-0">
          <div className="inspector-icon-box" style={{ background: 'rgba(88, 124, 120, 0.15)' }}>
            <Box size={16} className="text-sky-400" />
          </div>
          <div className="min-w-0">
            <h3 className="inspector-title truncate" title={name}>{name}</h3>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-sky-400 font-semibold">{componentType}</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-400 truncate" title={districtName}>{districtName || 'District'}</span>
            </div>
          </div>
        </div>
        <button className="inspector-close-btn" onClick={onClose} title="Close Inspector">
          <X size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="inspector-tabs">
        <button className={`inspector-tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          Overview
        </button>
        <button className={`inspector-tab-btn ${activeTab === 'methods' ? 'active' : ''}`} onClick={() => setActiveTab('methods')}>
          Workstations ({methods.length})
        </button>
        <button className={`inspector-tab-btn ${activeTab === 'callers' ? 'active' : ''}`} onClick={() => setActiveTab('callers')}>
          Callers ({callers.length})
        </button>
        <button className={`inspector-tab-btn ${activeTab === 'callees' ? 'active' : ''}`} onClick={() => setActiveTab('callees')}>
          Callees ({callees.length})
        </button>
        <button className={`inspector-tab-btn ${activeTab === 'source' ? 'active' : ''}`} onClick={() => setActiveTab('source')}>
          Source Code
        </button>
        <button className={`inspector-tab-btn ${activeTab === 'impact' ? 'active' : ''}`} onClick={() => setActiveTab('impact')}>
          Impact
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="inspector-content-scroll">
          <div className="meta-card">
            <div className="meta-item">
              <span className="meta-label">Full Qualified Name</span>
              <span className="meta-value font-mono text-xs text-sky-300 break-all">{qualifiedName}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Source File Location</span>
              <span className="meta-value font-mono text-xs text-slate-300 break-all">{filePath || 'N/A'}</span>
            </div>
            <div className="meta-row">
              <div className="meta-item flex-1">
                <span className="meta-label">Line Range</span>
                <span className="meta-value font-mono text-xs">{startLine} – {endLine} ({lineCount} LOC)</span>
              </div>
              <div className="meta-item flex-1">
                <span className="meta-label">Package</span>
                <span className="meta-value text-xs truncate" title={packageName}>{packageName || 'root'}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            {filePath && (
              <button
                className="flex-1 py-2 px-3 bg-sky-950/40 hover:bg-sky-900/50 text-sky-300 rounded border border-sky-700/50 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                onClick={() => setActiveTab('source')}
              >
                <FileCode size={13} />
                <span>Inspect Source</span>
              </button>
            )}
            <button
              className="flex-1 py-2 px-3 bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 rounded border border-amber-700/50 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              onClick={() => onAnalyzeImpact ? onAnalyzeImpact(activeBuilding.id || name) : setActiveTab('impact')}
            >
              <Zap size={13} />
              <span>Analyze Impact</span>
            </button>
          </div>

          {/* Annotations */}
          {annotations && annotations.length > 0 && (
            <div className="section-block">
              <span className="section-title">Declared Annotations</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {annotations.map((an, i) => (
                  <span key={i} className="annotation-pill font-mono text-[11px] bg-slate-800 text-teal-300 px-2 py-0.5 rounded border border-slate-700">
                    @{an}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Associated Endpoints */}
          {associatedEndpoints && associatedEndpoints.length > 0 && (
            <div className="section-block">
              <span className="section-title">Associated Endpoints ({associatedEndpoints.length})</span>
              <div className="space-y-1.5 mt-1.5">
                {associatedEndpoints.map(ep => (
                  <div
                    key={ep.id}
                    className="inspector-endpoint-card cursor-pointer p-2 rounded bg-slate-900 border border-slate-800 hover:border-teal-400 flex items-center justify-between"
                    onClick={() => onSelectEndpoint && onSelectEndpoint(ep)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-teal-400">{ep.httpMethod}</span>
                      <span className="font-mono text-xs text-slate-200 truncate">{ep.routePath}</span>
                    </div>
                    <button className="text-xs text-teal-400 flex items-center gap-0.5 hover:underline shrink-0">
                      <span>Trace</span>
                      <ChevronRight size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Relationship Metrics */}
          <div className="section-block">
            <span className="section-title">Verified AST Relationships</span>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div
                className="stat-box cursor-pointer hover:border-emerald-500"
                style={{ background: '#FFFFFF', border: '1px solid #D9CFC7', padding: '8px', borderRadius: '6px' }}
                onClick={() => setActiveTab('callers')}
              >
                <div className="text-lg font-bold text-emerald-400">{callers.length}</div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Inbound Callers</div>
              </div>
              <div
                className="stat-box cursor-pointer hover:border-sky-500"
                style={{ background: '#FFFFFF', border: '1px solid #D9CFC7', padding: '8px', borderRadius: '6px' }}
                onClick={() => setActiveTab('callees')}
              >
                <div className="text-lg font-bold text-sky-400">{callees.length}</div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Outbound Invocations</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Methods / Workstations Tab */}
      {activeTab === 'methods' && (
        <div className="inspector-content-scroll">
          {methods.length === 0 ? (
            <div className="empty-subtext text-xs text-slate-400 p-4">No extracted methods for this component</div>
          ) : (
            <div className="space-y-2">
              {methods.map((m, idx) => (
                <div
                  key={idx}
                  className="method-card p-2 rounded bg-slate-900 border border-slate-800 hover:border-teal-400 cursor-pointer"
                  onClick={() => {
                    if (filePath) {
                      setActiveTab('source');
                    }
                  }}
                >
                  <div className="method-card-header flex items-center justify-between">
                    <span className="method-name font-mono text-xs font-semibold text-teal-300">
                      {m.name}()
                    </span>
                    {m.startLine && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        L{m.startLine}–L{m.endLine}
                      </span>
                    )}
                  </div>
                  {m.signature && (
                    <div className="method-sig font-mono text-[11px] text-slate-400 truncate mt-1" title={m.signature}>
                      {m.signature}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Callers Tab */}
      {activeTab === 'callers' && (
        <div className="inspector-content-scroll">
          {callers.length === 0 ? (
            <div className="empty-subtext text-xs text-slate-400 p-4">No inbound callers detected in static analysis</div>
          ) : (
            <div className="space-y-2">
              {callers.map((c, idx) => (
                <div
                  key={idx}
                  className="caller-card p-2 rounded bg-slate-900 border border-slate-800 hover:border-emerald-400 cursor-pointer"
                  onClick={() => onNavigateToEntity && onNavigateToEntity('BUILDING', c.nodeKey)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-slate-200 truncate">{c.name}</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">
                      {c.relationshipType}
                    </span>
                  </div>
                  {c.evidence && (
                    <div className="text-[11px] text-slate-400 mt-1 font-mono break-all">
                      {c.evidence}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Callees Tab */}
      {activeTab === 'callees' && (
        <div className="inspector-content-scroll">
          {callees.length === 0 ? (
            <div className="empty-subtext text-xs text-slate-400 p-4">No outbound invocations detected in static analysis</div>
          ) : (
            <div className="space-y-2">
              {callees.map((c, idx) => (
                <div
                  key={idx}
                  className="caller-card p-2 rounded bg-slate-900 border border-slate-800 hover:border-sky-400 cursor-pointer"
                  onClick={() => onNavigateToEntity && onNavigateToEntity('BUILDING', c.nodeKey)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-slate-200 truncate">{c.name}</span>
                    <span className="text-[10px] text-sky-400 bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-800">
                      {c.relationshipType}
                    </span>
                  </div>
                  {c.evidence && (
                    <div className="text-[11px] text-slate-400 mt-1 font-mono break-all">
                      {c.evidence}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Source Code Tab */}
      {activeTab === 'source' && (
        <div className="inspector-content-scroll">
          {sourceLoading && (
            <div className="p-6 text-center text-xs text-slate-400">
              <div className="spinner-sm mx-auto mb-2" />
              <span>Fetching source code lines from repository...</span>
            </div>
          )}

          {!sourceLoading && sourceData?.available && (
            <div className="source-code-editor">
              <div className="editor-file-header flex items-center justify-between text-xs text-slate-300 pb-2 border-b border-slate-800">
                <span className="truncate font-mono">{sourceData.filePath}</span>
                <span className="text-slate-400 font-mono text-[11px]">Total lines: {sourceData.totalLines}</span>
              </div>
              <pre className="source-code-pre mt-2 max-h-96 overflow-y-auto text-xs font-mono">
                <code>
                  {(sourceData.lines || []).map((l, lIdx) => (
                    <div
                      key={lIdx}
                      style={{
                        display: 'flex',
                        background: l.isHighlighted ? 'rgba(192, 154, 98, 0.18)' : 'transparent',
                        borderLeft: l.isHighlighted ? '3px solid #C09A62' : '3px solid transparent',
                        padding: '1px 6px'
                      }}
                    >
                      <span style={{ width: '38px', color: '#81776F', userSelect: 'none', textAlign: 'right', paddingRight: '12px' }}>
                        {l.lineNumber}
                      </span>
                      <span style={{ color: l.isHighlighted ? '#39332E' : '#62574E', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {l.code}
                      </span>
                    </div>
                  ))}
                </code>
              </pre>
            </div>
          )}

          {!sourceLoading && (!sourceData || !sourceData.available) && (
            <div className="p-4 bg-slate-900 rounded border border-slate-800 text-xs text-slate-400">
              <p>{sourceData?.reason || 'Source code lines not accessible via repository cache.'}</p>
              <div className="mt-2 font-mono text-[11px] text-sky-300">
                File: {filePath} [Lines {startLine}–{endLine}]
              </div>
            </div>
          )}
        </div>
      )}

      {/* Impact Analysis Tab */}
      {activeTab === 'impact' && (
        <div className="inspector-content-scroll">
          <div className="meta-card">
            <span className="meta-label">Dependency Impact Scope</span>
            <div className="text-xs text-slate-200 mt-1 leading-relaxed">
              If this component is modified or upgraded, the following upstream callers and downstream dependencies will be affected in the software metropolis.
            </div>
          </div>

          <div className="section-block">
            <span className="section-title">Upstream Impact (Callers that rely on this)</span>
            <div className="space-y-1.5 mt-1">
              {callers.length === 0 ? (
                <div className="text-xs text-slate-400 p-2">No upstream callers rely on this component.</div>
              ) : (
                callers.map((c, i) => (
                  <div key={i} className="p-2 rounded bg-rose-950/40 border border-rose-800/60 flex items-center justify-between text-xs">
                    <span className="font-semibold text-rose-300 truncate">{c.name}</span>
                    <span className="text-[10px] text-rose-400 font-mono font-bold">POTENTIALLY BROKEN</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="section-block">
            <span className="section-title">Downstream Dependencies (What this relies on)</span>
            <div className="space-y-1.5 mt-1">
              {callees.length === 0 ? (
                <div className="text-xs text-slate-400 p-2">No downstream invocations from this component.</div>
              ) : (
                callees.map((c, i) => (
                  <div key={i} className="p-2 rounded bg-emerald-950/40 border border-emerald-800/60 flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-300 truncate">{c.name}</span>
                    <span className="text-[10px] text-emerald-400 font-mono font-bold">TARGET DEPENDENCY</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Third Party Library Impact Assessment */}
          <div className="section-block mt-2">
            <span className="section-title">External Library Impact Check</span>
            <div className="p-2 rounded bg-slate-900 border border-slate-800 mt-1">
              <span className="text-xs text-slate-300">Run cross-repo impact check against Maven / NPM registry:</span>
              <button
                disabled={impactLoading}
                onClick={() => handleRunImpactAnalysis('spring-boot-starter-web')}
                className="mt-2 w-full py-1.5 px-3 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded text-xs font-semibold hover:bg-amber-500/30 transition-colors"
              >
                {impactLoading ? 'Analyzing Registry Impact...' : 'Evaluate Framework Upgrade Impact'}
              </button>

              {impactResult && (
                <div className="mt-2 p-2 bg-slate-950 rounded border border-slate-800 text-xs">
                  <div className="font-bold text-amber-400">Recommendation: {impactResult.overallRecommendation || 'EVALUATED'}</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Affected Repositories: {impactResult.totalAffectedRepos || 0} • Breaking: {impactResult.breakingCount || 0}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
