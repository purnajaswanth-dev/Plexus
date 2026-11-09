import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import {
  Layers,
  RefreshCw,
  ExternalLink,
  Search,
  Filter,
  Maximize2,
  GitCommit,
  Clock,
  Box
} from 'lucide-react';
import { graphApi } from '../../api/graphApi';
import { layoutEngine } from '../../layout/layoutEngine';
import { ArchitectureNode } from './ArchitectureNode';
import { GraphInspector } from '../../shared/GraphInspector';
import { GraphLegend } from '../../shared/GraphLegend';
import { GraphLoading, GraphEmptyState, GraphErrorState } from '../../shared/GraphStates';

const nodeTypes = {
  architecture: ArchitectureNode
};

export const ArchitecturePage = ({ initialRepoId, onNavigateToArchitecture }) => {
  const [repositories, setRepositories] = useState([]);
  const [selectedRepoId, setSelectedRepoId] = useState(initialRepoId || null);
  const [selectedRepo, setSelectedRepo] = useState(null);

  const [archData, setArchData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reindexing, setReindexing] = useState(false);
  const [error, setError] = useState(null);

  const [level, setLevel] = useState(3);
  const [layoutMode, setLayoutMode] = useState('elk-down'); // 'elk-down', 'elk-right', 'force', 'radial', 'tree'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [collapsedNodes, setCollapsedNodes] = useState(new Set());

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Load repositories list on mount
  useEffect(() => {
    graphApi
      .fetchRepositories()
      .then((repos) => {
        setRepositories(repos);
        if (!selectedRepoId && repos.length > 0) {
          const firstIndexed = repos.find(r => r.indexStatus === 'INDEXED') || repos[0];
          setSelectedRepoId(firstIndexed.id);
          setSelectedRepo(firstIndexed);
        } else if (selectedRepoId) {
          const match = repos.find(r => String(r.id) === String(selectedRepoId));
          if (match) setSelectedRepo(match);
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  // Sync initialRepoId if prop updates from parent
  useEffect(() => {
    if (initialRepoId && String(initialRepoId) !== String(selectedRepoId)) {
      setSelectedRepoId(initialRepoId);
      const match = repositories.find(r => String(r.id) === String(initialRepoId));
      if (match) setSelectedRepo(match);
    }
  }, [initialRepoId, repositories]);

  // Load architecture snapshot when selected repo or level changes
  const loadArchitectureData = useCallback(async (repoId, targetLevel) => {
    if (!repoId) return;
    setLoading(true);
    setError(null);
    setSelectedNode(null);

    try {
      const data = await graphApi.fetchArchitecture(repoId, targetLevel);
      setArchData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedRepoId) {
      loadArchitectureData(selectedRepoId, level);
    }
  }, [selectedRepoId, level, loadArchitectureData]);

  // Handle Architecture Re-indexing
  const handleReindex = async () => {
    if (!selectedRepoId) return;
    setReindexing(true);
    try {
      await graphApi.reindexArchitecture(selectedRepoId);
      await loadArchitectureData(selectedRepoId, level);
    } catch (err) {
      alert(`Re-indexing failed: ${err.message}`);
    } finally {
      setReindexing(false);
    }
  };

  // Toggle child expansion
  const toggleExpand = useCallback((nodeKey) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeKey)) {
        next.delete(nodeKey);
      } else {
        next.add(nodeKey);
      }
      return next;
    });
  }, []);

  // Transform backend nodes & edges into React Flow format and run layout
  useEffect(() => {
    if (!archData || !archData.nodes) {
      setNodes([]);
      setEdges([]);
      return;
    }

    let rawNodes = archData.nodes || [];
    let rawEdges = archData.edges || [];

    // Filter by search query if any
    const query = searchQuery.toLowerCase().trim();
    const matchingNodeKeys = new Set();
    if (query) {
      rawNodes.forEach(n => {
        if (
          (n.name && n.name.toLowerCase().includes(query)) ||
          (n.nodeType && n.nodeType.toLowerCase().includes(query)) ||
          (n.packageOrModule && n.packageOrModule.toLowerCase().includes(query)) ||
          (n.filePath && n.filePath.toLowerCase().includes(query))
        ) {
          matchingNodeKeys.add(n.nodeKey);
        }
      });
    }

    // Build children mapping for expand/collapse
    const childMap = new Map();
    rawEdges.forEach(e => {
      if (e.relationshipType === 'CONTAINS') {
        const src = e.sourceNodeKey || e.source;
        const tgt = e.targetNodeKey || e.target;
        if (!childMap.has(src)) childMap.set(src, []);
        childMap.get(src).push(tgt);
      }
    });

    // Check visibility based on collapsed parent nodes
    const hiddenNodeKeys = new Set();
    collapsedNodes.forEach(parentKey => {
      const children = childMap.get(parentKey) || [];
      children.forEach(c => hiddenNodeKeys.add(c));
    });

    const visibleRawNodes = rawNodes.filter(n => !hiddenNodeKeys.has(n.nodeKey));
    const visibleNodeKeySet = new Set(visibleRawNodes.map(n => n.nodeKey));

    const flowNodes = visibleRawNodes.map(n => {
      const children = childMap.get(n.nodeKey) || [];
      const isExpanded = !collapsedNodes.has(n.nodeKey);
      const isMatch = query ? matchingNodeKeys.has(n.nodeKey) : true;

      return {
        id: n.nodeKey,
        type: 'architecture',
        data: {
          ...n,
          childCount: children.length,
          isExpanded,
          onToggleExpand: children.length > 0 ? toggleExpand : null,
          isMatch
        },
        position: { x: 0, y: 0 }
      };
    });

    const flowEdges = rawEdges
      .filter(e => {
        const src = e.sourceNodeKey || (typeof e.source === 'object' ? e.source.nodeKey : e.source);
        const tgt = e.targetNodeKey || (typeof e.target === 'object' ? e.target.nodeKey : e.target);
        return visibleNodeKeySet.has(src) && visibleNodeKeySet.has(tgt);
      })
      .map(e => {
        const src = e.sourceNodeKey || (typeof e.source === 'object' ? e.source.nodeKey : e.source);
        const tgt = e.targetNodeKey || (typeof e.target === 'object' ? e.target.nodeKey : e.target);
        const rel = e.relationshipType || 'CONTAINS';

        return {
          id: `e-${e.id || `${src}-${tgt}`}`,
          source: src,
          target: tgt,
          animated: rel === 'CALLS' || rel === 'EXPOSES',
          style: {
            stroke: rel === 'PERSISTS_TO' ? '#8D916B' : rel === 'EXPOSES' ? '#587C78' : rel === 'CALLS' ? '#71869B' : '#81776F',
            strokeWidth: 1.5,
            strokeDasharray: rel === 'IMPORTS' ? '4,4' : undefined
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 16,
            height: 16,
            color: rel === 'PERSISTS_TO' ? '#8D916B' : rel === 'EXPOSES' ? '#587C78' : '#81776F'
          },
          data: e
        };
      });

    // Execute Selected Layout
    const runLayout = async () => {
      let layoutedNodes = flowNodes;
      if (layoutMode === 'elk-down') {
        layoutedNodes = await layoutEngine.applyElkLayout(flowNodes, flowEdges, { direction: 'DOWN' });
      } else if (layoutMode === 'elk-right') {
        layoutedNodes = await layoutEngine.applyElkLayout(flowNodes, flowEdges, { direction: 'RIGHT' });
      } else if (layoutMode === 'force') {
        layoutedNodes = layoutEngine.applyForceLayout(flowNodes, flowEdges);
      } else if (layoutMode === 'radial') {
        layoutedNodes = layoutEngine.applyRadialLayout(flowNodes, flowEdges);
      } else if (layoutMode === 'tree') {
        layoutedNodes = await layoutEngine.applyCompactTreeLayout(flowNodes, flowEdges);
      }

      setNodes(layoutedNodes);
      setEdges(flowEdges);
    };

    runLayout();
  }, [archData, layoutMode, searchQuery, collapsedNodes, toggleExpand, setNodes, setEdges]);

  const onNodeClick = (_, node) => {
    setSelectedNode(node);
  };

  const onEdgeClick = (_, edge) => {
    setSelectedNode(edge);
  };

  const handleRepoChange = (e) => {
    const id = e.target.value;
    setSelectedRepoId(id);
    const match = repositories.find(r => String(r.id) === String(id));
    setSelectedRepo(match);
  };

  return (
    <div className="graph-workspace">
      {/* Top Toolbar */}
      <div className="graph-toolbar">
        <div className="graph-toolbar-group">
          <div className="graph-title-badge">
            <Layers size={16} />
            <span>Repository Architecture</span>
          </div>

          {/* Repository Selector */}
          <select
            className="graph-select"
            value={selectedRepoId || ''}
            onChange={handleRepoChange}
            style={{ fontWeight: 600, maxWidth: 220 }}
          >
            {repositories.map(r => (
              <option key={r.id} value={r.id}>
                {r.repoName} ({r.dependencyFileType || 'REPO'})
              </option>
            ))}
          </select>

          {/* Level Tabs */}
          <div style={{ display: 'flex', gap: 2, background: 'var(--bg-base, #f1f5f9)', padding: 2, borderRadius: 6 }}>
            <button
              className={`graph-btn ${level === 1 ? 'active' : ''}`}
              style={{ height: 28, fontSize: '11px', padding: '0 8px' }}
              onClick={() => setLevel(1)}
              title="High-level package and module architecture"
            >
              L1: High-Level
            </button>
            <button
              className={`graph-btn ${level === 2 ? 'active' : ''}`}
              style={{ height: 28, fontSize: '11px', padding: '0 8px' }}
              onClick={() => setLevel(2)}
              title="Component architecture (Services, Controllers, Entities)"
            >
              L2: Components
            </button>
            <button
              className={`graph-btn ${level === 3 ? 'active' : ''}`}
              style={{ height: 28, fontSize: '11px', padding: '0 8px' }}
              onClick={() => setLevel(3)}
              title="Detailed source relationships and endpoints"
            >
              L3: Source Detail
            </button>
          </div>

          {/* Layout Selector */}
          <select
            className="graph-select"
            value={layoutMode}
            onChange={(e) => setLayoutMode(e.target.value)}
            title="Automatic graph layout calculation"
          >
            <option value="elk-down">Hierarchical (Top-to-Bottom)</option>
            <option value="elk-right">Hierarchical (Left-to-Right)</option>
            <option value="force">Force-Directed</option>
            <option value="radial">Radial Concentric</option>
            <option value="tree">Compact Tree</option>
          </select>
        </div>

        <div className="graph-toolbar-group">
          {/* Component Search */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="graph-input"
              placeholder="Search components..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: 160 }}
            />
          </div>

          {/* Re-index Action */}
          <button
            className="graph-btn"
            onClick={handleReindex}
            disabled={reindexing}
            title="Re-run static AST code analysis for this repository"
          >
            <RefreshCw size={13} className={reindexing ? 'spin-icon' : ''} />
            <span>{reindexing ? 'Analyzing AST...' : 'Re-index'}</span>
          </button>
        </div>
      </div>

      {/* Sub-Header Metadata Bar */}
      {selectedRepo && archData && (
        <div className="graph-sub-bar">
          <div className="graph-meta-pills">
            <span className="meta-pill brand">
              <Box size={12} /> {selectedRepo.dependencyFileType || 'GENERIC'}
            </span>
            <span className={`meta-pill ${archData.status === 'ANALYZED' ? 'success' : 'warning'}`}>
              Status: {archData.status}
            </span>
            {archData.commitSha && (
              <span className="meta-pill" title="Git Commit SHA analyzed">
                <GitCommit size={12} /> {archData.commitSha.substring(0, 8)}
              </span>
            )}
            <span className="meta-pill">
              Components: {archData.totalNodes ?? archData.totalComponents ?? nodes.length}
            </span>
            <span className="meta-pill">
              Relationships: {archData.totalEdges ?? archData.totalRelationships ?? edges.length}
            </span>
            {archData.analyzedAt && (
              <span className="meta-pill" title="Last AST analysis timestamp">
                <Clock size={12} /> {new Date(archData.analyzedAt).toLocaleTimeString()}
              </span>
            )}
          </div>

          {selectedRepo.repoUrl && (
            <a
              href={selectedRepo.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inspector-link"
              style={{ fontSize: '11.5px' }}
            >
              {selectedRepo.repoName} <ExternalLink size={12} />
            </a>
          )}
        </div>
      )}

      {/* Main Canvas Area */}
      <div className="graph-canvas-wrapper">
        {loading ? (
          <GraphLoading message="Fetching AST architecture graph & computing layouts..." />
        ) : error ? (
          <GraphErrorState error={error} onRetry={() => loadArchitectureData(selectedRepoId, level)} />
        ) : nodes.length === 0 ? (
          <GraphEmptyState
            title="Architecture not yet analyzed"
            description="Trigger static code analysis to construct the navigable architecture graph for this repository."
            actionLabel="Analyze Architecture Now"
            onAction={handleReindex}
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
              onPaneClick={() => setSelectedNode(null)}
              nodeTypes={nodeTypes}
              fitView
              minZoom={0.15}
              maxZoom={3}
            >
              <Background color="#D9CFC7" gap={18} size={1} />
              <Controls showInteractive={false} />
              <MiniMap
                nodeColor={(node) => {
                  const t = (node.data?.nodeType || '').toUpperCase();
                  if (t === 'REPOSITORY') return '#8D916B';
                  if (t === 'CONTROLLER') return '#587C78';
                  if (t === 'SERVICE') return '#71869B';
                  if (t === 'ENTITY') return '#9EA37E';
                  if (t === 'API_ENDPOINT') return '#587C78';
                  return '#81776F';
                }}
                nodeStrokeWidth={2}
                maskColor="rgba(0, 0, 0, 0.05)"
              />
            </ReactFlow>

            <GraphLegend mode="architecture" />

            <GraphInspector
              selectedItem={selectedNode}
              itemType={selectedNode?.source ? 'edge' : 'node'}
              mode="architecture"
              repository={selectedRepo}
              onClose={() => setSelectedNode(null)}
            />
          </>
        )}
      </div>
    </div>
  );
};

