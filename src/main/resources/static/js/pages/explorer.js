/**
 * Page 3: Dependency Explorer Controller
 */
const ExplorerPage = {
    libraries: [],

    async render(container) {
        container.innerHTML = `
            <div class="page-header">
                <div class="page-title-group">
                    <h1>Dependency Explorer</h1>
                    <p>Unified catalog of shared libraries, packages, and version consistency across all repositories.</p>
                </div>
                <div class="page-header-actions">
                    <button class="btn btn-secondary btn-sm" id="explorer-refresh-btn">
                        ${Icons.refresh(14)} Refresh Catalog
                    </button>
                </div>
            </div>

            <!-- Filter Toolbar -->
            <div class="filter-bar">
                <div class="filter-group">
                    <div class="search-input-wrap">
                        <span class="search-input-icon">${Icons.search(16)}</span>
                        <input type="text" class="form-input" id="explorer-search-input" 
                            placeholder="Search by library or package name..." value="${escapeHtml(State.depSearch)}">
                    </div>

                    <select class="form-select filter-select" id="explorer-eco-filter">
                        <option value="ALL">All Ecosystems</option>
                        <option value="MAVEN">Maven</option>
                        <option value="NPM">npm</option>
                    </select>

                    <select class="form-select filter-select" id="explorer-consistency-filter">
                        <option value="ALL">All Version Consistencies</option>
                        <option value="consistent">Consistent (1 version across repos)</option>
                        <option value="divergent">Divergent (Multiple versions detected)</option>
                    </select>
                </div>

                <div class="filter-group">
                    <span id="explorer-count-badge" class="badge badge-neutral" style="padding: 6px 12px; font-size: 12px;">
                        Loading libraries...
                    </span>
                </div>
            </div>

            <!-- Table Container -->
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Dependency / Package</th>
                            <th>Ecosystem</th>
                            <th>Versions Detected</th>
                            <th>Repository Count</th>
                            <th>Version Consistency</th>
                            <th style="text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="explorer-table-body">
                        <tr>
                            <td colspan="6">
                                <div style="padding: 24px;">
                                    <div class="skeleton skeleton-text" style="width: 100%; height: 24px; margin-bottom: 8px;"></div>
                                    <div class="skeleton skeleton-text" style="width: 100%; height: 24px; margin-bottom: 8px;"></div>
                                    <div class="skeleton skeleton-text" style="width: 100%; height: 24px;"></div>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;

        this.bindEvents();
        await this.loadLibraries();
    },

    bindEvents() {
        let debounceTimer;
        const searchInput = document.getElementById('explorer-search-input');
        if (searchInput) {
            searchInput.oninput = (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    State.depSearch = e.target.value;
                    this.loadLibraries();
                }, 250);
            };
        }

        const ecoFilter = document.getElementById('explorer-eco-filter');
        if (ecoFilter) {
            ecoFilter.value = State.depTypeFilter;
            ecoFilter.onchange = (e) => {
                State.depTypeFilter = e.target.value;
                this.loadLibraries();
            };
        }

        const consistencyFilter = document.getElementById('explorer-consistency-filter');
        if (consistencyFilter) {
            consistencyFilter.value = State.depConsistencyFilter;
            consistencyFilter.onchange = (e) => {
                State.depConsistencyFilter = e.target.value;
                this.loadLibraries();
            };
        }

        const refreshBtn = document.getElementById('explorer-refresh-btn');
        if (refreshBtn) refreshBtn.onclick = () => this.loadLibraries();
    },

    async loadLibraries() {
        const body = document.getElementById('explorer-table-body');
        const badge = document.getElementById('explorer-count-badge');

        try {
            const data = await API.getDependencies({
                q: State.depSearch,
                type: State.depTypeFilter,
                consistency: State.depConsistencyFilter
            });

            this.libraries = data;
            State.dependencies = data;

            if (badge) {
                badge.innerText = `${data.length} ${data.length === 1 ? 'Library' : 'Libraries'} found`;
            }

            this.renderTable(data);
        } catch (error) {
            Components.Toast.error(`Failed to load dependency catalog: ${error.message}`);
            if (body) {
                body.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--status-danger-text); padding: 32px;">Failed to load libraries: ${escapeHtml(error.message)}</td></tr>`;
            }
        }
    },

    renderTable(list) {
        const body = document.getElementById('explorer-table-body');
        if (!body) return;

        if (list.length === 0) {
            body.innerHTML = `
                <tr>
                    <td colspan="6">
                        ${Components.renderEmptyState({
                            icon: Icons.explorer(24),
                            title: 'No dependencies found',
                            description: 'No dependencies match the search query and filters.',
                            actionText: 'Clear Filters',
                            onAction: () => {
                                State.depSearch = '';
                                State.depTypeFilter = 'ALL';
                                State.depConsistencyFilter = 'ALL';
                                document.getElementById('explorer-search-input').value = '';
                                document.getElementById('explorer-eco-filter').value = 'ALL';
                                document.getElementById('explorer-consistency-filter').value = 'ALL';
                                this.loadLibraries();
                            }
                        })}
                    </td>
                </tr>
            `;
            const emptyBtn = body.querySelector('#empty-state-action-btn');
            if (emptyBtn) {
                emptyBtn.onclick = () => {
                    State.depSearch = '';
                    State.depTypeFilter = 'ALL';
                    State.depConsistencyFilter = 'ALL';
                    document.getElementById('explorer-search-input').value = '';
                    document.getElementById('explorer-eco-filter').value = 'ALL';
                    document.getElementById('explorer-consistency-filter').value = 'ALL';
                    this.loadLibraries();
                };
            }
            return;
        }

        body.innerHTML = list.map(lib => `
            <tr>
                <td>
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <span class="top-dep-name" style="cursor: pointer; color: var(--brand-500);" onclick="ExplorerPage.inspectDependency('${escapeHtml(lib.artifactId)}', '${escapeHtml(lib.groupId || '')}', '${escapeHtml(lib.packageType)}')">
                            ${escapeHtml(lib.displayName)}
                        </span>
                        ${lib.groupId && lib.packageType !== 'NPM' ? `<span class="table-secondary-text">Group: ${escapeHtml(lib.groupId)}</span>` : ''}
                    </div>
                </td>
                <td>${Components.formatEcosystemBadge(lib.packageType)}</td>
                <td>
                    <div class="version-tag-list">
                        ${lib.versions.map(v => `
                            <span class="version-tag ${!lib.isConsistent ? 'divergent' : ''}">${escapeHtml(v)}</span>
                        `).join('')}
                    </div>
                </td>
                <td>
                    <span class="badge badge-neutral" style="font-weight: 600;">
                        ${lib.repoCount} ${lib.repoCount === 1 ? 'repository' : 'repositories'}
                    </span>
                </td>
                <td>
                    ${lib.isConsistent 
                        ? `<span class="badge badge-safe"><span class="badge-dot"></span>Consistent (1 version)</span>`
                        : `<span class="badge badge-warning"><span class="badge-dot"></span>Divergent (${lib.versionCount} versions)</span>`}
                </td>
                <td style="text-align: right;">
                    <div class="table-actions" style="justify-content: flex-end;">
                        <button class="btn btn-secondary btn-sm" onclick="ExplorerPage.inspectDependency('${escapeHtml(lib.artifactId)}', '${escapeHtml(lib.groupId || '')}', '${escapeHtml(lib.packageType)}')">
                            Inspect
                        </button>
                        <button class="btn btn-primary btn-sm" onclick="ImpactPage.prefillAndNavigate('${escapeHtml(lib.groupId || '')}', '${escapeHtml(lib.artifactId)}', '${escapeHtml(lib.versions[0] || '')}', '${escapeHtml(lib.packageType)}')">
                            ${Icons.impact(12)} Analyze Impact
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    async inspectDependency(artifactId, groupId, packageType) {
        Components.Drawer.open(
            'Loading Dependency Details...',
            `<div style="padding: 24px;">
                <div class="skeleton skeleton-title"></div>
                <div class="skeleton skeleton-rect" style="height: 120px; margin-bottom: 20px;"></div>
                <div class="skeleton skeleton-text" style="width: 100%; height: 32px;"></div>
             </div>`
        );

        try {
            const data = await API.getDependencyDetail(artifactId, groupId, packageType);
            if (!data || !data.displayName) {
                throw new Error('Dependency details not found.');
            }

            const titleHtml = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="color: var(--text-muted);">${Icons.explorer(20)}</span>
                    <div>
                        <div style="font-size: 16px; font-weight: 600; color: var(--text-primary);">${escapeHtml(data.displayName)}</div>
                        <div style="font-size: 12px; color: var(--text-muted);">
                            Ecosystem: ${data.packageType} • Used across ${data.repoCount} ${data.repoCount === 1 ? 'repo' : 'repos'}
                        </div>
                    </div>
                </div>
            `;

            let bodyHtml = `
                <div class="drawer-meta-grid">
                    <div class="drawer-meta-item">
                        <span class="drawer-meta-label">Version Consistency</span>
                        <div style="margin-top: 4px;">
                            ${data.isConsistent 
                                ? `<span class="badge badge-safe"><span class="badge-dot"></span>Consistent (1 version)</span>`
                                : `<span class="badge badge-warning"><span class="badge-dot"></span>Divergent (${data.versionCount} versions)</span>`}
                        </div>
                    </div>
                    <div class="drawer-meta-item">
                        <span class="drawer-meta-label">Ecosystem</span>
                        <div style="margin-top: 4px;">${Components.formatEcosystemBadge(data.packageType)}</div>
                    </div>
                    <div class="drawer-meta-item">
                        <span class="drawer-meta-label">Total Repositories</span>
                        <span class="drawer-meta-value">${data.repoCount}</span>
                    </div>
                    <div class="drawer-meta-item">
                        <span class="drawer-meta-label">Detected Versions</span>
                        <span class="drawer-meta-value">${data.versions.join(', ')}</span>
                    </div>
                </div>

                <!-- Version Distribution Breakdown -->
                <div style="margin-bottom: 24px;">
                    <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px;">
                        Version Distribution Across Repositories
                    </div>
                    ${Object.entries(data.versionBreakdown || {}).map(([ver, repoList]) => `
                        <div style="padding: 10px 14px; background: var(--bg-subtle); border-radius: var(--radius-md); margin-bottom: 8px; border: 1px solid var(--border-subtle);">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                                <span class="version-tag ${!data.isConsistent ? 'divergent' : ''}" style="font-size: 12px; font-weight: 600;">
                                    Version ${escapeHtml(ver)}
                                </span>
                                <span style="font-size: 12px; color: var(--text-muted);">
                                    ${repoList.length} ${repoList.length === 1 ? 'repository' : 'repositories'}
                                </span>
                            </div>
                            <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.4;">
                                ${repoList.map(r => `<code>${escapeHtml(r)}</code>`).join(', ')}
                            </div>
                        </div>
                    `).join('')}
                </div>

                <!-- Detailed Usages List -->
                <div style="margin-bottom: 12px; font-size: 13px; font-weight: 600; color: var(--text-primary);">
                    Repository Usages (${data.usages.length})
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    ${data.usages.map(u => `
                        <div class="dep-item-card">
                            <div>
                                <a href="${escapeHtml(u.repoUrl)}" target="_blank" rel="noopener" class="table-repo-link" style="font-size: 12.5px;">
                                    ${escapeHtml(u.repoName)} ${Icons.externalLink(11)}
                                </a>
                                <div style="font-size: 11px; color: var(--text-muted);">
                                    Scope: <code>${escapeHtml(u.scope)}</code> ${u.isDev ? '• dev dependency' : ''}
                                </div>
                            </div>
                            <span class="dep-item-version">${escapeHtml(u.version)}</span>
                        </div>
                    `).join('')}
                </div>
            `;

            const primaryVer = data.versions && data.versions.length > 0 ? data.versions[0] : '';
            const footerHtml = `
                <a href="#dependency-map" onclick="Components.Drawer.close()" class="btn btn-secondary btn-sm" style="text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
                    ${Icons.network(13)} View in Ecosystem Map
                </a>
                <button class="btn btn-primary btn-sm" onclick="ImpactPage.prefillAndNavigate('${escapeHtml(data.groupId || '')}', '${escapeHtml(data.artifactId)}', '${escapeHtml(primaryVer)}', '${escapeHtml(data.packageType)}'); Components.Drawer.close();">
                    ${Icons.impact(14)} Analyze Upgrade Impact
                </button>
                <button class="btn btn-secondary btn-sm" onclick="Components.Drawer.close()">
                    Close
                </button>
            `;

            Components.Drawer.open(titleHtml, bodyHtml, footerHtml);
        } catch (error) {
            Components.Drawer.open(
                'Error',
                `<div style="color: var(--status-danger-text); padding: 24px;">Failed to load library details: ${escapeHtml(error.message)}</div>`
            );
        }
    }
};

