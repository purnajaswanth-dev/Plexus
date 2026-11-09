import ELK from 'elkjs/lib/elk.bundled.js';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY
} from 'd3-force';

const elk = new ELK();

/**
 * High-performance graph layout engine supporting ELK, D3 Force, Radial, and Circular models.
 */
export const layoutEngine = {
  /**
   * Dedicated Multi-Column Bipartite Grid Layout for Dependency Ecosystem
   * Places repositories cleanly on the left and dependencies in balanced columns on the right.
   */
  applyBipartiteLayout(nodes, edges, options = {}) {
    const repos = nodes.filter(n => n.type === 'repository' || n.data?.nodeCategory === 'REPOSITORY');
    const deps = nodes.filter(n => n.type === 'dependency' || n.data?.nodeCategory === 'DEPENDENCY');

    const posMap = new Map();

    // 1. Position Repositories vertically on the left
    const repoSpacing = options.repoSpacing || 95;
    const startY = 40;
    const repoX = 50;

    repos.forEach((repo, idx) => {
      posMap.set(repo.id, {
        x: repoX,
        y: startY + idx * repoSpacing
      });
    });

    // 2. Position Dependencies in clean vertical columns
    const columns = options.columns || 3;
    const colSpacing = options.colSpacing || 270;
    const rowSpacing = options.rowSpacing || 78;
    const depStartX = 420;

    deps.forEach((dep, idx) => {
      const col = idx % columns;
      const row = Math.floor(idx / columns);
      posMap.set(dep.id, {
        x: depStartX + col * colSpacing,
        y: startY + row * rowSpacing
      });
    });

    return nodes.map(n => ({
      ...n,
      position: posMap.get(n.id) || { x: 0, y: 0 },
      sourcePosition: n.type === 'repository' ? 'right' : 'left',
      targetPosition: n.type === 'repository' ? 'left' : 'left'
    }));
  },

  /**
   * ELK Hierarchical Layout (Top-to-Bottom or Left-to-Right)
   */
  async applyElkLayout(nodes, edges, options = {}) {
    const direction = options.direction || 'DOWN'; // 'DOWN' or 'RIGHT'
    const spacing = options.spacing || 40;
    const layerSpacing = options.layerSpacing || 75;

    const elkNodes = nodes.map(node => {
      const w = node.width || (node.type === 'repository' ? 220 : node.type === 'dependency' ? 200 : 190);
      const h = node.height || 64;
      return {
        id: node.id,
        width: w,
        height: h
      };
    });

    const elkEdges = edges.map(edge => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target]
    }));

    const elkGraph = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': direction,
        'elk.spacing.nodeNode': String(spacing),
        'elk.layered.spacing.nodeNodeBetweenLayers': String(layerSpacing),
        'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
        'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
        'elk.edgeRouting': options.edgeRouting || 'SPLINES'
      },
      children: elkNodes,
      edges: elkEdges
    };

    try {
      const layoutResult = await elk.layout(elkGraph);
      const positionMap = new Map();
      layoutResult.children.forEach(child => {
        positionMap.set(child.id, { x: child.x, y: child.y });
      });

      return nodes.map(node => {
        const pos = positionMap.get(node.id) || { x: 0, y: 0 };
        return {
          ...node,
          position: pos,
          targetPosition: direction === 'RIGHT' ? 'left' : 'top',
          sourcePosition: direction === 'RIGHT' ? 'right' : 'bottom'
        };
      });
    } catch (err) {
      console.warn('ELK layout failed, falling back to force layout:', err);
      return this.applyForceLayout(nodes, edges);
    }
  },

  /**
   * ELK Compact Tree Layout
   */
  async applyCompactTreeLayout(nodes, edges) {
    const elkNodes = nodes.map(node => ({
      id: node.id,
      width: node.width || 180,
      height: node.height || 60
    }));

    const elkEdges = edges.map(edge => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target]
    }));

    const elkGraph = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'mrtree',
        'elk.direction': 'DOWN',
        'elk.spacing.nodeNode': '30',
        'elk.mrtree.spacing.nodeNodeBetweenLayers': '60'
      },
      children: elkNodes,
      edges: elkEdges
    };

    try {
      const layoutResult = await elk.layout(elkGraph);
      const positionMap = new Map();
      layoutResult.children.forEach(child => {
        positionMap.set(child.id, { x: child.x, y: child.y });
      });

      return nodes.map(node => {
        const pos = positionMap.get(node.id) || { x: 0, y: 0 };
        return {
          ...node,
          position: pos,
          targetPosition: 'top',
          sourcePosition: 'bottom'
        };
      });
    } catch {
      return this.applyElkLayout(nodes, edges, { direction: 'DOWN' });
    }
  },

  /**
   * D3 Force-Directed Layout
   */
  applyForceLayout(nodes, edges, options = {}) {
    const width = options.width || 1000;
    const height = options.height || 700;
    const centerX = width / 2;
    const centerY = height / 2;

    const simulationNodes = nodes.map(n => ({
      id: n.id,
      x: n.position?.x ?? centerX + (Math.random() - 0.5) * 200,
      y: n.position?.y ?? centerY + (Math.random() - 0.5) * 200,
      radius: (n.width || 180) / 2 + 15,
      ...n
    }));

    const simulationLinks = edges
      .map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        weight: e.data?.weight || 1,
        similarity: e.data?.similarityPercentage || 10
      }))
      .filter(l => simulationNodes.some(n => n.id === l.source) && simulationNodes.some(n => n.id === l.target));

    const sim = forceSimulation(simulationNodes)
      .force(
        'link',
        forceLink(simulationLinks)
          .id(d => d.id)
          .distance(d => {
            if (options.similarityAware && d.similarity) {
              // High similarity brings nodes closer (from 80px to 250px)
              return Math.max(70, 260 - d.similarity * 1.8);
            }
            return options.linkDistance || 150;
          })
          .strength(0.7)
      )
      .force('charge', forceManyBody().strength(options.charge || -450))
      .force('center', forceCenter(centerX, centerY))
      .force('collision', forceCollide().radius(d => d.radius || 45))
      .stop();

    // Execute ticks synchronously for deterministic static positions
    const ticks = options.ticks || 180;
    for (let i = 0; i < ticks; ++i) {
      sim.tick();
    }

    const posMap = new Map();
    simulationNodes.forEach(sn => {
      posMap.set(sn.id, { x: Math.round(sn.x), y: Math.round(sn.y) });
    });

    return nodes.map(node => ({
      ...node,
      position: posMap.get(node.id) || { x: centerX, y: centerY },
      targetPosition: 'top',
      sourcePosition: 'bottom'
    }));
  },

  /**
   * Radial Concentric Layout
   */
  applyRadialLayout(nodes, edges, options = {}) {
    const width = options.width || 1000;
    const height = options.height || 700;
    const cx = width / 2;
    const cy = height / 2;

    // Group nodes by level (1 = root/high, 2 = components, 3 = source detail)
    const levelMap = new Map();
    nodes.forEach(n => {
      const lvl = n.data?.level || (n.type === 'repository' ? 0 : 2);
      if (!levelMap.has(lvl)) levelMap.set(lvl, []);
      levelMap.get(lvl).push(n);
    });

    const posMap = new Map();
    const sortedLevels = Array.from(levelMap.keys()).sort((a, b) => a - b);

    sortedLevels.forEach((lvl, levelIdx) => {
      const levelNodes = levelMap.get(lvl);
      if (lvl === 0 || (sortedLevels[0] === lvl && levelNodes.length === 1)) {
        // Root node at dead center
        posMap.set(levelNodes[0].id, { x: cx, y: cy });
        return;
      }

      const radius = 160 + levelIdx * 150;
      const total = levelNodes.length;
      levelNodes.forEach((n, idx) => {
        const angle = (2 * Math.PI * idx) / total;
        const x = Math.round(cx + radius * Math.cos(angle));
        const y = Math.round(cy + radius * Math.sin(angle));
        posMap.set(n.id, { x, y });
      });
    });

    return nodes.map(node => ({
      ...node,
      position: posMap.get(node.id) || { x: cx, y: cy }
    }));
  },

  /**
   * Circular Layout
   */
  applyCircularLayout(nodes, options = {}) {
    const width = options.width || 1000;
    const height = options.height || 700;
    const cx = width / 2;
    const cy = height / 2;
    const total = nodes.length;

    if (total === 0) return nodes;
    if (total === 1) {
      return [{ ...nodes[0], position: { x: cx, y: cy } }];
    }

    const radius = Math.max(220, Math.min(500, total * 48));
    const sorted = [...nodes].sort((a, b) => (b.data?.healthScore || 0) - (a.data?.healthScore || 0));

    return sorted.map((node, i) => {
      const angle = (2 * Math.PI * i) / total - Math.PI / 2;
      return {
        ...node,
        position: {
          x: Math.round(cx + radius * Math.cos(angle)),
          y: Math.round(cy + radius * Math.sin(angle))
        }
      };
    });
  },

  /**
   * Clustered Layout (e.g. by Ecosystem or Similarity Clusters)
   */
  applyClusteredLayout(nodes, edges, options = {}) {
    const width = options.width || 1000;
    const height = options.height || 700;
    const clusterField = options.clusterField || 'group';

    // Group nodes by cluster
    const clusters = new Map();
    nodes.forEach(n => {
      const key = (n.data && n.data[clusterField]) || 'OTHER';
      if (!clusters.has(key)) clusters.set(key, []);
      clusters.get(key).push(n);
    });

    const clusterKeys = Array.from(clusters.keys());
    const clusterCenters = new Map();
    const clusterRadius = 280;

    clusterKeys.forEach((key, idx) => {
      if (clusterKeys.length === 1) {
        clusterCenters.set(key, { x: width / 2, y: height / 2 });
      } else {
        const angle = (2 * Math.PI * idx) / clusterKeys.length;
        clusterCenters.set(key, {
          x: width / 2 + clusterRadius * Math.cos(angle),
          y: height / 2 + clusterRadius * Math.sin(angle)
        });
      }
    });

    const simulationNodes = nodes.map(n => {
      const key = (n.data && n.data[clusterField]) || 'OTHER';
      const center = clusterCenters.get(key) || { x: width / 2, y: height / 2 };
      return {
        id: n.id,
        clusterKey: key,
        targetX: center.x,
        targetY: center.y,
        x: center.x + (Math.random() - 0.5) * 80,
        y: center.y + (Math.random() - 0.5) * 80,
        radius: 40,
        ...n
      };
    });

    const sim = forceSimulation(simulationNodes)
      .force('x', forceX(d => d.targetX).strength(0.6))
      .force('y', forceY(d => d.targetY).strength(0.6))
      .force('collide', forceCollide().radius(45))
      .force('charge', forceManyBody().strength(-200))
      .stop();

    for (let i = 0; i < 150; ++i) sim.tick();

    const posMap = new Map();
    simulationNodes.forEach(sn => {
      posMap.set(sn.id, { x: Math.round(sn.x), y: Math.round(sn.y) });
    });

    return nodes.map(node => ({
      ...node,
      position: posMap.get(node.id) || { x: width / 2, y: height / 2 }
    }));
  }
};

