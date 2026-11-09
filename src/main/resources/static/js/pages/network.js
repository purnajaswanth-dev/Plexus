/**
 * Page 5: Dependency Network Controller (D3.js v7)
 * Implements THREE distinct graph modes:
 * 1. MODE 1 (Default): Repository Relationship Graph - Original restored experience
 *    (Repositories connected to each other based on shared dependencies)
 * 2. MODE 2: Dependency Ecosystem Graph (Bipartite Graph: Repositories <-> Declared Libraries)
 * 3. MODE 3: Coupling & Similarity Graph (Repositories connected by Jaccard similarity %)
 */
const NetworkPage = {
    simulation: null,
    svg: null,
    g: null,
    zoom: null,
    currentMode: 'relationship', // 'relationship' | 'bipartite' | 'similarity'
    relationshipData: null,
    bipartiteData: null,
    activeFilter: 'ALL',
    minWeightThreshold: 1,
    selectedNode: null,
    selectedEdge: null,

    async render(container) {
        container.innerHTML = `
            <div class="page-header">
                <div class="page-title-group">
                    <h1>Dependency Network</h1>
                    <p>Cross-repository dependency topologies, shared library relationships, and ecosystem divergence.</p>
                </div>
                <div class="page-header-actions">
                    <button class="btn btn-secondary btn-sm" id="network-refresh-btn">
                        ${Icons.refresh(14)} Refresh Network
                    </button>
                </div>
            </div>

            <!-- Network Canvas Card -->
            <div class="network-container">
                <div class="network-toolbar">
                    <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                        <!-- Primary 3-Mode Switcher -->
                        <div class="view-switch-group">
                            <button class="view-switch-btn active" id="btn-mode-relationship">
                                Repository Relationships
                            </button>
                            <button class="view-switch-btn" id="btn-mode-bipartite">
                                Dependency Ecosystem (Bipartite)
                            </button>
                            <button class="view-switch-btn" id="btn-mode-similarity">
                                Coupling & Similarity
                            </button>
                        </div>

                        <!-- Search -->
                        <div class="search-input-wrap" style="width: 210px;">
                            <span class="search-input-icon">${Icons.search(14)}</span>
                            <input type="text" class="form-input" id="graph-search-input" placeholder="Find repository or package...">
                        </div>

                        <!-- Ecosystem Filter -->
                        <select class="form-select filter-select" id="graph-eco-filter">
                            <option value="ALL">All Ecosystems</option>
                            <option value="MAVEN">Maven</option>
                            <option value="NPM">npm</option>
                        </select>

                        <!-- Min Shared Slider (Relationship & Similarity modes) -->
                        <div id="graph-weight-container" style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-secondary);">
                            <span>Min Shared: <strong id="weight-slider-val">1</strong></span>
                            <input type="range" id="graph-weight-slider" min="1" max="10" value="1" style="width: 75px; accent-color: var(--brand-500); cursor: pointer;">
                        </div>
                    </div>

                    <div class="network-controls">
                        <button class="btn btn-secondary btn-icon btn-sm" id="graph-zoom-in" title="Zoom In">
                            ${Icons.zoomIn(14)}
                        </button>
                        <button class="btn btn-secondary btn-icon btn-sm" id="graph-zoom-out" title="Zoom Out">
                            ${Icons.zoomOut(14)}
                        </button>
                        <button class="btn btn-secondary btn-icon btn-sm" id="graph-zoom-fit" title="Fit to Screen">
                            ${Icons.layers(14)}
                        </button>
                        <button class="btn btn-secondary btn-icon btn-sm" id="graph-zoom-reset" title="Reset View">
                            ${Icons.zoomReset(14)}
                        </button>
                    </div>
                </div>

                <div class="graph-canvas-wrap" id="graph-canvas-container">
                    <div class="network-tooltip" id="graph-tooltip"></div>
                    
                    <!-- Dynamic Legend -->
                    <div class="network-legend" id="network-legend-box"></div>

                    <!-- Side Inspector Drawer -->
                    <div class="network-inspector-drawer" id="network-inspector">
                        <div class="network-inspector-header">
                            <div style="font-size: 12.5px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em;" id="inspector-badge">
                                Node Details
                            </div>
                            <button class="network-inspector-close" id="btn-close-inspector" title="Close panel">
                                ${Icons.x(16)}
                            </button>
                        </div>
                        <div id="inspector-body"></div>
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
        await this.loadNetwork();
    },

    bindEvents() {
        const refreshBtn = document.getElementById('network-refresh-btn');
        if (refreshBtn) refreshBtn.onclick = () => this.loadNetwork();

        const btnRel = document.getElementById('btn-mode-relationship');
        const btnBip = document.getElementById('btn-mode-bipartite');
        const btnSim = document.getElementById('btn-mode-similarity');
        const weightContainer = document.getElementById('graph-weight-container');

        const setMode = (mode) => {
            this.currentMode = mode;
            if (btnRel) btnRel.classList.toggle('active', mode === 'relationship');
            if (btnBip) btnBip.classList.toggle('active', mode === 'bipartite');
            if (btnSim) btnSim.classList.toggle('active', mode === 'similarity');
            if (weightContainer) {
                weightContainer.style.display = mode === 'bipartite' ? 'none' : 'flex';
            }
            this.closeInspector();
            this.renderActiveGraph();
        };

        if (btnRel) btnRel.onclick = () => setMode('relationship');
        if (btnBip) btnBip.onclick = () => setMode('bipartite');
        if (btnSim) btnSim.onclick = () => setMode('similarity');

        const weightSlider = document.getElementById('graph-weight-slider');
        const weightVal = document.getElementById('weight-slider-val');
        if (weightSlider) {
            weightSlider.oninput = (e) => {
                this.minWeightThreshold = parseInt(e.target.value, 10) || 1;
                if (weightVal) weightVal.innerText = this.minWeightThreshold;
                if (this.currentMode !== 'bipartite') {
                    this.renderActiveGraph();
                }
            };
        }

        const zoomInBtn = document.getElementById('graph-zoom-in');
        if (zoomInBtn) {
            zoomInBtn.onclick = () => {
                if (this.svg && this.zoom) {
                    this.svg.transition().duration(300).call(this.zoom.scaleBy, 1.3);
                }
            };
        }

        const zoomOutBtn = document.getElementById('graph-zoom-out');
        if (zoomOutBtn) {
            zoomOutBtn.onclick = () => {
                if (this.svg && this.zoom) {
                    this.svg.transition().duration(300).call(this.zoom.scaleBy, 0.7);
                }
            };
        }

        const zoomResetBtn = document.getElementById('graph-zoom-reset');
        if (zoomResetBtn) {
            zoomResetBtn.onclick = () => {
                if (this.svg && this.zoom) {
                    this.svg.transition().duration(400).call(this.zoom.transform, d3.zoomIdentity);
                }
            };
        }

        const zoomFitBtn = document.getElementById('graph-zoom-fit');
        if (zoomFitBtn) {
            zoomFitBtn.onclick = () => this.fitToScreen();
        }

        const searchInput = document.getElementById('graph-search-input');
        if (searchInput) {
            searchInput.oninput = (e) => this.highlightNode(e.target.value.toLowerCase().trim());
        }

        const ecoFilter = document.getElementById('graph-eco-filter');
        if (ecoFilter) {
            ecoFilter.onchange = (e) => {
                this.activeFilter = e.target.value;
                this.renderActiveGraph();
            };
        }

        const closeInspectorBtn = document.getElementById('btn-close-inspector');
        if (closeInspectorBtn) {
            closeInspectorBtn.onclick = () => this.closeInspector();
        }

        window.addEventListener('resize', () => {
            if (State.currentView === 'network') {
                this.renderActiveGraph();
            }
        });
    },

    async loadNetwork() {
        try {
            const [relData, bipData] = await Promise.all([
                API.getGraphData().catch(() => null),
                API.getBipartiteGraph().catch(() => null)
            ]);
            this.relationshipData = relData;
            this.bipartiteData = bipData;
            this.renderActiveGraph();
        } catch (error) {
            Components.Toast.error(`Failed to load network data: ${error.message}`);
        }
    },

    renderActiveGraph() {
        if (this.simulation) {
            this.simulation.stop();
            this.simulation = null;
        }

        if (this.currentMode === 'bipartite') {
            this.renderBipartiteGraph(this.bipartiteData);
        } else if (this.currentMode === 'similarity') {
            this.renderSimilarityGraph(this.relationshipData);
        } else {
            this.renderRelationshipGraph(this.relationshipData);
        }
    },

    /* ==========================================================================
       MODE 1: Repository Relationship Graph (Original Restored Experience)
       ========================================================================== */
    renderRelationshipGraph(data) {
        const container = document.getElementById('graph-canvas-container');
        if (!container) return;

        d3.select('#graph-canvas-container svg').remove();
        this.updateLegend('relationship');

        if (!data || !data.nodes || data.nodes.length < 2) {
            this.renderEmptyState(container, 'Insufficient repositories indexed for relationship mapping. Index at least two repositories sharing dependencies.');
            return;
        }

        // Clean deep clone to prevent D3 mutation corruption
        let nodes = (data.nodes || []).map(d => ({ ...d }));
        let edges = (data.edges || []).map(e => ({
            ...e,
            source: typeof e.source === 'object' ? e.source.id : e.source,
            target: typeof e.target === 'object' ? e.target.id : e.target
        }));

        // Ecosystem filter
        if (this.activeFilter !== 'ALL') {
            nodes = nodes.filter(n => (n.group || '').toUpperCase() === this.activeFilter);
            const nodeIds = new Set(nodes.map(n => n.id));
            edges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
        }

        // Min weight filter
        if (this.minWeightThreshold > 1) {
            edges = edges.filter(e => (e.weight || 1) >= this.minWeightThreshold);
        }

        const width = container.clientWidth || 900;
        const height = container.clientHeight || 600;

        this.svg = d3.select('#graph-canvas-container')
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .on('click', (event) => {
                if (event.target.tagName === 'svg') this.closeInspector();
            });

        this.zoom = d3.zoom()
            .scaleExtent([0.15, 4])
            .on('zoom', (event) => {
                this.g.attr('transform', event.transform);
            });

        this.svg.call(this.zoom);
        this.g = this.svg.append('g');

        this.simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(edges).id(d => d.id).distance(180))
            .force('charge', d3.forceManyBody().strength(-450))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(40));

        // Links
        const link = this.g.append('g')
            .attr('class', 'links')
            .selectAll('line')
            .data(edges)
            .enter().append('line')
            .attr('class', 'd3-link')
            .attr('stroke', '#94a3b8')
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', d => Math.max(1.5, Math.min(8, Math.sqrt(d.weight || 1) * 2)))
            .style('cursor', 'pointer')
            .on('mouseover', (event, d) => {
                const sharedList = d.sharedDependencies ? d.sharedDependencies.slice(0, 5).join('<br>• ') : d.label;
                const moreText = (d.sharedDependencies && d.sharedDependencies.length > 5) 
                    ? `<br><em>+ ${d.sharedDependencies.length - 5} more packages</em>` : '';
                this.showTooltip(event, `
                    <div style="font-weight: 600; font-size: 12.5px; color: var(--text-primary); margin-bottom: 3px;">
                        ${escapeHtml(d.sourceName || 'Repo')} ↔ ${escapeHtml(d.targetName || 'Repo')}
                    </div>
                    <div style="font-size: 11.5px; color: var(--brand-500); font-weight: 600; margin-bottom: 4px;">
                        ${d.weight} Shared Dependencies
                    </div>
                    <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.4;">
                        • ${sharedList}${moreText}
                    </div>
                    <div style="margin-top: 6px; font-size: 10.5px; color: var(--text-muted);">Click edge to inspect all shared packages</div>
                `);
            })
            .on('mouseout', () => this.hideTooltip())
            .on('click', (event, d) => {
                event.stopPropagation();
                this.openEdgeInspector(d);
            });

        // Nodes
        const node = this.g.append('g')
            .attr('class', 'nodes')
            .selectAll('g')
            .data(nodes)
            .enter().append('g')
            .attr('class', 'd3-node-group')
            .call(this.drag(this.simulation))
            .on('click', (event, d) => {
                event.stopPropagation();
                this.openRepositoryInspector(d, edges);
            });

        // Node circle
        node.append('circle')
            .attr('class', 'd3-node')
            .attr('r', d => 12 + Math.min(14, Math.sqrt(d.dependencyCount || 0) * 1.5))
            .attr('fill', d => {
                const g = (d.group || '').toUpperCase();
                if (g === 'MAVEN') return 'var(--eco-maven-node)';
                if (g === 'NPM') return 'var(--eco-npm-node)';
                return 'var(--eco-none-node)';
            })
            .attr('stroke', 'var(--bg-surface)')
            .attr('stroke-width', 2.5)
            .on('mouseover', (event, d) => {
                this.showTooltip(event, `
                    <div style="font-weight: 600; font-size: 13px; color: var(--text-primary); margin-bottom: 4px;">
                        ${escapeHtml(d.label)}
                    </div>
                    <div style="font-size: 11.5px; color: var(--text-muted); line-height: 1.4;">
                        Ecosystem: <strong>${d.group}</strong><br>
                        Language: <strong>${d.language || 'Codebase'}</strong><br>
                        Dependencies: <strong>${d.dependencyCount || 0}</strong><br>
                        Health Score: <strong>${d.healthScore || 0}/100 (${d.healthRating || 'N/A'})</strong>
                    </div>
                    <div style="margin-top: 6px; font-size: 11px; color: var(--brand-500);">Click to inspect details & architecture</div>
                `);
            })
            .on('mouseout', () => this.hideTooltip());

        // Node label
        node.append('text')
            .attr('class', 'd3-node-label')
            .attr('dx', d => 16 + Math.min(14, Math.sqrt(d.dependencyCount || 0) * 1.5))
            .attr('dy', 4)
            .text(d => d.label);

        this.simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node
                .attr('transform', d => `translate(${d.x}, ${d.y})`);
        });
    },

    /* ==========================================================================
       MODE 2: Dependency Ecosystem Graph (Bipartite Graph)
       ========================================================================== */
    renderBipartiteGraph(data) {
        const container = document.getElementById('graph-canvas-container');
        if (!container) return;

        d3.select('#graph-canvas-container svg').remove();
        this.updateLegend('bipartite');

        if (!data || !data.nodes || data.nodes.length === 0) {
            this.renderEmptyState(container, 'No repositories or dependencies indexed. Index repositories to view the bipartite ecosystem graph.');
            return;
        }

        let nodes = (data.nodes || []).map(d => ({ ...d }));
        let edges = (data.edges || []).map(e => ({
            ...e,
            source: typeof e.source === 'object' ? e.source.id : e.source,
            target: typeof e.target === 'object' ? e.target.id : e.target
        }));

        if (this.activeFilter !== 'ALL') {
            nodes = nodes.filter(n => (n.ecosystem || '').toUpperCase() === this.activeFilter);
            const nodeIds = new Set(nodes.map(n => n.id));
            edges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
        }

        const width = container.clientWidth || 900;
        const height = container.clientHeight || 600;

        this.svg = d3.select('#graph-canvas-container')
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .on('click', (event) => {
                if (event.target.tagName === 'svg') this.closeInspector();
            });

        this.zoom = d3.zoom()
            .scaleExtent([0.15, 4])
            .on('zoom', (event) => {
                this.g.attr('transform', event.transform);
            });

        this.svg.call(this.zoom);
        this.g = this.svg.append('g');

        this.simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(edges).id(d => d.id).distance(120).strength(0.35))
            .force('charge', d3.forceManyBody().strength(d => d.nodeCategory === 'REPOSITORY' ? -350 : -140))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(d => d.nodeCategory === 'REPOSITORY' ? 45 : 22));

        // Links
        const link = this.g.append('g')
            .attr('class', 'links')
            .selectAll('line')
            .data(edges)
            .enter().append('line')
            .attr('class', 'd3-link')
            .attr('stroke', '#94a3b8')
            .attr('stroke-opacity', 0.45)
            .attr('stroke-width', 1.2)
            .on('mouseover', (event, d) => {
                const sName = typeof d.source === 'object' ? d.source.label : d.source;
                const tName = typeof d.target === 'object' ? d.target.label : d.target;
                this.showTooltip(event, `
                    <div style="font-weight: 600; font-size: 12px; color: var(--text-primary); margin-bottom: 2px;">
                        ${escapeHtml(sName)} → ${escapeHtml(tName)}
                    </div>
                    <div style="font-size: 11px; color: var(--text-secondary);">
                        Version: <strong class="version-tag">${escapeHtml(d.version || 'unspecified')}</strong><br>
                        Scope: <code>${escapeHtml(d.scope || 'compile')}</code>
                        ${d.isDev ? '<span class="badge badge-neutral" style="font-size: 9.5px; margin-left: 4px;">dev</span>' : ''}
                    </div>
                `);
            })
            .on('mouseout', () => this.hideTooltip());

        // Nodes
        const node = this.g.append('g')
            .attr('class', 'nodes')
            .selectAll('g')
            .data(nodes)
            .enter().append('g')
            .attr('class', 'd3-node-group')
            .call(this.drag(this.simulation))
            .on('click', (event, d) => {
                event.stopPropagation();
                if (d.nodeCategory === 'DEPENDENCY') {
                    this.openDependencyInspector(d, edges);
                } else {
                    this.openRepositoryInspector(d, edges);
                }
            });

        // Repositories rendered as rounded rectangles
        node.filter(d => d.nodeCategory === 'REPOSITORY')
            .append('rect')
            .attr('class', 'd3-node bipartite-repo-node')
            .attr('width', 130)
            .attr('height', 32)
            .attr('x', -65)
            .attr('y', -16)
            .on('mouseover', (event, d) => {
                this.showTooltip(event, `
                    <div style="font-weight: 600; font-size: 13px; color: var(--text-primary); margin-bottom: 4px;">
                        ${escapeHtml(d.label)}
                    </div>
                    <div style="font-size: 11.5px; color: var(--text-muted); line-height: 1.4;">
                        Ecosystem: <strong>${d.ecosystem}</strong><br>
                        Language: <strong>${d.language || 'Unknown'}</strong>
                    </div>
                    <div style="margin-top: 6px; font-size: 11px; color: var(--brand-500);">Click to inspect repository</div>
                `);
            })
            .on('mouseout', () => this.hideTooltip());

        node.filter(d => d.nodeCategory === 'REPOSITORY')
            .append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', 4)
            .attr('fill', '#ffffff')
            .attr('font-size', '11px')
            .attr('font-weight', '600')
            .attr('pointer-events', 'none')
            .text(d => {
                const name = d.label || '';
                return name.length > 16 ? name.substring(0, 15) + '…' : name;
            });

        // Dependencies rendered as circles
        node.filter(d => d.nodeCategory === 'DEPENDENCY')
            .append('circle')
            .attr('class', d => `d3-node ${d.ecosystem === 'NPM' ? 'bipartite-dep-npm' : 'bipartite-dep-maven'} ${d.isDivergent ? 'node-divergent-glow' : ''}`)
            .attr('r', d => 8 + Math.min(10, (d.repoCount || 1) * 2))
            .on('mouseover', (event, d) => {
                const versionsText = d.versions ? d.versions.join(', ') : 'none';
                this.showTooltip(event, `
                    <div style="font-weight: 600; font-size: 13px; color: var(--text-primary); margin-bottom: 4px;">
                        ${escapeHtml(d.label)}
                    </div>
                    <div style="font-size: 11.5px; color: var(--text-muted); line-height: 1.4;">
                        Ecosystem: <strong>${d.ecosystem}</strong><br>
                        Used by: <strong>${d.repoCount || 1} repositories</strong><br>
                        Versions: <strong>${escapeHtml(versionsText)}</strong><br>
                        ${d.isDivergent ? '<span class="badge badge-warning" style="margin-top: 4px;"><span class="badge-dot"></span>Divergent Versions</span>' : '<span class="badge badge-safe" style="margin-top: 4px;"><span class="badge-dot"></span>Consistent</span>'}
                    </div>
                    <div style="margin-top: 6px; font-size: 11px; color: var(--brand-500);">Click to inspect usage or analyze impact</div>
                `);
            })
            .on('mouseout', () => this.hideTooltip());

        node.filter(d => d.nodeCategory === 'DEPENDENCY')
            .append('text')
            .attr('class', 'd3-node-label')
            .attr('dx', d => 12 + Math.min(10, (d.repoCount || 1) * 2))
            .attr('dy', 4)
            .text(d => {
                const name = d.artifactId || d.label || '';
                return name.length > 20 ? name.substring(0, 19) + '…' : name;
            });

        this.simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node
                .attr('transform', d => `translate(${d.x}, ${d.y})`);
        });
    },

    /* ==========================================================================
       MODE 3: Coupling & Similarity Graph
       ========================================================================== */
    renderSimilarityGraph(data) {
        const container = document.getElementById('graph-canvas-container');
        if (!container) return;

        d3.select('#graph-canvas-container svg').remove();
        this.updateLegend('similarity');

        if (!data || !data.nodes || data.nodes.length < 2) {
            this.renderEmptyState(container, 'Insufficient repositories indexed for similarity mapping.');
            return;
        }

        let nodes = (data.nodes || []).map(d => ({ ...d }));
        let edges = (data.edges || []).map(e => ({
            ...e,
            source: typeof e.source === 'object' ? e.source.id : e.source,
            target: typeof e.target === 'object' ? e.target.id : e.target
        }));

        if (this.activeFilter !== 'ALL') {
            nodes = nodes.filter(n => (n.group || '').toUpperCase() === this.activeFilter);
            const nodeIds = new Set(nodes.map(n => n.id));
            edges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
        }

        if (this.minWeightThreshold > 1) {
            edges = edges.filter(e => (e.weight || 1) >= this.minWeightThreshold);
        }

        const width = container.clientWidth || 900;
        const height = container.clientHeight || 600;

        this.svg = d3.select('#graph-canvas-container')
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .on('click', (event) => {
                if (event.target.tagName === 'svg') this.closeInspector();
            });

        this.zoom = d3.zoom()
            .scaleExtent([0.2, 4])
            .on('zoom', (event) => {
                this.g.attr('transform', event.transform);
            });

        this.svg.call(this.zoom);
        this.g = this.svg.append('g');

        this.simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(edges).id(d => d.id).distance(200))
            .force('charge', d3.forceManyBody().strength(-400))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(40));

        // Links labeled with similarity %
        const link = this.g.append('g')
            .attr('class', 'links')
            .selectAll('line')
            .data(edges)
            .enter().append('line')
            .attr('class', 'd3-link')
            .attr('stroke', d => (d.similarityPercentage || 0) >= 40 ? 'var(--brand-500)' : '#94a3b8')
            .attr('stroke-opacity', 0.7)
            .attr('stroke-width', d => Math.max(2, Math.min(9, ((d.similarityPercentage || 10) / 100) * 10)))
            .style('cursor', 'pointer')
            .on('mouseover', (event, d) => {
                this.showTooltip(event, `
                    <div style="font-weight: 600; font-size: 13px; color: var(--text-primary); margin-bottom: 2px;">
                        ${escapeHtml(d.sourceName || 'Repo')} ↔ ${escapeHtml(d.targetName || 'Repo')}
                    </div>
                    <div style="font-size: 12px; color: var(--brand-500); font-weight: 700;">
                        ${d.similarityPercentage || 0}% Shared Stack Similarity
                    </div>
                    <div style="font-size: 11px; color: var(--text-secondary); margin-top: 3px;">
                        ${d.weight} shared out of ${d.totalUnionDependencies || d.weight} total combined libraries
                    </div>
                `);
            })
            .on('mouseout', () => this.hideTooltip())
            .on('click', (event, d) => {
                event.stopPropagation();
                this.openEdgeInspector(d);
            });

        // Nodes
        const node = this.g.append('g')
            .attr('class', 'nodes')
            .selectAll('g')
            .data(nodes)
            .enter().append('g')
            .attr('class', 'd3-node-group')
            .call(this.drag(this.simulation))
            .on('click', (event, d) => {
                event.stopPropagation();
                this.openRepositoryInspector(d, edges);
            });

        node.append('circle')
            .attr('class', 'd3-node')
            .attr('r', 18)
            .attr('fill', d => (d.group || '').toUpperCase() === 'NPM' ? 'var(--eco-npm-node)' : 'var(--eco-maven-node)')
            .attr('stroke', 'var(--bg-surface)')
            .attr('stroke-width', 2.5);

        node.append('text')
            .attr('class', 'd3-node-label')
            .attr('dx', 22)
            .attr('dy', 4)
            .text(d => d.label);

        this.simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node
                .attr('transform', d => `translate(${d.x}, ${d.y})`);
        });
    },

    /* ==========================================================================
       INSPECTORS: Edge, Repository, and Dependency
       ========================================================================== */
    openEdgeInspector(edge) {
        const inspector = document.getElementById('network-inspector');
        const badge = document.getElementById('inspector-badge');
        const body = document.getElementById('inspector-body');
        if (!inspector || !badge || !body) return;

        this.selectedEdge = edge;
        inspector.classList.add('open');
        badge.innerText = 'Shared Dependency Link';

        const sName = edge.sourceName || (typeof edge.source === 'object' ? edge.source.label : edge.source);
        const tName = edge.targetName || (typeof edge.target === 'object' ? edge.target.label : edge.target);
        const shared = edge.sharedDependencies || [];

        body.innerHTML = `
            <div style="margin-bottom: 16px;">
                <h3 style="font-size: 14.5px; font-weight: 700; color: var(--text-primary); margin: 0 0 6px 0; word-break: break-all;">
                    ${escapeHtml(sName)} ↔ ${escapeHtml(tName)}
                </h3>
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                    <span class="badge badge-neutral" style="font-weight: 600;">
                        ${edge.weight || shared.length} Shared Libraries
                    </span>
                    ${edge.similarityPercentage !== undefined ? `
                        <span class="badge badge-safe">
                            ${edge.similarityPercentage}% Stack Similarity
                        </span>
                    ` : ''}
                </div>
            </div>

            <div style="margin-bottom: 16px;">
                <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px;">
                    Shared Packages & Libraries (${shared.length})
                </div>
                <div style="max-height: 280px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;">
                    ${shared.map(dep => `
                        <div style="padding: 7px 10px; background-color: var(--bg-subtle); border-radius: var(--radius-sm); font-size: 12px; display: flex; align-items: center; justify-content: space-between;">
                            <span style="font-family: var(--font-mono); font-size: 11.5px; color: var(--text-primary);">${escapeHtml(dep)}</span>
                            <button class="btn btn-secondary btn-icon btn-sm" title="Analyze Impact" onclick="ImpactPage.prefillAndNavigate('', '${escapeHtml(dep)}', '', 'MAVEN')">
                                ${Icons.impact(11)}
                            </button>
                        </div>
                    `).join('') || '<div style="color: var(--text-muted); font-size: 12px;">No shared libraries.</div>'}
                </div>
            </div>

            <div style="margin-top: 20px; border-top: 1px solid var(--border-subtle); padding-top: 14px;">
                <button class="btn btn-secondary btn-sm" style="width: 100%; justify-content: center;" onclick="NetworkPage.closeInspector()">
                    Close Inspector
                </button>
            </div>
        `;
    },

    openRepositoryInspector(node, allEdges) {
        const inspector = document.getElementById('network-inspector');
        const badge = document.getElementById('inspector-badge');
        const body = document.getElementById('inspector-body');
        if (!inspector || !badge || !body) return;

        this.selectedNode = node;
        inspector.classList.add('open');
        badge.innerText = 'Repository Node';

        const rawId = node.rawId || node.id;
        const healthScore = node.healthScore !== undefined ? node.healthScore : null;

        // Find connected repositories
        const connectedEdges = (allEdges || []).filter(e => {
            const sId = typeof e.source === 'object' ? e.source.id : e.source;
            const tId = typeof e.target === 'object' ? e.target.id : e.target;
            return sId === node.id || tId === node.id;
        });

        body.innerHTML = `
            <div style="margin-bottom: 16px;">
                <h3 style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 0 0 6px 0;">
                    ${escapeHtml(node.label)}
                </h3>
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                    <span class="badge ${(node.ecosystem || node.group || '').toUpperCase() === 'NPM' ? 'badge-npm' : 'badge-maven'}">
                        ${escapeHtml(node.ecosystem || node.group || 'Ecosystem')}
                    </span>
                    <span class="badge badge-neutral">${escapeHtml(node.language || 'Codebase')}</span>
                </div>
            </div>

            <div class="settings-info-grid" style="grid-template-columns: 1fr 1fr; margin-bottom: 14px;">
                <div class="settings-info-box">
                    <div class="settings-info-label">Dependencies</div>
                    <div class="settings-info-value">${node.dependencyCount || 0}</div>
                </div>
                ${healthScore !== null ? `
                    <div class="settings-info-box">
                        <div class="settings-info-label">Health Score</div>
                        <div class="settings-info-value" style="color: ${healthScore >= 75 ? 'var(--status-success-dot)' : 'var(--status-danger-dot)'};">
                            ${healthScore}/100
                        </div>
                    </div>
                ` : ''}
            </div>

            ${connectedEdges.length > 0 ? `
                <div style="margin-bottom: 16px;">
                    <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px;">
                        Connected Peer Repositories (${connectedEdges.length})
                    </div>
                    <div style="max-height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;">
                        ${connectedEdges.map(e => {
                            const otherName = (typeof e.source === 'object' ? e.source.id : e.source) === node.id
                                ? (e.targetName || (typeof e.target === 'object' ? e.target.label : e.target))
                                : (e.sourceName || (typeof e.source === 'object' ? e.source.label : e.source));
                            return `
                                <div style="padding: 6px 10px; background: var(--bg-subtle); border-radius: var(--radius-sm); font-size: 12px; display: flex; justify-content: space-between; align-items: center;">
                                    <span style="font-weight: 500;">${escapeHtml(otherName)}</span>
                                    <span class="badge badge-neutral" style="font-size: 10px;">${e.weight || 1} shared</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            ` : ''}

            ${node.repoUrl ? `
                <div style="margin-bottom: 16px;">
                    <a href="${escapeHtml(node.repoUrl)}" target="_blank" rel="noopener" style="font-size: 12px; color: var(--brand-500); text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
                        ${escapeHtml(node.repoUrl)} ${Icons.externalLink(12)}
                    </a>
                </div>
            ` : ''}

            <div style="margin-top: 20px; border-top: 1px solid var(--border-subtle); padding-top: 14px; display: flex; flex-direction: column; gap: 8px;">
                <button class="btn btn-primary btn-sm" id="btn-net-inspect-arch" style="width: 100%; justify-content: center;">
                    ${Icons.layers(14)} Open Architecture Graph
                </button>
                <button class="btn btn-secondary btn-sm" id="btn-net-inspect-repo" style="width: 100%; justify-content: center;">
                    ${Icons.repos(14)} View Repository Overview
                </button>
            </div>
        `;

        const archBtn = document.getElementById('btn-net-inspect-arch');
        if (archBtn) {
            archBtn.onclick = () => {
                this.closeInspector();
                App.navigateTo('repositories');
                RepositoriesPage.openDetailDrawer(rawId, 'architecture');
            };
        }

        const repoBtn = document.getElementById('btn-net-inspect-repo');
        if (repoBtn) {
            repoBtn.onclick = () => {
                this.closeInspector();
                App.navigateTo('repositories');
                RepositoriesPage.openDetailDrawer(rawId, 'overview');
            };
        }
    },

    openDependencyInspector(node, allEdges) {
        const inspector = document.getElementById('network-inspector');
        const badge = document.getElementById('inspector-badge');
        const body = document.getElementById('inspector-body');
        if (!inspector || !badge || !body) return;

        this.selectedNode = node;
        inspector.classList.add('open');
        badge.innerText = 'Dependency Node';

        const connectedEdges = (allEdges || []).filter(e => {
            const tId = typeof e.target === 'object' ? e.target.id : e.target;
            return tId === node.id;
        });

        const primaryVersion = (node.versions && node.versions[0]) || '';

        body.innerHTML = `
            <div style="margin-bottom: 16px;">
                <h3 style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 0 0 6px 0; word-break: break-all;">
                    ${escapeHtml(node.label)}
                </h3>
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                    <span class="badge ${node.ecosystem === 'NPM' ? 'badge-npm' : 'badge-maven'}">${escapeHtml(node.ecosystem)}</span>
                    ${node.isDivergent ? `
                        <span class="badge badge-warning"><span class="badge-dot"></span>Divergent (${node.versionCount} versions)</span>
                    ` : `
                        <span class="badge badge-safe"><span class="badge-dot"></span>Consistent Version</span>
                    `}
                </div>
            </div>

            <div style="margin-bottom: 16px;">
                <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px;">
                    Consuming Repositories (${connectedEdges.length})
                </div>
                <div style="max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;">
                    ${connectedEdges.map(e => {
                        const sNode = typeof e.source === 'object' ? e.source : { label: e.source };
                        return `
                            <div style="padding: 7px 10px; background-color: var(--bg-subtle); border-radius: var(--radius-sm); font-size: 12px; display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: 500; color: var(--text-primary);">${escapeHtml(sNode.label || '')}</span>
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <span class="version-tag">${escapeHtml(e.version || 'unspecified')}</span>
                                    <span style="font-size: 10px; color: var(--text-muted); font-family: var(--font-mono);">${escapeHtml(e.scope || 'compile')}</span>
                                </div>
                            </div>
                        `;
                    }).join('') || '<div style="font-size: 12px; color: var(--text-muted);">No connected repositories.</div>'}
                </div>
            </div>

            <div style="margin-top: 20px; border-top: 1px solid var(--border-subtle); padding-top: 14px; display: flex; flex-direction: column; gap: 8px;">
                <button class="btn btn-primary btn-sm" id="btn-inspect-analyze-impact" style="width: 100%; justify-content: center;">
                    ${Icons.impact(14)} Analyze Upgrade Impact
                </button>
            </div>
        `;

        const analyzeBtn = document.getElementById('btn-inspect-analyze-impact');
        if (analyzeBtn) {
            analyzeBtn.onclick = () => {
                this.closeInspector();
                ImpactPage.prefillAndNavigate(node.groupId, node.artifactId, primaryVersion, node.ecosystem);
            };
        }
    },

    closeInspector() {
        const inspector = document.getElementById('network-inspector');
        if (inspector) inspector.classList.remove('open');
        this.selectedNode = null;
        this.selectedEdge = null;
    },

    updateLegend(mode) {
        const legend = document.getElementById('network-legend-box');
        if (!legend) return;

        if (mode === 'bipartite') {
            legend.innerHTML = `
                <div style="font-weight: 600; font-size: 11px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 2px;">Ecosystem Bipartite Topology</div>
                <div class="legend-item">
                    <span style="display: inline-block; width: 14px; height: 10px; border-radius: 2px; background-color: #4f46e5;"></span>
                    <span>Repository Node</span>
                </div>
                <div class="legend-item">
                    <span class="legend-dot" style="background-color: #2563eb;"></span>
                    <span>Maven Library (Blue)</span>
                </div>
                <div class="legend-item">
                    <span class="legend-dot" style="background-color: #16a34a;"></span>
                    <span>npm Package (Green)</span>
                </div>
                <div class="legend-item">
                    <span class="legend-dot" style="background-color: #f59e0b; box-shadow: 0 0 6px rgba(245, 158, 11, 0.8);"></span>
                    <span><strong>Divergent Versions</strong> (Amber Glow)</span>
                </div>
            `;
        } else if (mode === 'similarity') {
            legend.innerHTML = `
                <div style="font-weight: 600; font-size: 11px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 2px;">Coupling & Stack Similarity</div>
                <div class="legend-item">
                    <span class="legend-dot" style="background-color: var(--eco-maven-node);"></span>
                    <span>Maven Repository</span>
                </div>
                <div class="legend-item">
                    <span class="legend-dot" style="background-color: var(--eco-npm-node);"></span>
                    <span>npm Repository</span>
                </div>
                <div class="legend-item" style="margin-top: 4px; font-size: 10.5px; color: var(--text-subtle);">
                    <span>Edge thickness = Jaccard stack similarity %</span>
                </div>
            `;
        } else {
            legend.innerHTML = `
                <div style="font-weight: 600; font-size: 11px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 2px;">Repository Relationships</div>
                <div class="legend-item">
                    <span class="legend-dot" style="background-color: var(--eco-maven-node);"></span>
                    <span>Maven Repository</span>
                </div>
                <div class="legend-item">
                    <span class="legend-dot" style="background-color: var(--eco-npm-node);"></span>
                    <span>npm Repository</span>
                </div>
                <div class="legend-item" style="margin-top: 4px; font-size: 10.5px; color: var(--text-subtle);">
                    <span>Edge thickness = Shared package count (Click edge to inspect)</span>
                </div>
            `;
        }
    },

    renderEmptyState(container, message) {
        container.innerHTML = `
            <div style="height: 100%; display: flex; align-items: center; justify-content: center;">
                ${Components.renderEmptyState({
                    icon: Icons.network(32),
                    title: 'No Network Data Available',
                    description: message
                })}
            </div>
        `;
    },

    fitToScreen() {
        if (!this.svg || !this.g || !this.zoom) return;
        const container = document.getElementById('graph-canvas-container');
        if (!container) return;

        const bounds = this.g.node().getBBox();
        const width = container.clientWidth || 900;
        const height = container.clientHeight || 600;

        if (bounds.width === 0 || bounds.height === 0) return;

        const midX = bounds.x + bounds.width / 2;
        const midY = bounds.y + bounds.height / 2;
        const scale = 0.85 / Math.max(bounds.width / width, bounds.height / height);
        const transform = d3.zoomIdentity
            .translate(width / 2 - scale * midX, height / 2 - scale * midY)
            .scale(scale);

        this.svg.transition().duration(500).call(this.zoom.transform, transform);
    },

    drag(simulation) {
        return d3.drag()
            .on('start', (event) => {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                event.subject.fx = event.subject.x;
                event.subject.fy = event.subject.y;
            })
            .on('drag', (event) => {
                event.subject.fx = event.x;
                event.subject.fy = event.y;
            })
            .on('end', (event) => {
                if (!event.active) simulation.alphaTarget(0);
                event.subject.fx = null;
                event.subject.fy = null;
            });
    },

    showTooltip(event, html) {
        const tt = document.getElementById('graph-tooltip');
        if (!tt) return;
        tt.innerHTML = html;
        tt.style.display = 'block';

        const container = document.getElementById('graph-canvas-container');
        const rect = container.getBoundingClientRect();
        const x = event.clientX - rect.left + 15;
        const y = event.clientY - rect.top + 15;

        tt.style.left = `${Math.min(x, rect.width - 280)}px`;
        tt.style.top = `${Math.min(y, rect.height - 150)}px`;
    },

    hideTooltip() {
        const tt = document.getElementById('graph-tooltip');
        if (tt) tt.style.display = 'none';
    },

    highlightNode(query) {
        if (!this.svg) return;
        const nodes = this.svg.selectAll('.d3-node');
        const labels = this.svg.selectAll('.d3-node-label');

        if (!query) {
            nodes.attr('opacity', 1);
            labels.attr('opacity', 1);
            return;
        }

        nodes.each(function(d) {
            const match = (d.label && d.label.toLowerCase().includes(query)) ||
                          (d.artifactId && d.artifactId.toLowerCase().includes(query)) ||
                          (d.groupId && d.groupId.toLowerCase().includes(query));
            d3.select(this).attr('opacity', match ? 1 : 0.15);
        });

        labels.each(function(d) {
            const match = (d.label && d.label.toLowerCase().includes(query)) ||
                          (d.artifactId && d.artifactId.toLowerCase().includes(query));
            d3.select(this).attr('opacity', match ? 1 : 0.15);
        });
    }
};
