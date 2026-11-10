import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { GitBranch, RefreshCw, Filter, Sliders, ShieldCheck, Zap, Maximize2, Minimize2 } from 'lucide-react';
import { graphApi } from '../../api/graphApi';
import { layoutEngine } from '../../layout/layoutEngine';
import { RepoNetworkNode } from './RepoNetworkNode';
import { GraphInspector } from '../../shared/GraphInspector';
import { GraphLegend } from '../../shared/GraphLegend';
import { GraphLoading, GraphEmptyState, GraphErrorState } from '../../shared/GraphStates';

const nodeTypes = {
  repository: RepoNetworkNode
};

export const RelationshipsPage = ({ onNavigateToArchitecture }) => {
  const [networkData, setNetworkData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [layoutMode, setLayoutMode] = useState('force'); // 'force', 'circular', 'cluster', 'elk'
  const [searchRepo, setSearchRepo] = useState('');
  const [ecosystemFilter, setEcosystemFilter] = useState('ALL');
  const [healthFilter, setHealthFilter] = useState('ALL');
  const [minSharedCount, setMinSharedCount] = useState(1);
  const [minSimilarity, setMinSimilarity] = useState(0);

  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isolateSelected, setIsolateSelected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const workspaceRef = useRef(null);

  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.getAttribute('data-theme') !== 'light' &&
           document.documentElement.getAttribute('data-t') !== 'l';
  });

  useEffect(() => {
    const handleThemeChange = () => {
      const isL = document.documentElement.getAttribute('data-theme') === 'light' ||
                  document.documentElement.getAttribute('data-t') === 'l';
      setIsDark(!isL);
    };
    window.addEventListener('plexus-theme-changed', handleThemeChange);
    const observer = new MutationObserver(handleThemeChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-t'] });
    return () => {
      window.removeEventListener('plexus-theme-changed', handleThemeChange);
      observer.disconnect();
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      workspaceRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelectedItem(null);
    setSelectedNodeId(null);
    try {
      const data = await graphApi.fetchRepositoryRelationships();
      setNetworkData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute graph filtering, dimming, and layout
  useEffect(() => {
    if (!networkData || !networkData.nodes) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const rawNodes = networkData.nodes || [];
    const rawEdges = networkData.edges || [];

    // Filter nodes by query, ecosystem, health
    const query = searchRepo.toLowerCase().trim();
    const filteredNodes = rawNodes.filter(n => {
      if (query && !n.label.toLowerCase().includes(query)) return false;
      if (ecosystemFilter !== 'ALL' && (n.group || '').toUpperCase() !== ecosystemFilter) return false;
      if (healthFilter !== 'ALL' && (n.healthRating || '').toUpperCase() !== healthFilter) return false;
      return true;
    });

    const validNodeIdSet = new Set(filteredNodes.map(n => String(n.id)));

    // Filter edges by node membership, minSharedCount, minSimilarity
    let candidateEdges = rawEdges.filter(e => {
      const src = String(typeof e.source === 'object' ? e.source.id : e.source);
      const tgt = String(typeof e.target === 'object' ? e.target.id : e.target);
      if (!validNodeIdSet.has(src) || !validNodeIdSet.has(tgt)) return false;
      if ((e.weight || 1) < minSharedCount) return false;
      if ((e.similarityPercentage || 0) < minSimilarity) return false;
      return true;
    });

    // Count how many shared edges each node has
    const edgeCountByNode = new Map();
    candidateEdges.forEach(e => {
      const src = String(typeof e.source === 'object' ? e.source.id : e.source);
      const tgt = String(typeof e.target === 'object' ? e.target.id : e.target);
      edgeCountByNode.set(src, (edgeCountByNode.get(src) || 0) + 1);
      edgeCountByNode.set(tgt, (edgeCountByNode.get(tgt) || 0) + 1);
    });

    // If a node is selected, compute immediate neighbors
    const neighborNodeIds = new Set();
    if (selectedNodeId) {
      neighborNodeIds.add(String(selectedNodeId));
      candidateEdges.forEach(e => {
        const src = String(typeof e.source === 'object' ? e.source.id : e.source);
        const tgt = String(typeof e.target === 'object' ? e.target.id : e.target);
        if (src === String(selectedNodeId)) neighborNodeIds.add(tgt);
        if (tgt === String(selectedNodeId)) neighborNodeIds.add(src);
      });

      if (isolateSelected) {
        candidateEdges = candidateEdges.filter(e => {
          const src = String(typeof e.source === 'object' ? e.source.id : e.source);
          const tgt = String(typeof e.target === 'object' ? e.target.id : e.target);
          return neighborNodeIds.has(src) && neighborNodeIds.has(tgt);
        });
      }
    }

    const activeRawNodes = isolateSelected && selectedNodeId
      ? filteredNodes.filter(n => neighborNodeIds.has(String(n.id)))
      : filteredNodes;

    const flowNodes = activeRawNodes.map(n => {
      const strId = String(n.id);
      const isSelected = selectedNodeId === strId;
      const isDimmed = selectedNodeId && !neighborNodeIds.has(strId);
      const sharedCount = edgeCountByNode.get(strId) || 0;

      return {
        id: strId,
        type: 'repository',
        data: {
          ...n,
          id: strId,
          rawId: n.rawId || n.id,
          isDimmed,
          isIsolated: sharedCount === 0,
          sharedEdgeCount: sharedCount
        },
        position: { x: 0, y: 0 }
      };
    });

    const flowEdges = candidateEdges.map((e, idx) => {
      const src = String(typeof e.source === 'object' ? e.source.id : e.source);
      const tgt = String(typeof e.target === 'object' ? e.target.id : e.target);
      const isHighlighted = selectedNodeId && (src === String(selectedNodeId) || tgt === String(selectedNodeId));
      const isDimmed = selectedNodeId && !isHighlighted;
      const weight = e.weight || 1;
      const defaultColor = isDark ? '#38bdf8' : '#2563eb';
      const edgeStroke = isHighlighted ? (isDark ? '#6d8cff' : '#3552d6') : isDimmed ? (isDark ? '#23232c' : '#e2e8f0') : defaultColor;

      return {
        id: e.id || `e-${src}-${tgt}-${idx}`,
        source: src,
        target: tgt,
        style: {
          stroke: edgeStroke,
          strokeWidth: Math.max(1.8, Math.min(6, Math.sqrt(weight) * 1.8)),
          opacity: isDimmed ? 0.15 : 0.85
        },
        data: {
          ...e,
          source: src,
          target: tgt
        }
      };
    });

    // Run layout algorithm
    const runLayout = async () => {
      let layoutedNodes = flowNodes;
      if (layoutMode === 'force') {
        layoutedNodes = layoutEngine.applyForceLayout(flowNodes, flowEdges, {
          similarityAware: true,
          linkDistance: 200,
          charge: -520
        });
      } else if (layoutMode === 'circular') {
        layoutedNodes = layoutEngine.applyCircularLayout(flowNodes);
      } else if (layoutMode === 'cluster') {
        layoutedNodes = layoutEngine.applyClusteredLayout(flowNodes, flowEdges, {
          clusterField: 'group'
        });
      } else if (layoutMode === 'elk') {
        layoutedNodes = await layoutEngine.applyElkLayout(flowNodes, flowEdges, {
          direction: 'DOWN',
          spacing: 50,
          layerSpacing: 100
        });
      }

      setNodes(layoutedNodes);
      setEdges(flowEdges);
    };

    runLayout();
  }, [
    networkData,
    layoutMode,
    searchRepo,
    ecosystemFilter,
    healthFilter,
    minSharedCount,
    minSimilarity,
    selectedNodeId,
    isolateSelected,
    setNodes,
    setEdges
  ]);

  const onNodeClick = (_, node) => {
    const rawId = String(node.data?.id || node.id);
    setSelectedNodeId(rawId);
    setSelectedItem(node);
  };

  const onEdgeClick = (_, edge) => {
    setSelectedItem(edge);
  };

  const onPaneClick = () => {
    setSelectedNodeId(null);
    setSelectedItem(null);
  };

  const maxAvailableWeight = networkData?.maxWeight || 26;
  const connectedRepoCount = nodes.filter(n => !n.data?.isIsolated).length;

  return (
    <div className="graph-workspace" ref={workspaceRef}>
      {/* Top Toolbar */}
      <div className="graph-toolbar">
        <div className="graph-toolbar-group">
          <div className="graph-title-badge">
            <GitBranch size={16} />
            <span>Repository Relationships</span>
          </div>

          {/* Layout Selector */}
          <select
            className="graph-select"
            value={layoutMode}
            onChange={(e) => setLayoutMode(e.target.value)}
            title="Graph positioning algorithm"
          >
            <option value="force">Force-Directed Network (Default)</option>
            <option value="circular">Circular Ring Layout</option>
            <option value="cluster">Clustered by Ecosystem</option>
            <option value="elk">Hierarchical Layout</option>
          </select>

          {/* Ecosystem Filter */}
          <select
            className="graph-select"
            value={ecosystemFilter}
            onChange={(e) => setEcosystemFilter(e.target.value)}
          >
            <option value="ALL">All Ecosystems</option>
            <option value="MAVEN">Maven Only</option>
            <option value="NPM">npm Only</option>
          </select>

          {/* Health Filter */}
          <select
            className="graph-select"
            value={healthFilter}
            onChange={(e) => setHealthFilter(e.target.value)}
          >
            <option value="ALL">All Health Ratings</option>
            <option value="HEALTHY">Healthy Only</option>
            <option value="MODERATE">Moderate Only</option>
            <option value="CRITICAL">Critical Only</option>
          </select>

          {/* Repository Search */}
          <input
            type="text"
            className="graph-input"
            placeholder="Search repositories..."
            value={searchRepo}
            onChange={(e) => setSearchRepo(e.target.value)}
            style={{ width: 160 }}
          />
        </div>

        <div className="graph-toolbar-group">
          {/* Min Shared Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11px', color: 'var(--text-muted)' }}>
            <span>Min Shared:</span>
            <input
              type="range"
              min="1"
              max={Math.max(2, maxAvailableWeight)}
              value={minSharedCount}
              onChange={(e) => setMinSharedCount(Number(e.target.value))}
              style={{ width: 60 }}
            />
            <span style={{ fontWeight: 600 }}>{minSharedCount}</span>
          </div>

          {/* Min Similarity Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11px', color: 'var(--text-muted)' }}>
            <span>Min Sim:</span>
            <input
              type="range"
              min="0"
              max="90"
              step="5"
              value={minSimilarity}
              onChange={(e) => setMinSimilarity(Number(e.target.value))}
              style={{ width: 60 }}
            />
            <span style={{ fontWeight: 600 }}>{minSimilarity}%</span>
          </div>

          {/* Isolate Toggle */}
          {selectedNodeId && (
            <button
              className={`graph-btn ${isolateSelected ? 'active' : ''}`}
              onClick={() => setIsolateSelected(prev => !prev)}
              title="Isolate selected repository and its immediate neighbors"
            >
              Isolate
            </button>
          )}

          <button className="graph-btn" onClick={loadData} title="Refresh relationship graph">
            <RefreshCw size={13} className={loading ? 'spin-icon' : ''} />
          </button>
          <button
            className="graph-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* Sub-Header Metadata Bar */}
      {networkData && (
        <div className="graph-sub-bar">
          <div className="graph-meta-pills">
            <span className="meta-pill brand">
              Repositories: {networkData.totalNodes || 0}
            </span>
            <span className="meta-pill success">
              Connected: {connectedRepoCount}
            </span>
            <span className="meta-pill">
              Shared Links: {edges.length}
            </span>
            <span className="meta-pill">
              Max Overlap: {networkData.maxWeight || 0} packages
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Edge thickness indicates shared library overlap • Click repository or edge for details
          </div>
        </div>
      )}

      {/* Main Canvas Area */}
      <div className="graph-canvas-wrapper">
        {loading ? (
          <GraphLoading message="Simulating cross-repository dependency coupling..." />
        ) : error ? (
          <GraphErrorState error={error} onRetry={loadData} />
        ) : nodes.length === 0 ? (
          <GraphEmptyState
            title="No repository relationships match"
            description="Lower the minimum shared dependency threshold or clear filters to view cross-repository connections."
            actionLabel="Reset Thresholds"
            onAction={() => {
              setSearchRepo('');
              setEcosystemFilter('ALL');
              setHealthFilter('ALL');
              setMinSharedCount(1);
              setMinSimilarity(0);
              setSelectedNodeId(null);
            }}
          />
        ) : (
          <>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              onEdgeClick={onEdgeClick}
              onPaneClick={onPaneClick}
              nodeTypes={nodeTypes}
              fitView
              minZoom={0.2}
              maxZoom={3}
            >
              <Background color={isDark ? '#23232c' : '#d3d8e2'} gap={20} size={1} />
              <Controls showInteractive={false} />
              <MiniMap
                nodeColor={(node) => (node.data?.group === 'NPM' ? (isDark ? '#34d399' : '#0b8f60') : (isDark ? '#6d8cff' : '#3552d6'))}
                maskColor={isDark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0.05)'}
              />
            </ReactFlow>

            <GraphLegend mode="relationships" />

            <GraphInspector
              selectedItem={selectedItem}
              itemType={selectedItem?.source ? 'edge' : 'node'}
              mode="relationships"
              onClose={() => {
                setSelectedItem(null);
                setSelectedNodeId(null);
              }}
              onNavigateToArchitecture={onNavigateToArchitecture}
            />
          </>
        )}
      </div>
    </div>
  );
};
