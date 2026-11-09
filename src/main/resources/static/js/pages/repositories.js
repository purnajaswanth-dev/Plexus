/**
 * Page 2: Repositories Management & Architecture Intelligence Controller
 */
const RepositoriesPage = {
    repositories: [],
    currentDetailRepo: null,
    currentArchData: null,
    archSimulation: null,
    archSvg: null,
    archG: null,
    archZoom: null,
    archSelectedLevel: 2,
    archLayoutMode: 'force', // 'force' or 'dag'
    selectedArchNode: null,

    async render(container) {
        container.innerHTML = `
            <div class="page-header">
                <div class="page-title-group">
                    <h1>Repositories</h1>
                    <p>Manage, index, inspect internal architecture, and monitor dependencies across repositories.</p>
                </div>
                <div class="page-header-actions">
                    <button class="btn btn-primary" id="btn-open-add-repo">
                        ${Icons.plus(16)} Add Repository
                    </button>
                </div>
            </div>

            <!-- Filter & Search Toolbar -->
            <div class="filter-bar">
                <div class="filter-group">
                    <div class="search-input-wrap">
                        <span class="search-input-icon">${Icons.search(16)}</span>
                        <input type="text" class="form-input" id="repo-search-input" placeholder="Search repositories..." value="${escapeHtml(State.repoFilter)}">
                    </div>

                    <select class="form-select filter-select" id="repo-status-filter">
                        <option value="ALL">All Statuses</option>
                        <option value="INDEXED">Indexed</option>
                        <option value="INDEXED_NO_MANIFEST">Indexed (No Manifest)</option>
                        <option value="FAILED">Failed</option>
                        <option value="PENDING">Pending</option>
                    </select>

                    <select class="form-select filter-select" id="repo-eco-filter">
                        <option value="ALL">All Ecosystems</option>
                        <option value="MAVEN">Maven</option>
                        <option value="GRADLE">Gradle</option>
                        <option value="NPM">npm</option>
                        <option value="PYTHON">Python</option>
                        <option value="GO">Go</option>
                        <option value="MULTI_ECOSYSTEM">Multi-Ecosystem</option>
                        <option value="NONE">None</option>
                    </select>
                </div>

                <div class="filter-group">
                    <span style="font-size: 12px; color: var(--text-muted);">Sort by:</span>
                    <select class="form-select filter-select" id="repo-sort-by">
                        <option value="lastIndexed">Last Indexed</option>
                        <option value="healthScore">Health Score</option>
                        <option value="repoName">Repository Name</option>
                        <option value="depsCount">Dependency Count</option>
                    </select>
                </div>
            </div>

            <!-- Architecture Backfill Banner Container -->
            <div id="arch-backfill-banner-container"></div>

            <!-- Table Container -->
            <div class="table-container" id="repo-table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Repository</th>
                            <th>Ecosystem</th>
                            <th>Dependencies</th>
                            <th>Health Score</th>
                            <th>Indexing Status</th>
                            <th>Last Indexed</th>
                            <th style="text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="repo-table-body">
                        <tr>
                            <td colspan="7">
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

            <!-- Add Repository Modal -->
            <div class="modal-backdrop" id="add-repo-modal">
                <div class="modal-dialog">
                    <div class="modal-header">
                        <h3 class="modal-title">Add GitHub Repository</h3>
                        <button class="modal-close-btn" id="add-repo-modal-close">${Icons.x(16)}</button>
                    </div>
                    <form id="add-repo-form">
                        <div class="modal-body">
                            <div class="form-group">
                                <label class="form-label" for="add-repo-url">GitHub Repository URL</label>
                                <input type="text" class="form-input" id="add-repo-url" 
                                    placeholder="https://github.com/owner/repository" required autocomplete="off">
                                <div class="form-hint">
                                    Supports Maven (pom.xml) or npm (package.json) repositories. Examples:
                                    <code>https://github.com/spring-projects/spring-petclinic</code> or <code>owner/repo</code>
                                </div>
                                <div class="form-error" id="add-repo-error" style="display: none;"></div>
                            </div>
                            <div id="add-repo-feedback" style="display: none; padding: 10px; border-radius: var(--radius-sm); font-size: 12.5px;"></div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" id="add-repo-cancel">Cancel</button>
                            <button type="submit" class="btn btn-primary" id="add-repo-submit">
                                <span id="add-repo-btn-text">Index Repository & Architecture</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        this.bindEvents();
        await this.loadRepositories();
    },

    bindEvents() {
        const searchInput = document.getElementById('repo-search-input');
        if (searchInput) {
            searchInput.oninput = (e) => {
                State.repoFilter = e.target.value;
                this.renderTable();
            };
        }

        const statusFilter = document.getElementById('repo-status-filter');
        if (statusFilter) {
            statusFilter.value = State.repoStatusFilter;
            statusFilter.onchange = (e) => {
                State.repoStatusFilter = e.target.value;
                this.renderTable();
            };
        }

        const ecoFilter = document.getElementById('repo-eco-filter');
        if (ecoFilter) {
            ecoFilter.value = State.repoEcosystemFilter;
            ecoFilter.onchange = (e) => {
                State.repoEcosystemFilter = e.target.value;
                this.renderTable();
            };
        }

        const sortBy = document.getElementById('repo-sort-by');
        if (sortBy) {
            sortBy.value = State.repoSortBy;
            sortBy.onchange = (e) => {
                State.repoSortBy = e.target.value;
                this.renderTable();
            };
        }

        const openBtn = document.getElementById('btn-open-add-repo');
        if (openBtn) {
            openBtn.onclick = () => {
                document.getElementById('add-repo-form').reset();
                document.getElementById('add-repo-error').style.display = 'none';
                document.getElementById('add-repo-feedback').style.display = 'none';
                Components.Modal.open('add-repo-modal');
                setTimeout(() => document.getElementById('add-repo-url').focus(), 100);
            };
        }

        const closeBtn = document.getElementById('add-repo-modal-close');
        if (closeBtn) closeBtn.onclick = () => Components.Modal.close('add-repo-modal');

        const cancelBtn = document.getElementById('add-repo-cancel');
        if (cancelBtn) cancelBtn.onclick = () => Components.Modal.close('add-repo-modal');

        const addForm = document.getElementById('add-repo-form');
        if (addForm) {
            addForm.onsubmit = async (e) => {
                e.preventDefault();
                await this.handleAddRepository();
            };
        }
    },

    async loadRepositories() {
        try {
            this.repositories = await API.getRepositories();
            State.repositories = this.repositories;
            this.renderTable();
            this.checkAndRenderBackfillBanner();
        } catch (error) {
            Components.Toast.error(`Failed to load repositories: ${error.message}`);
        }
    },

    async checkAndRenderBackfillBanner() {
        const container = document.getElementById('arch-backfill-banner-container');
        if (!container) return;

        try {
            const status = await API.getArchitectureStatus();
            if (status && status.missingCount > 0) {
                container.innerHTML = `
                    <div style="background: var(--bg-surface); border: 1px solid var(--border-base); border-left: 4px solid var(--brand-500); padding: 14px 20px; border-radius: var(--radius-md); margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; box-shadow: var(--shadow-xs); flex-wrap: wrap; gap: 12px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span style="color: var(--brand-500);">${Icons.layers(22)}</span>
                            <div>
                                <div style="font-weight: 600; font-size: 13.5px; color: var(--text-primary);">
                                    Architecture Intelligence Backfill Available
                                </div>
                                <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                                    ${status.missingCount} indexed repository(ies) pending AST static architecture analysis.
                                </div>
                            </div>
                        </div>
                        <button class="btn btn-primary btn-sm" id="btn-trigger-backfill">
                            <span id="btn-backfill-text">${Icons.layers(14)} Backfill Architecture (${status.missingCount} pending)</span>
                        </button>
                    </div>
                `;

                const btn = document.getElementById('btn-trigger-backfill');
                if (btn) {
                    btn.onclick = async () => {
                        const txt = document.getElementById('btn-backfill-text');
                        btn.disabled = true;
                        if (txt) txt.innerHTML = `<span class="btn-spinner"></span> Backfilling Architecture...`;

                        try {
                            const res = await API.backfillArchitecture();
                            Components.Toast.success(`Backfill complete: ${res.successCount} analyzed, ${res.skippedCount} skipped, ${res.failedCount} failed.`);
                            await this.loadRepositories();
                        } catch (err) {
                            Components.Toast.error(`Backfill failed: ${err.message}`);
                            if (txt) txt.innerHTML = `${Icons.layers(14)} Retry Backfill`;
                            btn.disabled = false;
                        }
                    };
                }
            } else {
                container.innerHTML = '';
            }
        } catch (err) {
            console.error('Failed to check architecture status:', err);
        }
    },

    renderTable() {
        const body = document.getElementById('repo-table-body');
        if (!body) return;

        let filtered = [...this.repositories];

        if (State.repoFilter) {
            const q = State.repoFilter.toLowerCase().trim();
            filtered = filtered.filter(r => 
                (r.repoName && r.repoName.toLowerCase().includes(q)) ||
                (r.language && r.language.toLowerCase().includes(q))
            );
        }

        if (State.repoStatusFilter !== 'ALL') {
            filtered = filtered.filter(r => (r.indexStatus || '').toUpperCase() === State.repoStatusFilter);
        }

        if (State.repoEcosystemFilter !== 'ALL') {
            filtered = filtered.filter(r => (r.dependencyFileType || '').toUpperCase() === State.repoEcosystemFilter);
        }

        filtered.sort((a, b) => {
            if (State.repoSortBy === 'healthScore') {
                return (b.healthScore || 0) - (a.healthScore || 0);
            }
            if (State.repoSortBy === 'repoName') {
                return (a.repoName || '').localeCompare(b.repoName || '');
            }
            if (State.repoSortBy === 'depsCount') {
                return (b.dependencyCount || 0) - (a.dependencyCount || 0);
            }
            const dateA = a.lastIndexed ? new Date(a.lastIndexed).getTime() : 0;
            const dateB = b.lastIndexed ? new Date(b.lastIndexed).getTime() : 0;
            return dateB - dateA;
        });

        if (filtered.length === 0) {
            body.innerHTML = `
                <tr>
                    <td colspan="7">
                        ${Components.renderEmptyState({
                            icon: Icons.repos(24),
                            title: 'No repositories match the filter',
                            description: 'Try adjusting your search query, status filter, or ecosystem selection.',
                            actionText: 'Clear Filters',
                            onAction: () => {
                                State.repoFilter = '';
                                State.repoStatusFilter = 'ALL';
                                State.repoEcosystemFilter = 'ALL';
                                this.renderTable();
                            }
                        })}
                    </td>
                </tr>
            `;
            return;
        }

        body.innerHTML = filtered.map(repo => `
            <tr>
                <td>
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <a href="${escapeHtml(repo.repoUrl || '#')}" target="_blank" rel="noopener" class="table-repo-link">
                            ${escapeHtml(repo.repoName)} ${Icons.externalLink(12)}
                        </a>
                        <div class="table-secondary-text">
                            ${escapeHtml(repo.language || 'Unknown language')} • ${escapeHtml(repo.defaultBranch || 'main')}${repo.isMonorepo ? ' • <span class="badge" style="background: rgba(168, 85, 247, 0.15); color: #9333ea; font-size: 11px; padding: 1px 6px;">Monorepo</span>' : ''}
                        </div>
                    </div>
                </td>
                <td>${Components.formatEcosystemBadge(repo.dependencyFileType)}</td>
                <td>
                    <span style="font-weight: 600; font-variant-numeric: tabular-nums;">${repo.dependencyCount}</span>
                </td>
                <td>${Components.formatHealthBadge(repo.healthScore, repo.healthRating)}</td>
                <td>${Components.formatStatusBadge(repo.indexStatus)}</td>
                <td>
                    <span title="${Components.formatExactDateTime(repo.lastIndexed)}" style="color: var(--text-muted); font-size: 12.5px;">
                        ${Components.formatDate(repo.lastIndexed)}
                    </span>
                </td>
                <td style="text-align: right;">
                    <div class="table-actions" style="justify-content: flex-end;">
                        <button class="btn btn-secondary btn-sm" onclick="RepositoriesPage.openDetailDrawer(${repo.id})" title="Inspect Details & Architecture">
                            Inspect
                        </button>
                        <a href="#codecity?repoId=${repo.id}" class="btn btn-primary btn-sm" title="Explore 2D Software City" style="text-decoration: none; display: inline-flex; align-items: center; gap: 4px; background: #4f46e5; border-color: #6366f1;">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/></svg> City
                        </a>
                        <a href="#architecture?repoId=${repo.id}" class="btn btn-secondary btn-sm" title="Open Visual Architecture Explorer" style="text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
                            ${Icons.layers(13)} Architecture
                        </a>
                        <button class="btn btn-secondary btn-icon btn-sm" id="reindex-btn-${repo.id}" onclick="RepositoriesPage.handleReindex(${repo.id})" title="Re-index repository">
                            ${Icons.refresh(14)}
                        </button>
                        <button class="btn btn-secondary btn-icon btn-sm" onclick="RepositoriesPage.handleDelete(${repo.id}, '${escapeHtml(repo.repoName)}')" title="Delete repository" style="color: var(--status-danger-text);">
                            ${Icons.trash(14)}
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    filterByStatus(status) {
        App.navigateTo('repositories');
        State.repoStatusFilter = status;
        const sel = document.getElementById('repo-status-filter');
        if (sel) sel.value = status;
        this.renderTable();
    },

    filterByRating(rating) {
        App.navigateTo('repositories');
        if (rating === 'Healthy') {
            State.repoFilter = '';
            State.repoStatusFilter = 'INDEXED';
        } else if (rating === 'Critical') {
            State.repoStatusFilter = 'ALL';
        }
        this.renderTable();
    },

    async handleAddRepository() {
        const urlInput = document.getElementById('add-repo-url');
        const submitBtn = document.getElementById('add-repo-submit');
        const btnText = document.getElementById('add-repo-btn-text');
        const errorEl = document.getElementById('add-repo-error');
        const feedbackEl = document.getElementById('add-repo-feedback');

        const rawUrl = urlInput.value.trim();
        if (!rawUrl) {
            errorEl.innerText = 'Please enter a valid GitHub repository URL.';
            errorEl.style.display = 'block';
            return;
        }

        const gitHubRegex = /(?:github\.com\/|)([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)(?:\.git|\/|$)/;
        if (!gitHubRegex.test(rawUrl)) {
            errorEl.innerText = 'Invalid format. Use https://github.com/owner/repository or owner/repository';
            errorEl.style.display = 'block';
            return;
        }

        errorEl.style.display = 'none';
        feedbackEl.style.display = 'none';
        submitBtn.disabled = true;
        btnText.innerHTML = `<span class="btn-spinner"></span> Indexing & Analyzing Architecture...`;

        try {
            const result = await API.addRepository(rawUrl);
            Components.Toast.success(`Indexed ${result.repository.repoName} with ${result.dependencyCount} dependencies!`);
            Components.Modal.close('add-repo-modal');
            await this.loadRepositories();
            if (result.repository && result.repository.id) {
                this.openDetailDrawer(result.repository.id);
            }
        } catch (error) {
            errorEl.innerText = error.message;
            errorEl.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            btnText.innerText = 'Index Repository & Architecture';
        }
    },

    async handleReindex(id) {
        const btn = document.getElementById(`reindex-btn-${id}`);
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span class="btn-spinner"></span>`;
        }

        try {
            const updated = await API.reindexRepository(id);
            Components.Toast.success(`Re-indexed ${updated.repository.repoName}: ${updated.dependencyCount} dependencies updated.`);
            await this.loadRepositories();
        } catch (error) {
            Components.Toast.error(`Re-index failed: ${error.message}`);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = Icons.refresh(14);
            }
        }
    },

    handleDelete(id, repoName) {
        Components.ConfirmDialog.show({
            title: 'Delete Repository',
            message: `Are you sure you want to delete "${repoName}"? All extracted dependency records and architecture graphs will be removed.`,
            confirmText: 'Delete Repository',
            confirmClass: 'btn-danger',
            onConfirm: async () => {
                try {
                    await API.deleteRepository(id);
                    Components.Toast.success(`Repository "${repoName}" deleted.`);
                    Components.Drawer.close();
                    await this.loadRepositories();
                } catch (error) {
                    Components.Toast.error(`Delete failed: ${error.message}`);
                }
            }
        });
    },

    async openDetailDrawer(id, defaultTab = 'overview') {
        if (this.archSimulation) {
            this.archSimulation.stop();
            this.archSimulation = null;
        }
        this.currentArchData = null;
        this.archSvg = null;

        Components.Drawer.open(
            `Loading Repository Details...`,
            `<div style="padding: 24px;">
                <div class="skeleton skeleton-title"></div>
                <div class="skeleton skeleton-rect" style="height: 100px; margin-bottom: 20px;"></div>
                <div class="skeleton skeleton-text" style="width: 100%; height: 30px; margin-bottom: 8px;"></div>
                <div class="skeleton skeleton-text" style="width: 100%; height: 30px;"></div>
             </div>`
        );

        try {
            const data = await API.getRepository(id);
            this.currentDetailRepo = data;
            const repo = data.repository;
            const deps = data.dependencies || {};
            const allDeps = data.allDependencies || [];

            const titleHtml = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="color: var(--text-muted);">${Icons.repos(20)}</span>
                    <div>
                        <div style="font-size: 16px; font-weight: 600; color: var(--text-primary);">${escapeHtml(repo.repoName)}</div>
                        <a href="${escapeHtml(repo.repoUrl)}" target="_blank" rel="noopener" style="font-size: 12px; color: var(--brand-500); text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
                            ${escapeHtml(repo.repoUrl)} ${Icons.externalLink(11)}
                        </a>
                    </div>
                </div>
            `;

            let bodyHtml = `
                <!-- Sub-Navigation Tabs -->
                <div class="tabs-header" style="margin-bottom: 20px;">
                    <button class="tab-btn ${defaultTab === 'overview' ? 'active' : ''}" id="drawer-tab-overview">Overview</button>
                    <button class="tab-btn ${defaultTab === 'architecture' ? 'active' : ''}" id="drawer-tab-architecture">Architecture Intelligence</button>
                    <button class="tab-btn ${defaultTab === 'dependencies' ? 'active' : ''}" id="drawer-tab-deps">Dependencies (${allDeps.length})</button>
                </div>

                <!-- Tab 1: Overview Panel -->
                <div id="drawer-panel-overview" style="display: ${defaultTab === 'overview' ? 'block' : 'none'};">
                    <div class="drawer-meta-grid">
                        <div class="drawer-meta-item">
                            <span class="drawer-meta-label">Health Score</span>
                            <div style="margin-top: 4px;">${Components.formatHealthBadge(data.healthScore, data.healthRating)}</div>
                        </div>
                        <div class="drawer-meta-item">
                            <span class="drawer-meta-label">Dependencies</span>
                            <span class="drawer-meta-value">${data.dependencyCount} packages</span>
                        </div>
                        <div class="drawer-meta-item">
                            <span class="drawer-meta-label">Ecosystem</span>
                            <div style="margin-top: 4px;">${Components.formatEcosystemBadge(repo.dependencyFileType)}</div>
                        </div>
                        <div class="drawer-meta-item">
                            <span class="drawer-meta-label">Primary Language</span>
                            <span class="drawer-meta-value">${escapeHtml(repo.language || 'Unknown')}</span>
                        </div>
                        <div class="drawer-meta-item">
                            <span class="drawer-meta-label">Default Branch</span>
                            <span class="drawer-meta-value">${escapeHtml(repo.defaultBranch || 'main')}</span>
                        </div>
                        <div class="drawer-meta-item">
                            <span class="drawer-meta-label">Monorepo</span>
                            <span class="drawer-meta-value">${repo.isMonorepo ? '<span class="badge" style="background: rgba(168, 85, 247, 0.15); color: #9333ea;">Multi-Project</span>' : 'Standard'}</span>
                        </div>
                        <div class="drawer-meta-item">
                            <span class="drawer-meta-label">Files Discovered</span>
                            <span class="drawer-meta-value">${repo.totalFilesDiscovered != null ? repo.totalFilesDiscovered : 'N/A'}</span>
                        </div>
                        <div class="drawer-meta-item">
                            <span class="drawer-meta-label">Last Indexed</span>
                            <span class="drawer-meta-value">${Components.formatExactDateTime(repo.lastIndexed)}</span>
                        </div>
                    </div>

                    ${repo.statusDetail ? `
                        <div style="margin-bottom: 16px; font-size: 12.5px; color: var(--text-secondary); line-height: 1.5; padding: 10px 14px; background: rgba(59, 130, 246, 0.08); border-left: 3px solid #3b82f6; border-radius: 4px;">
                            ${escapeHtml(repo.statusDetail)}
                        </div>
                    ` : ''}

                    ${repo.description ? `
                        <div style="margin-bottom: 20px; font-size: 13px; color: var(--text-secondary); line-height: 1.5; padding: 10px 14px; background: var(--bg-subtle); border-radius: var(--radius-md);">
                            ${escapeHtml(repo.description)}
                        </div>
                    ` : ''}

                    ${(data.healthIssues && data.healthIssues.length > 0) ? `
                        <div style="margin-bottom: 24px;">
                            <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px;">Health Diagnostics</div>
                            ${data.healthIssues.map(issue => `
                                <div style="font-size: 12.5px; padding: 6px 10px; background: var(--bg-subtle); border-radius: var(--radius-sm); margin-bottom: 4px; display: flex; align-items: center; gap: 8px; color: var(--text-secondary);">
                                    <span style="color: ${data.healthRating === 'Critical' ? 'var(--status-danger-dot)' : 'var(--status-warning-dot)'};">•</span>
                                    ${escapeHtml(issue)}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>

                <!-- Tab 2: Architecture Intelligence Panel -->
                <div id="drawer-panel-architecture" style="display: ${defaultTab === 'architecture' ? 'block' : 'none'};">
                    <div id="arch-panel-content">
                        <div style="padding: 20px; text-align: center;">
                            <div class="btn-spinner" style="width: 24px; height: 24px;"></div>
                            <div style="margin-top: 10px; font-size: 13px; color: var(--text-muted);">Loading architecture intelligence graph...</div>
                        </div>
                    </div>
                </div>

                <!-- Tab 3: Dependencies Panel -->
                <div id="drawer-panel-deps" style="display: ${defaultTab === 'dependencies' ? 'block' : 'none'};">
                    <div class="search-input-wrap" style="width: 100%; margin-bottom: 16px;">
                        <span class="search-input-icon">${Icons.search(14)}</span>
                        <input type="text" class="form-input" id="drawer-dep-search" placeholder="Filter dependencies in this repository...">
                    </div>
                    <div id="drawer-deps-container">
                        ${this.renderDrawerDependencies(deps)}
                    </div>
                </div>
            `;

            const footerHtml = `
                <button class="btn btn-danger btn-sm" onclick="RepositoriesPage.handleDelete(${repo.id}, '${escapeHtml(repo.repoName)}')">
                    ${Icons.trash(14)} Delete Repository
                </button>
                <div style="display: flex; gap: 8px;">
                    <a href="#architecture?repoId=${repo.id}" onclick="Components.Drawer.close()" class="btn btn-primary btn-sm" style="text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
                        ${Icons.layers(14)} Architecture Explorer
                    </a>
                    <button class="btn btn-secondary btn-sm" onclick="RepositoriesPage.handleReindex(${repo.id})">
                        ${Icons.refresh(14)} Re-index Manifest
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="Components.Drawer.close()">
                        Close
                    </button>
                </div>
            `;

            Components.Drawer.open(titleHtml, bodyHtml, footerHtml);

            // Tab Switching Listeners
            const tOverview = document.getElementById('drawer-tab-overview');
            const tArch = document.getElementById('drawer-tab-architecture');
            const tDeps = document.getElementById('drawer-tab-deps');

            const pOverview = document.getElementById('drawer-panel-overview');
            const pArch = document.getElementById('drawer-panel-architecture');
            const pDeps = document.getElementById('drawer-panel-deps');

            const switchTab = (activeTab) => {
                tOverview.classList.toggle('active', activeTab === 'overview');
                tArch.classList.toggle('active', activeTab === 'architecture');
                tDeps.classList.toggle('active', activeTab === 'dependencies');

                pOverview.style.display = activeTab === 'overview' ? 'block' : 'none';
                pArch.style.display = activeTab === 'architecture' ? 'block' : 'none';
                pDeps.style.display = activeTab === 'dependencies' ? 'block' : 'none';

                if (activeTab === 'architecture') {
                    this.loadArchitectureGraph(id, repo);
                }
            };

            tOverview.onclick = () => switchTab('overview');
            tArch.onclick = () => switchTab('architecture');
            tDeps.onclick = () => switchTab('dependencies');

            if (defaultTab === 'architecture') {
                this.loadArchitectureGraph(id, repo);
            }

            // In-drawer search listener
            const depSearch = document.getElementById('drawer-dep-search');
            if (depSearch) {
                depSearch.oninput = (e) => {
                    const q = e.target.value.toLowerCase().trim();
                    const filtered = allDeps.filter(d => 
                        (d.artifactId && d.artifactId.toLowerCase().includes(q)) ||
                        (d.groupId && d.groupId.toLowerCase().includes(q))
                    );

                    const groupMap = {};
                    filtered.forEach(d => {
                        const scope = d.scope || 'compile';
                        if (!groupMap[scope]) groupMap[scope] = [];
                        groupMap[scope].push(d);
                    });

                    document.getElementById('drawer-deps-container').innerHTML = this.renderDrawerDependencies(groupMap);
                };
            }
        } catch (error) {
            Components.Drawer.open(
                'Error',
                `<div style="color: var(--status-danger-text); padding: 24px;">Failed to load repository details: ${escapeHtml(error.message)}</div>`
            );
        }
    },

    renderDrawerDependencies(grouped) {
        const scopes = Object.keys(grouped);
        if (scopes.length === 0) {
            return `<div style="text-align: center; color: var(--text-muted); padding: 24px; font-size: 13px;">No dependencies match the search query.</div>`;
        }

        return scopes.map(scope => `
            <div class="dep-scope-section">
                <div class="dep-scope-header">
                    <span>Scope: ${escapeHtml(scope.toUpperCase())}</span>
                    <span>${grouped[scope].length} packages</span>
                </div>
                <div>
                    ${grouped[scope].map(dep => `
                        <div class="dep-item-card">
                            <div style="display: flex; flex-direction: column; gap: 2px;">
                                <span class="dep-item-name">${escapeHtml(dep.groupId ? `${dep.groupId}:${dep.artifactId}` : dep.artifactId)}</span>
                                <div style="display: flex; gap: 6px; align-items: center; font-size: 10.5px;">
                                    ${dep.manifestPath ? `<span style="color: var(--text-muted); font-family: var(--font-mono);">${escapeHtml(dep.manifestPath)}</span>` : ''}
                                    ${dep.isDev ? `<span style="color: var(--text-subtle);">• Dev</span>` : ''}
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span class="dep-item-version">${escapeHtml(dep.version || 'unspecified')}</span>
                                <button class="btn btn-secondary btn-icon btn-sm" title="Analyze Upgrade Impact" onclick="ImpactPage.prefillAndNavigate('${escapeHtml(dep.groupId || '')}', '${escapeHtml(dep.artifactId)}', '${escapeHtml(dep.version || '')}', '${escapeHtml(dep.packageType || 'MAVEN')}')">
                                    ${Icons.impact(12)}
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    },

    async loadArchitectureGraph(repoId, repo) {
        const panel = document.getElementById('arch-panel-content');
        if (!panel) return;

        try {
            const data = await API.getArchitecture(repoId, this.archSelectedLevel);
            this.currentArchData = data;

            if (data.status === 'NOT_ANALYZED' || !data.nodes || data.nodes.length === 0) {
                panel.innerHTML = `
                    <div style="padding: 32px 16px; text-align: center;">
                        ${Components.renderEmptyState({
                            icon: Icons.layers(32),
                            title: 'Architecture not yet analyzed',
                            description: 'Trigger static source-code analysis to construct the navigable architecture graph for this repository.',
                            actionText: 'Analyze Architecture Now',
                            onAction: () => this.triggerArchReindex(repoId, repo)
                        })}
                    </div>
                `;
                const actBtn = panel.querySelector('#empty-state-action-btn');
                if (actBtn) actBtn.onclick = () => this.triggerArchReindex(repoId, repo);
                return;
            }

            panel.innerHTML = `
                <div class="arch-graph-container">
                    <div class="arch-toolbar">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div class="arch-level-tabs">
                                <button class="arch-level-btn ${this.archSelectedLevel === 1 ? 'active' : ''}" id="arch-lvl-1">L1: High-Level</button>
                                <button class="arch-level-btn ${this.archSelectedLevel === 2 ? 'active' : ''}" id="arch-lvl-2">L2: Components</button>
                                <button class="arch-level-btn ${this.archSelectedLevel === 3 ? 'active' : ''}" id="arch-lvl-3">L3: Source Detail</button>
                            </div>

                            <select class="form-select filter-select" id="arch-layout-select" style="height: 28px; font-size: 11.5px; padding: 0 8px;">
                                <option value="force" ${this.archLayoutMode === 'force' ? 'selected' : ''}>Force-Directed</option>
                                <option value="dag" ${this.archLayoutMode === 'dag' ? 'selected' : ''}>Hierarchical DAG</option>
                            </select>
                        </div>

                        <div style="display: flex; align-items: center; gap: 6px;">
                            <input type="text" class="form-input" id="arch-search-input" placeholder="Find component..." style="height: 28px; width: 140px; font-size: 11px;">
                            <div class="network-controls" style="display: flex; gap: 2px;">
                                <button class="btn btn-secondary btn-icon btn-sm" id="arch-zoom-in" title="Zoom In" style="height: 28px; width: 28px;">${Icons.zoomIn(12)}</button>
                                <button class="btn btn-secondary btn-icon btn-sm" id="arch-zoom-out" title="Zoom Out" style="height: 28px; width: 28px;">${Icons.zoomOut(12)}</button>
                                <button class="btn btn-secondary btn-icon btn-sm" id="arch-zoom-fit" title="Fit to Screen" style="height: 28px; width: 28px;">${Icons.layers(12)}</button>
                                <button class="btn btn-secondary btn-icon btn-sm" id="arch-zoom-reset" title="Reset View" style="height: 28px; width: 28px;">${Icons.zoomReset(12)}</button>
                            </div>
                            <button class="btn btn-secondary btn-sm" id="arch-reindex-btn" style="height: 28px; font-size: 11px;">
                                ${Icons.refresh(12)} Re-analyze
                            </button>
                        </div>
                    </div>

                    <div class="arch-canvas-wrap" id="arch-canvas-container">
                        <div id="arch-inspector-drawer" class="arch-inspector-drawer">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">
                                <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Component Inspector</span>
                                <button class="modal-close-btn" id="arch-inspector-close">${Icons.x(14)}</button>
                            </div>
                            <div id="arch-inspector-body"></div>
                        </div>
                    </div>
                </div>

                <div style="margin-top: 12px; font-size: 11.5px; color: var(--text-muted); display: flex; justify-content: space-between;">
                    <span>${data.summary || 'Architecture verified'}</span>
                    <span>Commit SHA: <code>${escapeHtml(data.commitSha ? data.commitSha.substring(0, 8) : 'HEAD')}</code></span>
                </div>
            `;

            // Bind Architecture Controls
            document.getElementById('arch-lvl-1').onclick = () => { this.archSelectedLevel = 1; this.loadArchitectureGraph(repoId, repo); };
            document.getElementById('arch-lvl-2').onclick = () => { this.archSelectedLevel = 2; this.loadArchitectureGraph(repoId, repo); };
            document.getElementById('arch-lvl-3').onclick = () => { this.archSelectedLevel = 3; this.loadArchitectureGraph(repoId, repo); };

            document.getElementById('arch-layout-select').onchange = (e) => {
                this.archLayoutMode = e.target.value;
                this.renderD3ArchitectureGraph(data, repo);
            };

            document.getElementById('arch-search-input').oninput = (e) => {
                this.highlightArchNode(e.target.value.toLowerCase().trim());
            };

            document.getElementById('arch-zoom-in').onclick = () => {
                if (this.archSvg && this.archZoom) this.archSvg.transition().duration(300).call(this.archZoom.scaleBy, 1.3);
            };

            document.getElementById('arch-zoom-out').onclick = () => {
                if (this.archSvg && this.archZoom) this.archSvg.transition().duration(300).call(this.archZoom.scaleBy, 0.7);
            };

            document.getElementById('arch-zoom-fit').onclick = () => this.fitArchToScreen();

            document.getElementById('arch-zoom-reset').onclick = () => {
                if (this.archSvg && this.archZoom) this.archSvg.transition().duration(400).call(this.archZoom.transform, d3.zoomIdentity);
            };

            document.getElementById('arch-reindex-btn').onclick = () => {
                this.triggerArchReindex(repoId, repo);
            };

            document.getElementById('arch-inspector-close').onclick = () => {
                document.getElementById('arch-inspector-drawer').classList.remove('open');
            };

            this.renderD3ArchitectureGraph(data, repo);

        } catch (error) {
            panel.innerHTML = `<div style="color: var(--status-danger-text); padding: 20px;">Failed to load architecture: ${escapeHtml(error.message)}</div>`;
        }
    },

    async triggerArchReindex(repoId, repo) {
        const panel = document.getElementById('arch-panel-content');
        if (panel) {
            panel.innerHTML = `
                <div style="padding: 40px; text-align: center;">
                    <div class="btn-spinner" style="width: 28px; height: 28px;"></div>
                    <div style="margin-top: 12px; font-weight: 600; font-size: 13.5px;">Static Code Analysis in Progress...</div>
                    <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Fetching source files from GitHub and extracting AST component relationships.</div>
                </div>
            `;
        }

        try {
            await API.reindexArchitecture(repoId);
            Components.Toast.success('Architecture analysis complete.');
            await this.loadArchitectureGraph(repoId, repo);
        } catch (error) {
            Components.Toast.error(`Architecture analysis failed: ${error.message}`);
            await this.loadArchitectureGraph(repoId, repo);
        }
    },

    fitArchToScreen() {
        if (!this.archSvg || !this.archG || !this.archZoom) return;
        const container = document.getElementById('arch-canvas-container');
        if (!container) return;

        const bounds = this.archG.node().getBBox();
        const width = container.clientWidth || 740;
        const height = 520;
        if (bounds.width === 0 || bounds.height === 0) return;

        const midX = bounds.x + bounds.width / 2;
        const midY = bounds.y + bounds.height / 2;
        const scale = 0.85 / Math.max(bounds.width / width, bounds.height / height);
        const transform = d3.zoomIdentity
            .translate(width / 2 - scale * midX, height / 2 - scale * midY)
            .scale(scale);

        this.archSvg.transition().duration(500).call(this.archZoom.transform, transform);
    },

    renderD3ArchitectureGraph(data, repo) {
        const container = document.getElementById('arch-canvas-container');
        if (!container) return;

        d3.select('#arch-canvas-container svg').remove();

        if (this.archSimulation) {
            this.archSimulation.stop();
            this.archSimulation = null;
        }

        const nodes = (data.nodes || []).map(n => ({ ...n }));
        const nodeKeyMap = new Map();
        nodes.forEach(n => nodeKeyMap.set(n.nodeKey, n));

        const edges = (data.edges || [])
            .map(e => ({
                ...e,
                source: typeof e.source === 'object' ? e.source.nodeKey : (e.source || e.sourceNodeKey),
                target: typeof e.target === 'object' ? e.target.nodeKey : (e.target || e.targetNodeKey)
            }))
            .filter(e => nodeKeyMap.has(e.source) && nodeKeyMap.has(e.target));

        const width = container.clientWidth || 740;
        const height = 520;

        this.archSvg = d3.select('#arch-canvas-container')
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .on('click', (event) => {
                if (event.target.tagName === 'svg') {
                    const drawer = document.getElementById('arch-inspector-drawer');
                    if (drawer) drawer.classList.remove('open');
                    this.selectedArchNode = null;
                }
            });

        this.archZoom = d3.zoom()
            .scaleExtent([0.2, 4])
            .on('zoom', (event) => {
                this.archG.attr('transform', event.transform);
            });

        this.archSvg.call(this.archZoom);
        this.archG = this.archSvg.append('g');

        // Layout Simulation
        if (this.archLayoutMode === 'dag') {
            // Hierarchical layout
            this.archSimulation = d3.forceSimulation(nodes)
                .force('link', d3.forceLink(edges).id(d => d.nodeKey).distance(120))
                .force('charge', d3.forceManyBody().strength(-280))
                .force('y', d3.forceY(d => (d.level || 2) * 140).strength(0.8))
                .force('x', d3.forceX(width / 2).strength(0.2))
                .force('collision', d3.forceCollide().radius(35));
        } else {
            // Force-Directed
            this.archSimulation = d3.forceSimulation(nodes)
                .force('link', d3.forceLink(edges).id(d => d.nodeKey).distance(100))
                .force('charge', d3.forceManyBody().strength(-350))
                .force('center', d3.forceCenter(width / 2, height / 2))
                .force('collision', d3.forceCollide().radius(30));
        }

        // Arrow marker definition
        this.archSvg.append('defs').append('marker')
            .attr('id', 'arch-arrow')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 22)
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', 'var(--border-hover)');

        // Links
        const link = this.archG.append('g')
            .attr('class', 'arch-links')
            .selectAll('line')
            .data(edges)
            .enter().append('line')
            .attr('class', d => `d3-link edge-${(d.relationshipType || 'contains').toLowerCase()}`)
            .attr('stroke-width', 1.5)
            .attr('marker-end', 'url(#arch-arrow)');

        // Nodes
        const node = this.archG.append('g')
            .attr('class', 'arch-nodes')
            .selectAll('g')
            .data(nodes)
            .enter().append('g')
            .attr('class', 'd3-node-group')
            .call(d3.drag()
                .on('start', (event) => {
                    if (!event.active) this.archSimulation.alphaTarget(0.3).restart();
                    event.subject.fx = event.subject.x;
                    event.subject.fy = event.subject.y;
                })
                .on('drag', (event) => {
                    event.subject.fx = event.x;
                    event.subject.fy = event.y;
                })
                .on('end', (event) => {
                    if (!event.active) this.archSimulation.alphaTarget(0);
                    event.subject.fx = null;
                    event.subject.fy = null;
                }));

        // Node Circles with color based on nodeType
        node.append('circle')
            .attr('class', d => `d3-node node-${(d.nodeType || 'class').toLowerCase()}`)
            .attr('r', d => {
                if (d.nodeType === 'REPOSITORY') return 16;
                if (d.nodeType === 'CONTROLLER' || d.nodeType === 'SERVICE' || d.nodeType === 'ENTITY') return 13;
                if (d.nodeType === 'PACKAGE' || d.nodeType === 'MODULE') return 12;
                return 9;
            })
            .attr('stroke', 'var(--bg-surface)')
            .attr('stroke-width', 2)
            .on('click', (event, d) => {
                event.stopPropagation();
                this.inspectArchNode(d, repo, edges);
            });

        // Node Labels
        node.append('text')
            .attr('class', 'd3-node-label')
            .attr('dx', 14)
            .attr('dy', 4)
            .text(d => d.name);

        this.archSimulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node
                .attr('transform', d => `translate(${d.x}, ${d.y})`);
        });
    },

    inspectArchNode(node, repo, allEdges) {
        const drawer = document.getElementById('arch-inspector-drawer');
        const body = document.getElementById('arch-inspector-body');
        if (!drawer || !body) return;

        this.selectedArchNode = node;
        drawer.classList.add('open');

        let annotations = [];
        try {
            annotations = JSON.parse(node.annotationsJson || '[]');
        } catch (e) {}

        const incoming = allEdges.filter(e => {
            const tKey = typeof e.target === 'object' ? e.target.nodeKey : e.targetNodeKey;
            return tKey === node.nodeKey;
        });

        const outgoing = allEdges.filter(e => {
            const sKey = typeof e.source === 'object' ? e.source.nodeKey : e.sourceNodeKey;
            return sKey === node.nodeKey;
        });

        let githubLinkHtml = '';
        if (node.filePath && node.filePath !== '/' && repo.repoUrl) {
            const branch = repo.defaultBranch || 'main';
            let lineAnchor = '';
            if (node.startLine) {
                lineAnchor = node.endLine && node.endLine > node.startLine 
                    ? `#L${node.startLine}-L${node.endLine}` 
                    : `#L${node.startLine}`;
            }
            const githubUrl = `${repo.repoUrl}/blob/${branch}/${node.filePath}${lineAnchor}`;
            githubLinkHtml = `
                <a href="${escapeHtml(githubUrl)}" target="_blank" rel="noopener" class="btn btn-primary btn-sm" style="width: 100%; margin-top: 12px; gap: 6px;">
                    ${Icons.code(14)} View Source on GitHub ${Icons.externalLink(12)}
                </a>
            `;
        }

        body.innerHTML = `
            <div style="margin-bottom: 12px;">
                <div style="font-size: 15px; font-weight: 700; color: var(--text-primary);">${escapeHtml(node.name)}</div>
                <div style="margin-top: 4px;">
                    <span class="badge badge-neutral" style="font-weight: 600;">${escapeHtml(node.nodeType)}</span>
                    <span class="evidence-badge evidence-level-1">${escapeHtml(node.evidenceConfidence || 'VERIFIED')}</span>
                </div>
            </div>

            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 14px; line-height: 1.5;">
                <div>Package: <code>${escapeHtml(node.packageOrModule || 'default')}</code></div>
                ${node.filePath ? `<div>File: <code>${escapeHtml(node.filePath)}</code></div>` : ''}
                ${node.startLine ? `<div>Location: <strong>Lines ${node.startLine}–${node.endLine || node.startLine}</strong></div>` : ''}
            </div>

            ${annotations.length > 0 ? `
                <div style="margin-bottom: 14px;">
                    <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px;">Detected Annotations</div>
                    <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                        ${annotations.map(a => `<span class="version-tag" style="background: var(--bg-subtle); color: var(--brand-text); font-weight: 600;">${escapeHtml(a)}</span>`).join('')}
                    </div>
                </div>
            ` : ''}

            <!-- Relationships Breakdown -->
            <div style="margin-bottom: 14px;">
                <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px;">
                    Outgoing Relationships (${outgoing.length})
                </div>
                ${outgoing.length > 0 ? outgoing.map(e => `
                    <div style="font-size: 11.5px; padding: 4px 6px; background: var(--bg-subtle); border-radius: var(--radius-xs); margin-bottom: 4px; display: flex; justify-content: space-between;">
                        <span style="font-weight: 600; color: var(--text-secondary);">${escapeHtml(e.relationshipType)}</span>
                        <span style="color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px;">${escapeHtml(typeof e.target === 'object' ? e.target.name : e.targetNodeKey)}</span>
                    </div>
                `).join('') : '<div style="font-size: 11px; color: var(--text-subtle);">None</div>'}
            </div>

            <div style="margin-bottom: 14px;">
                <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px;">
                    Incoming Relationships (${incoming.length})
                </div>
                ${incoming.length > 0 ? incoming.map(e => `
                    <div style="font-size: 11.5px; padding: 4px 6px; background: var(--bg-subtle); border-radius: var(--radius-xs); margin-bottom: 4px; display: flex; justify-content: space-between;">
                        <span style="font-weight: 600; color: var(--text-secondary);">${escapeHtml(e.relationshipType)}</span>
                        <span style="color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px;">${escapeHtml(typeof e.source === 'object' ? e.source.name : e.sourceNodeKey)}</span>
                    </div>
                `).join('') : '<div style="font-size: 11px; color: var(--text-subtle);">None</div>'}
            </div>

            ${githubLinkHtml}
        `;
    },

    highlightArchNode(query) {
        if (!this.archSvg) return;
        const nodes = this.archSvg.selectAll('.d3-node');
        const labels = this.archSvg.selectAll('.d3-node-label');

        if (!query) {
            nodes.attr('opacity', 1);
            labels.attr('opacity', 1);
            return;
        }

        nodes.each(function(d) {
            const match = d.name && d.name.toLowerCase().includes(query);
            d3.select(this)
                .attr('opacity', match ? 1 : 0.2)
                .attr('stroke-width', match ? 3.5 : 2);
        });

        labels.each(function(d) {
            const match = d.name && d.name.toLowerCase().includes(query);
            d3.select(this).attr('opacity', match ? 1 : 0.2);
        });
    }
};
