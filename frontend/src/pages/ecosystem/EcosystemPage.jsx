import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { BookOpen, RefreshCw, Filter, Sliders, AlertTriangle, Layers, Zap } from 'lucide-react';
import { graphApi } from '../../api/graphApi';
import { layoutEngine } from '../../layout/layoutEngine';
import { RepositoryNode } from './RepositoryNode';
import { DependencyNode } from './DependencyNode';
import { GraphInspector } from '../../shared/GraphInspector';
import { GraphLegend } from '../../shared/GraphLegend';
import { GraphLoading, GraphEmptyState, GraphErrorState } from '../../shared/GraphStates';

const nodeTypes = {
  repository: RepositoryNode,
  dependency: DependencyNode
};

const normalizeEcosystem = (val) => {
  const v = (val || '').toUpperCase();
  if (v.includes('NPM') || v.includes('PACKAGE') || v.includes('JSON')) return 'NPM';
  if (v.includes('MAVEN') || v.includes('POM')) return 'MAVEN';
  return v;
};

export const EcosystemPage = ({
  onNavigateToImpact,
  onNavigateToExplorer,
  onNavigateToArchitecture
}) => {
  const [bipartiteData, setBipartiteData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [layoutMode, setLayoutMode] = useState('bipartite-grid'); // 'bipartite-grid', 'elk-right', 'elk-down', 'force', 'ecosystem-cluster'
  const [searchDep, setSearchDep] = useState('');
  const [searchRepo, setSearchRepo] = useState('');
  const [ecosystemFilter, setEcosystemFilter] = useState('ALL'); // 'ALL', 'MAVEN', 'NPM'
  const [divergenceFilter, setDivergenceFilter] = useState('ALL'); // 'ALL', 'DIVERGENT', 'CONSISTENT'
  const [minRepoUsage, setMinRepoUsage] = useState(1);
  const [selectedItem, setSelectedItem] = useState(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelectedItem(null);
    try {
      const data = await graphApi.fetchBipartiteGraph();
      setBipartiteData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute filtered nodes, deduplicated edges, and dynamic highlights
  useEffect(() => {
    if (!bipartiteData || !bipartiteData.nodes) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const rawNodes = bipartiteData.nodes || [];
    const rawEdges = bipartiteData.edges || [];

    // Filter Repositories and Dependencies
    const depQuery = searchDep.toLowerCase().trim();
    const repoQuery = searchRepo.toLowerCase().trim();

    const filteredNodes = rawNodes.filter(n => {
      const isRepo = n.nodeCategory === 'REPOSITORY';
      const isDep = n.nodeCategory === 'DEPENDENCY';

      if (isRepo) {
        if (repoQuery && !n.label.toLowerCase().includes(repoQuery)) return false;
        if (ecosystemFilter !== 'ALL' && normalizeEcosystem(n.ecosystem) !== ecosystemFilter) return false;
        return true;
      }

      if (isDep) {
        if (depQuery && !n.label.toLowerCase().includes(depQuery)) return false;
        if (ecosystemFilter !== 'ALL' && normalizeEcosystem(n.ecosystem) !== ecosystemFilter) return false;
        if ((n.repoCount || 1) < minRepoUsage) return false;

        const isDivergent = n.isDivergent || (n.versions && n.versions.length > 1);
        if (divergenceFilter === 'DIVERGENT' && !isDivergent) return false;
        if (divergenceFilter === 'CONSISTENT' && isDivergent) return false;

        return true;
      }

      return true;
    });

    const validNodeIdSet = new Set(filteredNodes.map(n => String(n.id)));

    // Filter edges to only those connecting both visible nodes
    const candidateEdges = rawEdges.filter(e => {
      const src = String(e.source);
      const tgt = String(e.target);
      return validNodeIdSet.has(src) && validNodeIdSet.has(tgt);
    });

    // Deduplicate edges between same source and target to avoid duplicate React Flow IDs
    const seenEdgeKeys = new Set();
    const uniqueFilteredEdges = [];
    candidateEdges.forEach(e => {
      const edgeKey = `${e.source}->${e.target}`;
      if (!seenEdgeKeys.has(edgeKey)) {
        seenEdgeKeys.add(edgeKey);
        uniqueFilteredEdges.push(e);
      }
    });

    // Remove any repo or dependency node that has no active connections if filters are applied
    const connectedNodeIds = new Set();
    uniqueFilteredEdges.forEach(e => {
      connectedNodeIds.add(String(e.source));
      connectedNodeIds.add(String(e.target));
    });

    const activeNodes = (depQuery || repoQuery || divergenceFilter !== 'ALL' || minRepoUsage > 1)
      ? filteredNodes.filter(n => connectedNodeIds.has(String(n.id)))
      : filteredNodes;

    // Determine selection highlights
    const selectedNodeId = selectedItem && !selectedItem.source ? String(selectedItem.id) : null;
    const connectedToSelected = new Set();
    if (selectedNodeId) {
      connectedToSelected.add(selectedNodeId);
      uniqueFilteredEdges.forEach(e => {
        const src = String(e.source);
        const tgt = String(e.target);
        if (src === selectedNodeId) connectedToSelected.add(tgt);
        if (tgt === selectedNodeId) connectedToSelected.add(src);
      });
    }

    const flowNodes = activeNodes.map(n => {
      const strId = String(n.id);
      const isSelected = selectedNodeId === strId;
      const isDimmed = selectedNodeId && !connectedToSelected.has(strId);

      return {
        id: strId,
        type: n.nodeCategory === 'REPOSITORY' ? 'repository' : 'dependency',
        data: {
          ...n,
          id: strId,
          isDimmed
        },
        position: { x: 0, y: 0 }
      };
    });

    const flowEdges = uniqueFilteredEdges.map((e, idx) => {
      const src = String(e.source);
      const tgt = String(e.target);
      const isHighlighted = selectedNodeId && (src === selectedNodeId || tgt === selectedNodeId);
      const isDimmed = selectedNodeId && !isHighlighted;
      const isNpm = (e.packageType || '').toUpperCase() === 'NPM';
      const color = isNpm ? '#64836B' : '#71869B';

      return {
        id: e.id || `e-${src}-${tgt}-${idx}`,
        source: src,
        target: tgt,
        animated: isHighlighted || e.isDev,
        style: {
          stroke: isHighlighted ? '#C09A62' : isDimmed ? '#D9CFC7' : color,
          strokeWidth: isHighlighted ? 2.5 : 1.5,
          opacity: isDimmed ? 0.2 : 0.85,
          strokeDasharray: e.isDev ? '4,4' : undefined
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: isHighlighted ? 18 : 14,
          height: isHighlighted ? 18 : 14,
          color: isHighlighted ? '#C09A62' : isDimmed ? '#D9CFC7' : color
        },
        data: {
          ...e,
          source: src,
          target: tgt
        }
      };
    });

    // Run selected layout
    const runLayout = async () => {
      let layoutedNodes = flowNodes;
      if (layoutMode === 'bipartite-grid') {
        layoutedNodes = layoutEngine.applyBipartiteLayout(flowNodes, flowEdges);
      } else if (layoutMode === 'elk-right') {
        layoutedNodes = await layoutEngine.applyElkLayout(flowNodes, flowEdges, {
          direction: 'RIGHT',
          spacing: 35,
          layerSpacing: 220
        });
      } else if (layoutMode === 'elk-down') {
        layoutedNodes = await layoutEngine.applyElkLayout(flowNodes, flowEdges, {
          direction: 'DOWN',
          spacing: 35,
          layerSpacing: 120
        });
      } else if (layoutMode === 'force') {
        layoutedNodes = layoutEngine.applyForceLayout(flowNodes, flowEdges, {
          linkDistance: 130,
          charge: -320
        });
      } else if (layoutMode === 'ecosystem-cluster') {
        layoutedNodes = layoutEngine.applyClusteredLayout(flowNodes, flowEdges, {
          clusterField: 'ecosystem'
        });
      }

      setNodes(layoutedNodes);
      setEdges(flowEdges);
    };

    runLayout();
  }, [
    bipartiteData,
    layoutMode,
    searchDep,
    searchRepo,
    ecosystemFilter,
    divergenceFilter,
    minRepoUsage,
    selectedItem,
    setNodes,
    setEdges
  ]);

  const onNodeClick = (_, node) => setSelectedItem(node);
  const onEdgeClick = (_, edge) => setSelectedItem(edge);
  const onPaneClick = () => setSelectedItem(null);

  // Compute summary stats
  const totalRepos = bipartiteData?.totalRepositories ?? (bipartiteData?.nodes?.filter(n => n.nodeCategory === 'REPOSITORY')?.length || 0);
  const totalDeps = bipartiteData?.totalDependencies ?? (bipartiteData?.nodes?.filter(n => n.nodeCategory === 'DEPENDENCY')?.length || 0);
  const totalEdges = edges.length;
  const divergentCount = bipartiteData?.nodes?.filter(n => n.nodeCategory === 'DEPENDENCY' && n.isDivergent)?.length || 0;

  return (
    <div className="graph-workspace">
      {/* Top Toolbar */}
      <div className="graph-toolbar">
        <div className="graph-toolbar-group">
          <div className="graph-title-badge">
            <BookOpen size={16} />
            <span>Dependency Ecosystem</span>
          </div>

          {/* Layout Selector */}
          <select
            className="graph-select"
            value={layoutMode}
            onChange={(e) => setLayoutMode(e.target.value)}
            title="Switch graph layout algorithm"
          >
            <option value="bipartite-grid">Multi-Column Grid (Bipartite)</option>
            <option value="elk-right">Hierarchical (Left-to-Right)</option>
            <option value="elk-down">Hierarchical (Top-to-Bottom)</option>
            <option value="force">Force-Directed Network</option>
            <option value="ecosystem-cluster">Clustered by Ecosystem</option>
          </select>

          {/* Search Dependency */}
          <input
            type="text"
            className="graph-input"
            placeholder="Filter libraries..."
            value={searchDep}
            onChange={(e) => setSearchDep(e.target.value)}
            style={{ width: 170 }}
          />

          {/* Search Repository */}
          <input
            type="text"
            className="graph-input"
            placeholder="Filter repositories..."
            value={searchRepo}
            onChange={(e) => setSearchRepo(e.target.value)}
            style={{ width: 150 }}
          />

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

          {/* Divergence Filter */}
          <select
            className="graph-select"
            value={divergenceFilter}
            onChange={(e) => setDivergenceFilter(e.target.value)}
          >
            <option value="ALL">All Versions</option>
            <option value="DIVERGENT">Divergent Versions Only</option>
            <option value="CONSISTENT">Consistent Versions Only</option>
          </select>

          {/* Min Repo Usage Slider */}
          <div className="graph-toolbar-group" title="Filter by minimum repository usage" style={{ gap: 4 }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Min Repos:</span>
            <input
              type="range"
              min="1"
              max="5"
              value={minRepoUsage}
              onChange={(e) => setMinRepoUsage(Number(e.target.value))}
              style={{ width: 60, cursor: 'pointer' }}
            />
            <span style={{ fontSize: '11px', fontWeight: 600 }}>{minRepoUsage}</span>
          </div>
        </div>

        <div className="graph-toolbar-group">
          <button
            className="graph-btn"
            onClick={loadData}
            title="Refresh Dependency Graph"
          >
            <RefreshCw size={13} className={loading ? 'spin-icon' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Sub-Header Metadata Bar */}
      <div className="graph-sub-bar">
        <div className="graph-meta-pills">
          <span className="meta-pill brand">
            <Layers size={12} /> {totalRepos} Repositories
          </span>
          <span className="meta-pill">
            <BookOpen size={12} /> {totalDeps} Unique Dependencies
          </span>
          <span className="meta-pill">
            <Zap size={12} /> {totalEdges} Connections
          </span>
          {divergentCount > 0 && (
            <span className="meta-pill warning" title="Libraries with multiple conflicting versions declared">
              <AlertTriangle size={12} /> {divergentCount} Divergent Libraries
            </span>
          )}
        </div>

        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
          Showing {nodes.length} nodes and {edges.length} edges
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="graph-canvas-wrapper">
        {loading ? (
          <GraphLoading message="Fetching bipartite dependency ecosystem & computing layout..." />
        ) : error ? (
          <GraphErrorState error={error} onRetry={loadData} />
        ) : nodes.length === 0 ? (
          <GraphEmptyState
            title="No matching dependencies found"
            description="Adjust your search or version divergence filters to reveal declared dependency relationships."
            actionLabel="Reset Filters"
            onAction={() => {
              setSearchDep('');
              setSearchRepo('');
              setEcosystemFilter('ALL');
              setDivergenceFilter('ALL');
              setMinRepoUsage(1);
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
              minZoom={0.1}
              maxZoom={2.5}
            >
              <Background color="#D9CFC7" gap={20} size={1} />
              <Controls showInteractive={false} />
              <MiniMap
                nodeColor={(node) => (node.type === 'repository' ? '#8D916B' : node.data?.isDivergent ? '#B58A4A' : '#71869B')}
                maskColor="rgba(0, 0, 0, 0.05)"
              />
            </ReactFlow>

            <GraphLegend mode="ecosystem" />

            <GraphInspector
              selectedItem={selectedItem}
              itemType={selectedItem?.source ? 'edge' : 'node'}
              mode="ecosystem"
              onClose={() => setSelectedItem(null)}
              onNavigateToImpact={onNavigateToImpact}
              onNavigateToExplorer={onNavigateToExplorer}
              onNavigateToArchitecture={onNavigateToArchitecture}
            />
          </>
        )}
      </div>
    </div>
  );
};
