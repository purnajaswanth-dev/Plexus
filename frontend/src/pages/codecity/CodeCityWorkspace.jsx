import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { codecityApi } from '../../api/codecityApi';
import { CityBuildingNode } from './CityBuildingNode';
import { CityDistrictNode } from './CityDistrictNode';
import { CityRoadEdge } from './CityRoadEdge';
import { CityLegendNode } from './CityLegendNode';
import { CityGateNode } from './CityGateNode';
import { MetropolisCityViewport } from './MetropolisCityViewport';
import { EndpointExplorerPanel } from './EndpointExplorerPanel';
import { ExecutionTimeline } from './ExecutionTimeline';
import { RequestJourneyPanel } from './RequestJourneyPanel';
import { ComponentInspectorPanel } from './ComponentInspectorPanel';
import { ArchitectureIntelligenceDrawer } from './ArchitectureIntelligenceDrawer';
import { RepositoryCitiesPage } from './RepositoryCitiesPage';

import {
  Building2,
  Route,
  Search,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronDown,
  Layers,
  MapPin,
  X,
  RotateCcw,
  User,
  LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const nodeTypes = {
  building: CityBuildingNode,
  district: CityDistrictNode,
  legend: CityLegendNode,
  gate: CityGateNode
};

const edgeTypes = {
  road: CityRoadEdge
};

const CodeCityWorkspaceInner = ({
  initialRepoId = null,
  onBackToDirectory
}) => {
  const auth = useAuth();
  const [selectedRepoId, setSelectedRepoId] = useState(initialRepoId);
  const [repositories, setRepositories] = useState([]);
  const [cityData, setCityData] = useState(null);
  const [endpoints, setEndpoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active execution route state
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [executionPath, setExecutionPath] = useState(null);
  const [journeyGraph, setJourneyGraph] = useState(null);
  const [activeStepIndex, setActiveStepIndex] = useState(1);
  const [journeyMode, setJourneyMode] = useState('REQUEST'); // 'REQUEST' | 'RESPONSE'
  const [showExplanationPanel, setShowExplanationPanel] = useState(true);

  // Endpoint dropdown in top bar
  const [endpointDropdownOpen, setEndpointDropdownOpen] = useState(false);
  const [endpointFilter, setEndpointFilter] = useState('');

  // Unified Inspector & Entity Selection state
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [selectedComponentDetail, setSelectedComponentDetail] = useState(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [impactMode, setImpactMode] = useState(null);
  const [reindexing, setReindexing] = useState(false);
  const [intelligenceOpen, setIntelligenceOpen] = useState(false);
  const [intelligenceData, setIntelligenceData] = useState(null);

  // Lazy-load Architecture Intelligence only when the drawer is actually opened
  useEffect(() => {
    if (!intelligenceOpen || !selectedRepoId) return;
    if (intelligenceData && intelligenceData.repositoryId === selectedRepoId) return;

    let isMounted = true;
    codecityApi.getArchitectureIntelligence(selectedRepoId)
      .then(data => {
        if (isMounted) setIntelligenceData(data);
      })
      .catch(() => {
        if (isMounted) setIntelligenceData(null);
      });

    return () => { isMounted = false; };
  }, [intelligenceOpen, selectedRepoId]);

  // UI view controls
  const [rendererMode, setRendererMode] = useState('metropolis'); // 'metropolis' | 'diagram'
  const [semanticZoom, setSemanticZoom] = useState('buildings'); // 'districts' | 'buildings' | 'rooms'
  const [showLeftDrawer, setShowLeftDrawer] = useState(false);
  const [activeLeftTab, setActiveLeftTab] = useState('endpoints'); // 'endpoints' | 'districts'
  const [globalSearch, setGlobalSearch] = useState('');

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const { fitView, setCenter } = useReactFlow();

  const workspaceContainerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && !isFullscreen) {
      if (workspaceContainerRef.current?.requestFullscreen) {
        workspaceContainerRef.current.requestFullscreen().catch(() => {
          setIsFullscreen(true);
        });
      } else {
        setIsFullscreen(true);
      }
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  const currentRepoData = useMemo(() => {
    return repositories.find(r => r.id === selectedRepoId) || null;
  }, [repositories, selectedRepoId]);

  // Load repositories list once on component mount
  useEffect(() => {
    codecityApi.getRepositoryCities().then(data => {
      setRepositories(data);
      if (!selectedRepoId && data.length > 0) {
        const firstWithCity = data.find(r => r.hasCity) || data[0];
        setSelectedRepoId(firstWithCity.id);
      }
    }).catch(err => {
      console.error('Failed to load repo list:', err);
    });
  }, []);

  // Load city model and endpoints when selectedRepoId changes with request cancellation
  useEffect(() => {
    if (!selectedRepoId) return;

    const controller = new AbortController();
    const loadCity = async () => {
      try {
        setLoading(true);
        setError(null);
        setSelectedEndpoint(null);
        setExecutionPath(null);
        setSelectedComponentDetail(null);
        setSelectedEntity(null);
        setImpactMode(null);
        setInspectorOpen(false);
        // Free previous city geometry memory from client state
        setCityData(null);
        setNodes([]);
        setEdges([]);

        const [cityRes, epsRes] = await Promise.all([
          codecityApi.getCityModel(selectedRepoId, { signal: controller.signal }),
          codecityApi.getEndpoints(selectedRepoId, { signal: controller.signal }).catch(() => [])
        ]);

        if (controller.signal.aborted) return;

        setCityData(cityRes);
        setEndpoints(epsRes);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    loadCity();
    return () => { controller.abort(); };
  }, [selectedRepoId]);

  // Construct React Flow Nodes and Edges from cityData
  useEffect(() => {
    if (!cityData) return;

    const flowNodes = [];
    const flowEdges = [];

    // 1. District urban ground nodes (background)
    (cityData.districts || []).forEach(d => {
      flowNodes.push({
        id: `district_${d.id}`,
        type: 'district',
        position: { x: d.x, y: d.y },
        data: {
          ...d,
          width: d.width,
          height: d.height
        },
        selectable: false,
        draggable: false,
        zIndex: 0
      });
    });

    // 2. Legend Card Node at x: 30, y: 489
    flowNodes.push({
      id: 'city_legend_card',
      type: 'legend',
      position: { x: 30, y: 489 },
      data: {},
      selectable: false,
      draggable: false,
      zIndex: 1
    });

    // 3. Entry Gate Node if executionPath is active
    if (executionPath && selectedEndpoint) {
      flowNodes.push({
        id: 'city_entry_gate',
        type: 'gate',
        position: { x: 0, y: 246 },
        data: {
          endpoint: selectedEndpoint,
          executionPath
        },
        selectable: false,
        draggable: false,
        zIndex: 90
      });
    }

    // Determine active execution steps and dedicated journey state
    const currentSteps = journeyMode === 'RESPONSE' && executionPath?.responseSteps?.length > 0
      ? executionPath.responseSteps
      : (executionPath?.steps || []);

    const activeStepObj = currentSteps.find(s => s.stepIndex === activeStepIndex);
    const activeTransition = journeyGraph?.transitions?.[activeStepIndex - 1];
    const activeTargetNodeId = activeTransition?.toNodeId;
    const activeNode = journeyGraph?.nodes?.find(n => n.id === activeTargetNodeId);
    const activeScope = activeTransition?.scope || 'BUILDING';
    const activeRoadId = (activeScope === 'BUILDING' || activeScope === 'EXTERNAL') ? activeTransition?.roadId : null;
    const activeWorkstationId = activeNode?.cityRef?.workstationId || activeNode?.methodId;
    const activeRoomId = activeNode?.cityRef?.roomId || activeNode?.typeId;

    const activeBuildingKey = activeNode?.cityRef?.buildingId || activeStepObj?.targetComponentKey || activeStepObj?.sourceComponentKey;
    const allPathKeys = executionPath?.involvedBuildingKeys || [];

    // 4. Building architectural nodes
    (cityData.buildings || []).forEach(b => {
      const isInPath = allPathKeys.includes(b.id) || (journeyGraph?.nodes?.some(n => n.cityRef?.buildingId === b.id || n.fileId === b.fileId));
      const isCurrentActiveStep = (b.id === activeBuildingKey) || (activeNode?.cityRef?.buildingId === b.id) || (activeNode?.fileId === b.fileId) || (b.id === activeStepObj?.targetComponentKey);
      const isSubdued = executionPath != null && !isInPath;

      let stepIdx = null;
      if (currentSteps && currentSteps.length > 0) {
        const found = currentSteps.find(s => s.targetComponentKey === b.id || s.sourceComponentKey === b.id);
        if (found) stepIdx = found.stepIndex;
      }

      flowNodes.push({
        id: b.id,
        type: 'building',
        position: { x: b.x, y: b.y },
        data: {
          ...b,
          isActivePath: isInPath,
          activeStepIndex: stepIdx,
          isCurrentActiveStep,
          activeWorkstationId: isCurrentActiveStep ? activeWorkstationId : null,
          activeRoomId: isCurrentActiveStep ? activeRoomId : null,
          activeScope: isCurrentActiveStep ? activeScope : 'BUILDING',
          isSubdued,
          semanticZoom
        },
        zIndex: isCurrentActiveStep ? 100 : (isInPath ? 50 : 10)
      });
    });

    // 5. Roads / Physical Street Edges
    (cityData.roads || []).forEach(r => {
      const isPathEdge = (activeRoadId && r.id === activeRoadId);
      const isSubdued = executionPath != null && !isPathEdge;

      flowEdges.push({
        id: r.id,
        source: r.sourceBuildingId,
        target: r.targetBuildingId,
        type: 'road',
        data: {
          ...r,
          isExecutionPath: isPathEdge,
          stepIndex: isPathEdge ? activeStepIndex : null,
          isSubdued
        },
        zIndex: isPathEdge ? 80 : 5
      });
    });

    setNodes(flowNodes);
    setEdges(flowEdges);

    // Initial fit view
    setTimeout(() => {
      fitView({ padding: 0.15, duration: 400 });
    }, 150);
  }, [cityData, executionPath, journeyGraph, activeStepIndex, journeyMode, semanticZoom, selectedEndpoint, fitView, setNodes, setEdges]);

  // Handle clicking a building node
  const onNodeClick = useCallback(async (event, node) => {
    if (node.type !== 'building') return;

    try {
      const detail = await codecityApi.getComponentDetail(selectedRepoId, node.id);
      setSelectedComponentDetail(detail);
      setInspectorOpen(true);
    } catch (err) {
      console.error('Failed to load component inspector:', err);
    }
  }, [selectedRepoId]);

  // Open inspector from step details
  const handleOpenSourceInspector = useCallback(async (nodeKey) => {
    if (!nodeKey) return;
    try {
      const detail = await codecityApi.getComponentDetail(selectedRepoId, nodeKey);
      setSelectedComponentDetail(detail);
      setInspectorOpen(true);
    } catch (err) {
      console.error('Failed to load inspector:', err);
    }
  }, [selectedRepoId]);

  // Handle selecting an API endpoint -> load execution path & show Request Journey
  const handleSelectEndpoint = useCallback(async (endpoint) => {
    try {
      setSelectedEndpoint(endpoint);
      setEndpointDropdownOpen(false);
      const [pathData, jData] = await Promise.all([
        codecityApi.getStaticExecutionPath(selectedRepoId, endpoint.id),
        codecityApi.getJourneyGraph(selectedRepoId, endpoint.id, 'STATIC').catch(() => null)
      ]);
      setExecutionPath(pathData);
      setJourneyGraph(jData);
      setActiveStepIndex(1);
      setShowExplanationPanel(true);
      setInspectorOpen(false);

      // Focus camera on first step's building
      if (pathData?.steps && pathData.steps.length > 0) {
        const firstTargetKey = pathData.steps[0].targetComponentKey || pathData.steps[0].sourceComponentKey;
        const b = cityData?.buildings?.find(b => b.id === firstTargetKey || b.fileId === firstTargetKey);
        if (b) {
          setCenter(b.x + b.width / 2, b.y + b.height / 2, { zoom: 1.15, duration: 600 });
        }
      }
    } catch (err) {
      console.error('Failed to trace endpoint route:', err);
    }
  }, [selectedRepoId, cityData, setCenter]);

  // Clear active execution route
  const handleClearEndpoint = useCallback(() => {
    setSelectedEndpoint(null);
    setExecutionPath(null);
    setJourneyGraph(null);
    setActiveStepIndex(1);
    fitView({ padding: 0.15, duration: 500 });
  }, [fitView]);

  const handleSelectBuildingFromMetropolis = useCallback(async (bldg) => {
    if (!bldg) return;
    try {
      const detail = await codecityApi.getComponentDetail(selectedRepoId, bldg.id);
      setSelectedComponentDetail(detail);
      setSelectedEntity({ type: 'BUILDING', name: bldg.name, data: bldg, id: bldg.id });
      setInspectorOpen(true);
      if (executionPath) {
        setShowExplanationPanel(false);
      }
    } catch (err) {
      console.error('Failed to load component inspector:', err);
    }
  }, [selectedRepoId, executionPath]);

  const handleSelectWorkstationFromMetropolis = useCallback(async (wsId) => {
    if (!wsId) return;
    try {
      const detail = await codecityApi.getComponentDetail(selectedRepoId, wsId);
      setSelectedComponentDetail(detail);
      setInspectorOpen(true);
    } catch (err) {
      console.error('Failed to load workstation detail:', err);
    }
  }, [selectedRepoId]);

  // Unified Entity Selection Handler
  const handleSelectEntity = useCallback(async (entity) => {
    setSelectedEntity(entity);
    if (!entity) return;

    if (entity.type === 'BUILDING') {
      await handleSelectBuildingFromMetropolis(entity.data || entity);
    } else if (entity.type === 'ROOM' || entity.type === 'WORKSTATION') {
      const parentBldg = entity.building || (cityData?.buildings || []).find(b =>
        b.rooms?.some(r => r.id === entity.id || r.name === entity.name || r.workstations?.some(w => w.id === entity.id))
      );
      if (parentBldg) {
        await handleSelectBuildingFromMetropolis(parentBldg);
      } else {
        setInspectorOpen(true);
      }
    } else {
      setInspectorOpen(true);
    }

    if (executionPath) {
      setShowExplanationPanel(false);
    }
  }, [cityData, handleSelectBuildingFromMetropolis, executionPath]);

  // Navigate to Entity from Inspector (Caller / Callee / Contained Building / Road Endpoint)
  const handleNavigateToEntity = useCallback((entityType, entityId, entityData = null) => {
    if (!cityData) return;
    if (entityType === 'BUILDING') {
      const b = (cityData.buildings || []).find(x => x.id === entityId || x.fileId === entityId || x.name === entityId);
      if (b) {
        handleSelectEntity({ type: 'BUILDING', name: b.name, data: b, id: b.id });
      }
    } else if (entityType === 'DISTRICT') {
      const d = (cityData.districts || []).find(x => x.id === entityId || x.name === entityId);
      if (d) {
        handleSelectEntity({ type: 'DISTRICT', name: d.name, data: d, id: d.id });
      }
    } else if (entityType === 'ROAD') {
      const r = (cityData.roads || []).find(x => x.id === entityId);
      if (r) {
        handleSelectEntity({ type: 'ROAD', name: r.roadName || r.relationshipType, data: r, id: r.id });
      }
    } else if (entityType === 'LANDMARK') {
      const lm = (cityData.landmarks || []).find(x => x.id === entityId || x.name === entityId);
      if (lm) {
        handleSelectEntity({ type: 'LANDMARK', name: lm.name, data: lm, id: lm.id });
      }
    }
  }, [cityData, handleSelectEntity]);

  // Re-Analyze / Sync City Model Action
  const handleReindex = useCallback(async () => {
    if (!selectedRepoId || reindexing) return;
    try {
      setReindexing(true);
      const updatedCity = await codecityApi.generateCity(selectedRepoId);
      setCityData(updatedCity);
      const eps = await codecityApi.getEndpoints(selectedRepoId).catch(() => []);
      setEndpoints(eps);
    } catch (err) {
      console.error('Reindexing failed:', err);
    } finally {
      setReindexing(false);
    }
  }, [selectedRepoId, reindexing]);

  // Dependency Impact Mode Handlers
  const handleTriggerImpactMode = useCallback((buildingKey) => {
    if (!cityData) return;
    const bldg = (cityData.buildings || []).find(b => b.id === buildingKey || b.name === buildingKey || b.fileId === buildingKey);
    if (!bldg) return;

    const upstreamIds = new Set();
    const downstreamIds = new Set();

    (cityData.roads || []).forEach(r => {
      if (r.targetBuildingId === bldg.id || r.targetBuildingId === bldg.fileId) {
        upstreamIds.add(r.sourceBuildingId);
      }
      if (r.sourceBuildingId === bldg.id || r.sourceBuildingId === bldg.fileId) {
        downstreamIds.add(r.targetBuildingId);
      }
    });

    setImpactMode({
      active: true,
      targetBuildingId: bldg.id,
      targetName: bldg.fileName || bldg.name,
      upstreamIds,
      downstreamIds,
      affectedCount: upstreamIds.size + downstreamIds.size
    });
  }, [cityData]);

  const handleClearImpactMode = useCallback(() => {
    setImpactMode(null);
  }, []);

  // Step change during video-like playback -> auto-pan camera only when moving between buildings
  const handleStepChange = useCallback((newStep) => {
    setActiveStepIndex(newStep);
    const trans = journeyGraph?.transitions?.[newStep - 1];
    const scope = trans?.scope;
    // Prompt Part 7: "Several consecutive steps inside one building: camera and building stay stable; only the active workstation changes."
    if (scope === 'WORKSTATION' || scope === 'ROOM') {
      return;
    }

    const currentSteps = journeyMode === 'RESPONSE' && executionPath?.responseSteps?.length > 0
      ? executionPath.responseSteps
      : (executionPath?.steps || []);

    const stepObj = currentSteps.find(s => s.stepIndex === newStep);
    if (stepObj) {
      const targetKey = stepObj.targetComponentKey || stepObj.sourceComponentKey;
      const b = cityData?.buildings?.find(b => b.id === targetKey || b.fileId === targetKey);
      if (b) {
        setCenter(b.x + b.width / 2, b.y + b.height / 2, { zoom: 1.25, duration: 600 });
      }
    }
  }, [journeyGraph, executionPath, journeyMode, cityData, setCenter]);

  // Semantic zoom tracking on canvas view change
  const handleMoveEnd = useCallback((event, viewport) => {
    if (viewport.zoom < 0.45) {
      setSemanticZoom('districts');
    } else if (viewport.zoom < 1.05) {
      setSemanticZoom('buildings');
    } else {
      setSemanticZoom('rooms');
    }
  }, []);

  // Filtered endpoints for dropdown
  const filteredEndpoints = useMemo(() => {
    if (!endpointFilter.trim()) return endpoints;
    const q = endpointFilter.toLowerCase().trim();
    return endpoints.filter(ep =>
      (ep.routePath && ep.routePath.toLowerCase().includes(q)) ||
      (ep.httpMethod && ep.httpMethod.toLowerCase().includes(q)) ||
      (ep.controllerClass && ep.controllerClass.toLowerCase().includes(q))
    );
  }, [endpoints, endpointFilter]);

  // Global search match filtering
  const searchResults = useMemo(() => {
    if (!globalSearch || globalSearch.trim().length < 2 || !cityData) return [];
    const q = globalSearch.toLowerCase().trim();

    const matches = [];
    (cityData.buildings || []).forEach(b => {
      if (b.name.toLowerCase().includes(q) || (b.fileName && b.fileName.toLowerCase().includes(q))) {
        matches.push({ type: 'BUILDING', id: b.id, name: b.name, meta: b.fileName || b.packageName, obj: b });
      }
    });

    (cityData.districts || []).forEach(d => {
      if (d.name.toLowerCase().includes(q) || (d.folderPath && d.folderPath.toLowerCase().includes(q))) {
        matches.push({ type: 'DISTRICT', id: d.id, name: d.name, meta: d.folderPath, obj: d });
      }
    });

    endpoints.forEach(ep => {
      if (ep.routePath.toLowerCase().includes(q) || ep.controllerClass.toLowerCase().includes(q)) {
        matches.push({ type: 'ENDPOINT', id: ep.id, name: `${ep.httpMethod} ${ep.routePath}`, meta: ep.controllerClass, obj: ep });
      }
    });

    return matches.slice(0, 8);
  }, [globalSearch, cityData, endpoints]);

  const handleSelectSearchResult = (res) => {
    setGlobalSearch('');
    if (res.type === 'BUILDING') {
      setCenter(res.obj.x + res.obj.width / 2, res.obj.y + res.obj.height / 2, { zoom: 1.3, duration: 600 });
      handleOpenSourceInspector(res.obj.id);
    } else if (res.type === 'DISTRICT') {
      setCenter(res.obj.x + res.obj.width / 2, res.obj.y + res.obj.height / 2, { zoom: 0.9, duration: 600 });
    } else if (res.type === 'ENDPOINT') {
      handleSelectEndpoint(res.obj);
    }
  };

  const currentRepoName = cityData?.repositoryName || 'ecommerce-backend';

  return (
    <div
      ref={workspaceContainerRef}
      className={`codecity-workspace-root ${isFullscreen ? 'is-enlarged' : ''}`}
      style={{
        width: '100%',
        height: '100%',
        maxWidth: '100%',
        maxHeight: '100%',
        boxSizing: 'border-box',
        background: 'var(--cc-bg, #09090c)',
        color: 'var(--cc-text, #ececf2)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        fontFamily: "var(--f, 'Geist', system-ui, sans-serif)"
      }}
    >
      {/* =========================================================================
          TOP BAR (Exact Mockup Layout: CodeCity, Repo, Endpoint ▾, Level Pills)
          ========================================================================= */}
      <header
        className="codecity-topbar"
        style={{
          height: '56px',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          padding: '0 20px',
          borderBottom: '1px solid var(--cc-border, #23232c)',
          background: 'var(--cc-surface-2, #15151b)',
          zIndex: 20,
          position: 'relative',
          color: 'var(--cc-text, #ececf2)'
        }}
      >
        {/* Back Button */}
        <button
          onClick={onBackToDirectory}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'var(--cc-surface, #0f0f13)',
            border: '1px solid var(--cc-border, #23232c)',
            color: 'var(--cc-text, #ececf2)',
            borderRadius: '6px',
            padding: '5px 10px',
            fontSize: '12px',
            cursor: 'pointer'
          }}
          title="Return to Repository Cities"
        >
          <ChevronLeft size={14} />
          <span>All Cities</span>
        </button>

        {/* Brand Title */}
        <div style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-.01em', color: 'var(--cc-text, #ececf2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>CodeCity</span>
          <span style={{ color: 'var(--cc-border, #23232c)' }}>/</span>
          <span style={{ fontSize: '12px', color: 'var(--cc-text-muted, #8b8b9a)', fontWeight: 500 }}>Repository:</span>
        </div>

        {/* Repository Switcher & Provenance Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            value={selectedRepoId || ''}
            onChange={(e) => setSelectedRepoId(Number(e.target.value))}
            style={{
              background: 'var(--cc-surface, #0f0f13)',
              border: '1px solid var(--cc-border, #23232c)',
              borderRadius: '6px',
              padding: '6px 12px',
              color: 'var(--cc-text, #ececf2)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none'
            }}
            title="Active Repository City"
          >
            {repositories.map(r => (
              <option key={r.id} value={r.id} style={{ background: 'var(--cc-surface, #0f0f13)', color: 'var(--cc-text, #ececf2)' }}>
                {r.repoName}
              </option>
            ))}
          </select>

          {/* Provenance: Branch Badge */}
          <span
            style={{
              fontSize: '11px',
              padding: '3px 8px',
              borderRadius: '5px',
              background: 'var(--cc-surface-3, #1b1b23)',
              color: 'var(--cc-cyan, #38bdf8)',
              fontFamily: "var(--m, 'Geist Mono', monospace)",
              border: '1px solid var(--cc-border, #23232c)',
              fontWeight: 600
            }}
            title="Indexed Branch"
          >
            git: {currentRepoData?.defaultBranch || 'main'}
          </span>

          {/* Provenance: Commit SHA Badge */}
          <span
            style={{
              fontSize: '11px',
              padding: '3px 8px',
              borderRadius: '5px',
              background: 'var(--cc-surface-3, #1b1b23)',
              color: 'var(--cc-text-muted, #8b8b9a)',
              fontFamily: "var(--m, 'Geist Mono', monospace)",
              border: '1px solid var(--cc-border, #23232c)'
            }}
            title="Indexed Commit SHA"
          >
            {(cityData?.commitSha || currentRepoData?.commitSha)?.substring(0, 7) || 'HEAD'}
          </span>

          {/* Provenance: Analysis Status */}
          <span
            style={{
              fontSize: '10.5px',
              padding: '3px 8px',
              borderRadius: '5px',
              background: currentRepoData?.hasCity ? 'rgba(52, 211, 153, 0.15)' : 'rgba(245, 185, 66, 0.15)',
              color: currentRepoData?.hasCity ? '#34d399' : '#f5b942',
              fontWeight: 700,
              border: `1px solid ${currentRepoData?.hasCity ? '#34d399' : '#f5b942'}`
            }}
          >
            {currentRepoData?.hasCity ? 'ANALYZED' : 'INDEXED'}
          </span>

          {/* Re-analyze Architecture Button */}
          <button
            onClick={handleReindex}
            disabled={reindexing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'var(--cc-surface, #0f0f13)',
              border: '1px solid var(--cc-border, #23232c)',
              color: reindexing ? 'var(--cc-text-muted, #8b8b9a)' : 'var(--cc-text, #ececf2)',
              borderRadius: '6px',
              padding: '5px 10px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: reindexing ? 'not-allowed' : 'pointer'
            }}
            title="Re-analyze repository AST and rebuild city model"
          >
            <RotateCcw size={12} className={reindexing ? 'spin-anim' : ''} />
            <span>{reindexing ? 'Syncing...' : 'Re-Analyze'}</span>
          </button>
        </div>

        {/* Renderer Mode Switcher */}
        <div style={{ display: 'flex', gap: '3px', background: 'var(--cc-surface-3, #1b1b23)', borderRadius: '8px', padding: '3px', border: '1px solid var(--cc-border, #23232c)' }}>
          <button
            onClick={() => setRendererMode('metropolis')}
            style={{
              height: '30px',
              padding: '0 12px',
              border: 0,
              borderRadius: '6px',
              background: rendererMode === 'metropolis' ? 'var(--cc-surface, #0f0f13)' : 'transparent',
              color: rendererMode === 'metropolis' ? 'var(--cc-text, #ececf2)' : 'var(--cc-text-muted, #8b8b9a)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease'
            }}
          >
            🏙️ Metropolis
          </button>
          <button
            onClick={() => setRendererMode('diagram')}
            style={{
              height: '30px',
              padding: '0 12px',
              border: 0,
              borderRadius: '6px',
              background: rendererMode === 'diagram' ? 'var(--cc-surface, #0f0f13)' : 'transparent',
              color: rendererMode === 'diagram' ? 'var(--cc-text, #ececf2)' : 'var(--cc-text-muted, #8b8b9a)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.15s ease'
            }}
          >
            🔲 Box Diagram
          </button>
        </div>

        {/* Endpoint Selector Button & Quick Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}>
          <button
            onClick={() => setEndpointDropdownOpen(!endpointDropdownOpen)}
            style={{
              height: '32px',
              padding: '0 12px',
              borderRadius: '6px',
              border: '1px solid var(--cc-border, #23232c)',
              background: 'var(--cc-surface, #0f0f13)',
              color: 'var(--cc-text, #ececf2)',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <span>
              {selectedEndpoint
                ? `${selectedEndpoint.httpMethod} ${selectedEndpoint.routePath}`
                : 'Select Endpoint'}
            </span>
            <ChevronDown size={14} />
          </button>

          {/* Clear Route Button - INLINE IN DOCUMENT FLOW (Zero Absolute Overlap!) */}
          {selectedEndpoint && (
            <button
              onClick={handleClearEndpoint}
              style={{
                height: '32px',
                padding: '0 10px',
                borderRadius: '6px',
                border: '1px solid rgba(242, 109, 109, 0.4)',
                background: 'rgba(242, 109, 109, 0.12)',
                color: '#f26d6d',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
              title="Clear Route & Return to Metropolis View"
            >
              <X size={14} />
              <span>Clear Route</span>
            </button>
          )}

          {/* Endpoint Dropdown Menu */}
          {endpointDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                width: '380px',
                maxHeight: '440px',
                overflowY: 'auto',
                background: 'var(--cc-surface, #0f0f13)',
                border: '1px solid var(--cc-border, #23232c)',
                borderRadius: '8px',
                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5)',
                zIndex: 200,
                padding: '8px'
              }}
            >
              <input
                type="text"
                placeholder="Filter endpoints..."
                value={endpointFilter}
                onChange={e => setEndpointFilter(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '7px 10px',
                  background: 'var(--cc-surface-2, #15151b)',
                  border: '1px solid var(--cc-border, #23232c)',
                  borderRadius: '6px',
                  color: 'var(--cc-text, #ececf2)',
                  fontSize: '12px',
                  marginBottom: '8px',
                  outline: 'none'
                }}
              />
              <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                <div
                  onClick={() => {
                    handleClearEndpoint();
                    setEndpointDropdownOpen(false);
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: !selectedEndpoint ? 'var(--cc-surface-3, #1b1b23)' : 'transparent',
                    borderBottom: '1px solid var(--cc-border, #23232c)',
                    marginBottom: '6px',
                    color: 'var(--cc-cyan, #38bdf8)',
                    fontWeight: 600,
                    fontSize: '12px'
                  }}
                >
                  <span>🌆 Explore Entire Metropolis (Clear Route)</span>
                </div>
                {filteredEndpoints.length === 0 ? (
                  <div style={{ padding: '12px', color: 'var(--cc-text-muted, #8b8b9a)', fontSize: '12px', textAlign: 'center' }}>
                    No matching endpoints found
                  </div>
                ) : (
                  filteredEndpoints.map(ep => (
                    <div
                      key={ep.id}
                      onClick={() => handleSelectEndpoint(ep)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: selectedEndpoint?.id === ep.id ? 'var(--cc-surface-3, #1b1b23)' : 'transparent',
                        borderBottom: '1px solid var(--cc-border, #23232c)'
                      }}
                    >
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'rgba(56, 189, 248, 0.15)',
                          color: '#38bdf8',
                          flexShrink: 0
                        }}
                      >
                        {ep.httpMethod}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--cc-text, #ececf2)', fontFamily: "var(--m, 'Geist Mono', monospace)", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ep.routePath}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Architecture Intelligence Button */}
        <button
          onClick={() => setIntelligenceOpen(!intelligenceOpen)}
          style={{
            height: '32px',
            padding: '0 12px',
            borderRadius: '6px',
            border: '1px solid var(--cc-border, #23232c)',
            background: intelligenceOpen ? 'var(--cc-surface-3, #1b1b23)' : 'var(--cc-surface, #0f0f13)',
            color: 'var(--cc-text, #ececf2)',
            fontSize: '12px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            marginLeft: 'auto'
          }}
          title="Open Architecture Intelligence, Hotspots & Circular Dependency Drawer"
        >
          <span>🧠 Intelligence</span>
          {intelligenceData?.warnings?.length > 0 && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 800,
                padding: '1px 6px',
                borderRadius: '10px',
                background: intelligenceData.warnings.some(w => w.severity === 'CRITICAL') ? '#f26d6d' : '#f5b942',
                color: '#ffffff'
              }}
            >
              {intelligenceData.warnings.length}
            </span>
          )}
        </button>

        {/* Diagram Mode Only: Level Pills & Fit View */}
        {rendererMode === 'diagram' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ display: 'flex', gap: '3px', background: 'var(--cc-surface-3, #1b1b23)', borderRadius: '8px', padding: '3px', border: '1px solid var(--cc-border, #23232c)' }}>
              <button
                onClick={() => {
                  setSemanticZoom('districts');
                  fitView({ padding: 0.35, duration: 500 });
                }}
                style={{
                  height: '28px',
                  padding: '0 10px',
                  border: 0,
                  borderRadius: '6px',
                  background: semanticZoom === 'districts' ? 'var(--cc-surface, #0f0f13)' : 'transparent',
                  color: semanticZoom === 'districts' ? 'var(--cc-text, #ececf2)' : 'var(--cc-text-muted, #8b8b9a)',
                  fontSize: '11px',
                  fontWeight: semanticZoom === 'districts' ? 600 : 500,
                  cursor: 'pointer'
                }}
              >
                1 · City
              </button>
              <button
                onClick={() => {
                  setSemanticZoom('buildings');
                  fitView({ padding: 0.15, duration: 500 });
                }}
                style={{
                  height: '28px',
                  padding: '0 10px',
                  border: 0,
                  borderRadius: '6px',
                  background: semanticZoom === 'buildings' ? 'var(--cc-surface, #0f0f13)' : 'transparent',
                  color: semanticZoom === 'buildings' ? 'var(--cc-text, #ececf2)' : 'var(--cc-text-muted, #8b8b9a)',
                  fontSize: '11px',
                  fontWeight: semanticZoom === 'buildings' ? 600 : 500,
                  cursor: 'pointer'
                }}
              >
                2 · District
              </button>
              <button
                onClick={() => {
                  setSemanticZoom('rooms');
                  fitView({ padding: 0.15, duration: 500 });
                }}
                style={{
                  height: '28px',
                  padding: '0 10px',
                  border: 0,
                  borderRadius: '6px',
                  background: semanticZoom === 'rooms' ? 'var(--cc-surface, #0f0f13)' : 'transparent',
                  color: semanticZoom === 'rooms' ? 'var(--cc-text, #ececf2)' : 'var(--cc-text-muted, #8b8b9a)',
                  fontSize: '11px',
                  fontWeight: semanticZoom === 'rooms' ? 600 : 500,
                  cursor: 'pointer'
                }}
              >
                3 · Building
              </button>
            </div>
            <button
              onClick={() => fitView({ padding: 0.15, duration: 400 })}
              style={{
                background: 'var(--cc-surface, #0f0f13)',
                border: '1px solid var(--cc-border, #23232c)',
                color: 'var(--cc-text, #ececf2)',
                padding: '6px 8px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Fit City to Viewport"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        )}

        {/* Enlarge / Fullscreen Workspace Toggle Button */}
        <button
          onClick={toggleFullscreen}
          style={{
            background: isFullscreen ? 'var(--cc-surface-3, #1b1b23)' : 'var(--cc-surface, #0f0f13)',
            border: '1px solid var(--cc-border, #23232c)',
            color: isFullscreen ? 'var(--cc-cyan, #38bdf8)' : 'var(--cc-text, #ececf2)',
            height: '32px',
            padding: '0 10px',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11.5px',
            fontWeight: 600
          }}
          title={isFullscreen ? "Exit Fullscreen" : "Enlarge Workspace into Fullscreen"}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          <span>{isFullscreen ? 'Exit Fullscreen' : 'Enlarge'}</span>
        </button>
      </header>

      {/* =========================================================================
          MAIN BODY (Canvas on Center/Left, Request Journey Inspector on Right)
          ========================================================================= */}
      <div style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
        {/* Interactive Software City Canvas */}
        <main style={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%', position: 'relative', background: 'var(--cc-bg, #09090c)', overflow: 'hidden' }}>
          {loading && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(9, 9, 12, 0.85)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 80
              }}
            >
              <div className="city-spinner" />
              <span style={{ color: 'var(--cc-text, #ececf2)', fontSize: '13px', marginTop: '12px' }}>
                Constructing Software City...
              </span>
            </div>
          )}

          {error && (
            <div
              style={{
                position: 'absolute',
                top: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#FFFFFF',
                border: '1px solid #B7655D',
                borderRadius: '8px',
                padding: '12px 18px',
                zIndex: 80,
                color: '#39332E'
              }}
            >
              <span style={{ color: '#B7655D', fontWeight: 600 }}>City Notice: </span>
              {error}
            </div>
          )}

          {rendererMode === 'metropolis' ? (
            <MetropolisCityViewport
              cityData={cityData}
              executionPath={executionPath}
              journeyGraph={journeyGraph}
              activeStepIndex={activeStepIndex}
              journeyMode={journeyMode}
              selectedEndpoint={selectedEndpoint}
              onSelectBuilding={handleSelectBuildingFromMetropolis}
              onSelectWorkstation={handleSelectWorkstationFromMetropolis}
              onSelectEndpoint={handleSelectEndpoint}
              selectedBuildingId={selectedComponentDetail?.nodeKey}
              selectedEntity={selectedEntity}
              onSelectEntity={handleSelectEntity}
              impactMode={impactMode}
              onClearImpactMode={handleClearImpactMode}
              isFullscreen={isFullscreen}
              onToggleFullscreen={toggleFullscreen}
            />
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              onMoveEnd={handleMoveEnd}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              minZoom={0.12}
              maxZoom={2.8}
              defaultViewport={{ x: 0, y: 0, zoom: 0.65 }}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#D9CFC7" gap={28} size={1} />
              <Controls className="city-controls" position="bottom-right" />
              <MiniMap
                className="city-minimap"
                position="bottom-left"
                nodeColor={(node) => node.data?.color || '#587C78'}
                maskColor="rgba(249, 248, 246, 0.85)"
                style={{ background: '#FFFFFF', border: '1px solid #D9CFC7', borderRadius: '8px' }}
              />
            </ReactFlow>
          )}
        </main>

        {/* Right Sidebar: Request Journey Inspector (Exact 400px width from mockup) */}
        {executionPath && showExplanationPanel && (
          <RequestJourneyPanel
            repositoryId={selectedRepoId}
            executionPath={executionPath}
            journeyGraph={journeyGraph}
            activeStepIndex={activeStepIndex}
            onStepSelect={handleStepChange}
            onClose={() => setShowExplanationPanel(false)}
            onOpenSourceInspector={handleOpenSourceInspector}
            cityData={cityData}
          />
        )}

        {/* Right Sidebar: Component Inspector (when clicked without active journey or when toggled) */}
        {inspectorOpen && (!executionPath || !showExplanationPanel) && (
          <aside style={{ width: '400px', background: 'var(--cc-surface, #0f0f13)', borderLeft: '1px solid var(--cc-border, #23232c)', color: 'var(--cc-text, #ececf2)', zIndex: 30, overflowY: 'auto' }}>
            <ComponentInspectorPanel
              repositoryId={selectedRepoId}
              repositoryData={currentRepoData}
              selectedEntity={selectedEntity}
              componentDetail={selectedComponentDetail}
              cityData={cityData}
              onClose={() => setInspectorOpen(false)}
              onSelectEndpoint={handleSelectEndpoint}
              onNavigateToEntity={handleNavigateToEntity}
              onAnalyzeImpact={handleTriggerImpactMode}
              onReindex={handleReindex}
            />
          </aside>
        )}

        {/* Engineering & Architecture Intelligence Drawer (Phase 5) */}
        <ArchitectureIntelligenceDrawer
          repositoryId={selectedRepoId}
          isOpen={intelligenceOpen}
          onClose={() => setIntelligenceOpen(false)}
          onNavigateToEntity={(entityKey) => {
            handleOpenSourceInspector(entityKey);
            const b = cityData?.buildings?.find(b => b.id === entityKey || b.fileId === entityKey || b.name === entityKey);
            if (b) {
              setCenter(b.x + b.width / 2, b.y + b.height / 2, { zoom: 1.35, duration: 600 });
            }
          }}
          onSelectCycle={(cycle) => {
            if (cycle.participatingNodeKeys?.length > 0) {
              const firstKey = cycle.participatingNodeKeys[0];
              handleOpenSourceInspector(firstKey);
              const b = cityData?.buildings?.find(b => b.id === firstKey || b.fileId === firstKey);
              if (b) {
                setCenter(b.x + b.width / 2, b.y + b.height / 2, { zoom: 1.2, duration: 600 });
              }
            }
          }}
        />
      </div>

      {/* =========================================================================
          BOTTOM PLAYBACK BAR (Exact Mockup Layout: Play, Prev/Next, Steps, Mode, Speed)
          ========================================================================= */}
      {executionPath && (
        <ExecutionTimeline
          executionPath={executionPath}
          journeyGraph={journeyGraph}
          activeStepIndex={activeStepIndex}
          onStepChange={handleStepChange}
          onClose={handleClearEndpoint}
          showExplanationPanel={showExplanationPanel}
          onToggleExplanationPanel={() => setShowExplanationPanel(!showExplanationPanel)}
          journeyMode={journeyMode}
          onJourneyModeChange={setJourneyMode}
        />
      )}
    </div>
  );
};

export const CodeCityWorkspace = (props) => {
  const [viewMode, setViewMode] = useState(props.initialRepoId ? 'city' : 'directory');
  const [currentRepoId, setCurrentRepoId] = useState(props.initialRepoId);

  const handleSelectCity = (repoId) => {
    setCurrentRepoId(repoId);
    setViewMode('city');
  };

  const handleBackToDirectory = () => {
    setViewMode('directory');
  };

  if (viewMode === 'directory') {
    return <RepositoryCitiesPage onSelectCity={handleSelectCity} />;
  }

  return (
    <ReactFlowProvider>
      <CodeCityWorkspaceInner
        initialRepoId={currentRepoId}
        onBackToDirectory={handleBackToDirectory}
      />
    </ReactFlowProvider>
  );
};
