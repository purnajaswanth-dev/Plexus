/**
 * Page 1: Engineering Overview Controller
 */
const OverviewPage = {
    async render(container) {
        container.innerHTML = `
            <div class="page-header">
                <div class="page-title-group">
                    <h1>Engineering Overview</h1>
                    <p>Cross-repository dependency monitoring, health intelligence, and upgrade risk mapping.</p>
                </div>
                <div class="page-header-actions">
                    <span id="overview-last-indexed" class="badge badge-neutral" style="font-size: 12px; padding: 6px 12px;">
                        Checking index status...
                    </span>
                    <button class="btn btn-secondary btn-sm" id="overview-refresh-btn">
                        ${Icons.refresh(14)} Refresh
                    </button>
                </div>
            </div>

            <!-- KPI Metric Cards -->
            <div class="kpi-grid" id="overview-kpi-grid">
                <div class="kpi-card skeleton-card skeleton"></div>
                <div class="kpi-card skeleton-card skeleton"></div>
                <div class="kpi-card skeleton-card skeleton"></div>
                <div class="kpi-card skeleton-card skeleton"></div>
            </div>

            <!-- Overview Content Grid -->
            <div class="overview-grid">
                <!-- Section A: Repository Health Distribution -->
                <div class="overview-card" id="card-health-dist">
                    <div class="card-header-row">
                        <div>
                            <h3 class="card-title">${Icons.dashboard(16)} Repository Health Distribution</h3>
                            <div class="card-subtitle">Ecosystem stability score based on manifest integrity & version hygiene</div>
                        </div>
                    </div>
                    <div id="health-dist-content">
                        <div class="skeleton skeleton-rect" style="height: 12px; margin: 16px 0;"></div>
                        <div class="skeleton skeleton-rect" style="height: 60px;"></div>
                    </div>
                </div>

                <!-- Section B: Most Widely Used Dependencies -->
                <div class="overview-card" id="card-top-deps">
                    <div class="card-header-row">
                        <div>
                            <h3 class="card-title">${Icons.explorer(16)} Most Widely Used Dependencies</h3>
                            <div class="card-subtitle">Highest cross-repo shared libraries in your organization</div>
                        </div>
                        <button class="btn btn-secondary btn-sm" id="btn-view-all-deps">View Explorer ${Icons.chevronRight(12)}</button>
                    </div>
                    <div id="top-deps-content">
                        <div class="skeleton skeleton-text" style="width: 100%; height: 36px; margin-bottom: 8px;"></div>
                        <div class="skeleton skeleton-text" style="width: 100%; height: 36px; margin-bottom: 8px;"></div>
                        <div class="skeleton skeleton-text" style="width: 100%; height: 36px;"></div>
                    </div>
                </div>

                <!-- Section C: Recent Repository Activity -->
                <div class="overview-card" id="card-recent-activity">
                    <div class="card-header-row">
                        <div>
                            <h3 class="card-title">${Icons.repos(16)} Recent Repository Activity</h3>
                            <div class="card-subtitle">Latest indexing operations and dependency extractions</div>
                        </div>
                        <button class="btn btn-secondary btn-sm" id="btn-view-all-repos">All Repos ${Icons.chevronRight(12)}</button>
                    </div>
                    <div id="recent-activity-content">
                        <div class="skeleton skeleton-text" style="width: 100%; height: 36px; margin-bottom: 8px;"></div>
                        <div class="skeleton skeleton-text" style="width: 100%; height: 36px; margin-bottom: 8px;"></div>
                    </div>
                </div>

                <!-- Section D: Attention Required -->
                <div class="overview-card" id="card-attention">
                    <div class="card-header-row">
                        <div>
                            <h3 class="card-title" style="color: var(--status-warning-text);">${Icons.impact(16)} Attention Required</h3>
                            <div class="card-subtitle">Repositories with failed manifests, missing versions, or hygiene warnings</div>
                        </div>
                    </div>
                    <div id="attention-content">
                        <div class="skeleton skeleton-text" style="width: 100%; height: 48px; margin-bottom: 8px;"></div>
                        <div class="skeleton skeleton-text" style="width: 100%; height: 48px;"></div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('overview-refresh-btn').onclick = () => this.loadData();
        document.getElementById('btn-view-all-deps').onclick = () => App.navigateTo('explorer');
        document.getElementById('btn-view-all-repos').onclick = () => App.navigateTo('repositories');

        await this.loadData();
    },

    async loadData() {
        try {
            const data = await API.getOverview();
            State.overviewData = data;
            this.renderKPIs(data);
            this.renderHealthDistribution(data);
            this.renderTopDependencies(data);
            this.renderRecentActivity(data);
            this.renderAttentionRequired(data);

            const lastIndexedEl = document.getElementById('overview-last-indexed');
            if (lastIndexedEl) {
                if (data.lastIndexed) {
                    lastIndexedEl.innerHTML = `${Icons.refresh(12)} Last sync: ${Components.formatDate(data.lastIndexed)}`;
                    lastIndexedEl.title = Components.formatExactDateTime(data.lastIndexed);
                } else {
                    lastIndexedEl.innerText = 'No sync record yet';
                }
            }
        } catch (error) {
            Components.Toast.error(`Failed to load overview data: ${error.message}`);
        }
    },

    renderKPIs(data) {
        const grid = document.getElementById('overview-kpi-grid');
        if (!grid) return;

        grid.innerHTML = `
            <div class="kpi-card" style="cursor: pointer;" onclick="App.navigateTo('repositories')">
                <div class="kpi-header">
                    <span class="kpi-label">Indexed Repositories</span>
                    <div class="kpi-icon-wrap">${Icons.repos(16)}</div>
                </div>
                <div class="kpi-value">${data.indexedRepositories} <span style="font-size: 15px; font-weight: 500; color: var(--text-muted);">/ ${data.totalRepositories}</span></div>
                <div class="kpi-subtext">
                    ${data.failedRepositories > 0 
                        ? `<span style="color: var(--status-danger-dot); font-weight: 600;">${data.failedRepositories} failed indexing</span>` 
                        : `<span style="color: var(--status-success-dot); font-weight: 600;">100% indexed</span>`}
                </div>
            </div>

            <div class="kpi-card" style="cursor: pointer;" onclick="App.navigateTo('explorer')">
                <div class="kpi-header">
                    <span class="kpi-label">Total Dependencies</span>
                    <div class="kpi-icon-wrap">${Icons.explorer(16)}</div>
                </div>
                <div class="kpi-value">${data.totalDependencies.toLocaleString()}</div>
                <div class="kpi-subtext">Discovered across all repository manifests</div>
            </div>

            <div class="kpi-card" style="cursor: pointer;" onclick="App.navigateTo('explorer')">
                <div class="kpi-header">
                    <span class="kpi-label">Unique Libraries</span>
                    <div class="kpi-icon-wrap">${Icons.dashboard(16)}</div>
                </div>
                <div class="kpi-value">${data.uniqueLibraries.toLocaleString()}</div>
                <div class="kpi-subtext">Distinct packages (Maven & npm)</div>
            </div>

            <div class="kpi-card" style="cursor: pointer;" onclick="RepositoriesPage.filterByStatus('FAILED')">
                <div class="kpi-header">
                    <span class="kpi-label">Requiring Attention</span>
                    <div class="kpi-icon-wrap" style="color: var(--status-warning-dot);">${Icons.impact(16)}</div>
                </div>
                <div class="kpi-value" style="color: ${data.attentionCount > 0 ? 'var(--status-warning-text)' : 'var(--text-primary)'};">${data.attentionCount}</div>
                <div class="kpi-subtext">
                    ${data.attentionCount > 0 ? 'Repositories with warnings or failures' : 'All repositories in optimal health'}
                </div>
            </div>
        `;
    },

    renderHealthDistribution(data) {
        const container = document.getElementById('health-dist-content');
        if (!container) return;

        const dist = data.healthDistribution || { healthy: 0, moderate: 0, critical: 0 };
        const total = (dist.healthy + dist.moderate + dist.critical) || 1;

        const healthyPct = ((dist.healthy / total) * 100).toFixed(1);
        const moderatePct = ((dist.moderate / total) * 100).toFixed(1);
        const criticalPct = ((dist.critical / total) * 100).toFixed(1);

        container.innerHTML = `
            <div class="health-dist-bar" title="Healthy: ${dist.healthy}, Moderate: ${dist.moderate}, Critical: ${dist.critical}">
                <div class="health-dist-segment segment-healthy" style="width: ${healthyPct}%;" onclick="RepositoriesPage.filterByRating('Healthy')"></div>
                <div class="health-dist-segment segment-moderate" style="width: ${moderatePct}%;" onclick="RepositoriesPage.filterByRating('Moderate')"></div>
                <div class="health-dist-segment segment-critical" style="width: ${criticalPct}%;" onclick="RepositoriesPage.filterByRating('Critical')"></div>
            </div>

            <div class="health-legend-grid">
                <div class="health-legend-item" onclick="RepositoriesPage.filterByRating('Healthy')" title="Click to filter healthy repositories">
                    <div class="health-legend-header">
                        <span class="badge-dot" style="background-color: var(--status-success-dot);"></span>
                        <span>Healthy</span>
                    </div>
                    <div class="health-legend-count" style="color: var(--status-success-text);">${dist.healthy}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">${healthyPct}% of repos</div>
                </div>

                <div class="health-legend-item" onclick="RepositoriesPage.filterByRating('Moderate')" title="Click to filter moderate health repositories">
                    <div class="health-legend-header">
                        <span class="badge-dot" style="background-color: var(--status-warning-dot);"></span>
                        <span>Moderate</span>
                    </div>
                    <div class="health-legend-count" style="color: var(--status-warning-text);">${dist.moderate}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">${moderatePct}% of repos</div>
                </div>

                <div class="health-legend-item" onclick="RepositoriesPage.filterByRating('Critical')" title="Click to filter critical repositories">
                    <div class="health-legend-header">
                        <span class="badge-dot" style="background-color: var(--status-danger-dot);"></span>
                        <span>Critical</span>
                    </div>
                    <div class="health-legend-count" style="color: var(--status-danger-text);">${dist.critical}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">${criticalPct}% of repos</div>
                </div>
            </div>
        `;
    },

    renderTopDependencies(data) {
        const container = document.getElementById('top-deps-content');
        if (!container) return;

        const deps = data.topDependencies || [];
        if (deps.length === 0) {
            container.innerHTML = Components.renderEmptyState({
                title: 'No shared dependencies found',
                description: 'Index multiple repositories to detect and cross-reference shared libraries.'
            });
            return;
        }

        container.innerHTML = `
            <div class="top-deps-list">
                ${deps.map(d => `
                    <div class="top-dep-item" onclick="ExplorerPage.inspectDependency('${escapeHtml(d.artifactId)}', '${escapeHtml(d.groupId || '')}', '${escapeHtml(d.packageType)}')">
                        <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                            ${Components.formatEcosystemBadge(d.packageType)}
                            <span class="top-dep-name" title="${escapeHtml(d.displayName)}">${escapeHtml(d.displayName)}</span>
                        </div>
                        <div class="top-dep-meta">
                            <span class="badge badge-neutral">${d.repoCount} ${d.repoCount === 1 ? 'repo' : 'repos'}</span>
                            <span class="badge ${d.versionCount > 1 ? 'badge-warning' : 'badge-safe'}" title="${d.versions ? d.versions.join(', ') : ''}">
                                ${d.versionCount} ${d.versionCount === 1 ? 'version' : 'versions'}
                            </span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    renderRecentActivity(data) {
        const container = document.getElementById('recent-activity-content');
        if (!container) return;

        const activity = data.recentActivity || [];
        if (activity.length === 0) {
            container.innerHTML = Components.renderEmptyState({
                title: 'No recent indexing activity',
                description: 'Add a GitHub repository to trigger the initial dependency extraction pipeline.'
            });
            return;
        }

        container.innerHTML = `
            <div class="activity-list">
                ${activity.map(item => `
                    <div class="activity-item" style="cursor: pointer;" onclick="RepositoriesPage.openDetailDrawer(${item.id})">
                        <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                            <span style="color: var(--text-muted);">${Icons.repos(16)}</span>
                            <div>
                                <div style="font-weight: 600; font-size: 13px; color: var(--text-primary);">${escapeHtml(item.repoName)}</div>
                                <div style="font-size: 11.5px; color: var(--text-muted);">
                                    ${item.dependencyCount} dependencies extracted • ${Components.formatDate(item.lastIndexed)}
                                </div>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            ${Components.formatEcosystemBadge(item.dependencyFileType)}
                            ${Components.formatStatusBadge(item.indexStatus)}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    renderAttentionRequired(data) {
        const container = document.getElementById('attention-content');
        if (!container) return;

        const attentionList = data.attentionRequired || [];
        if (attentionList.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 24px;">
                    <div class="empty-state-icon" style="background-color: var(--status-success-bg); color: var(--status-success-dot);">
                        ${Icons.check(24)}
                    </div>
                    <h4 class="empty-state-title" style="color: var(--status-success-text);">No Attention Items</h4>
                    <p class="empty-state-desc">All indexed repositories are currently healthy and properly configured.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 8px;">
                ${attentionList.slice(0, 5).map(item => `
                    <div class="attention-item ${item.rating === 'Critical' ? 'critical' : ''}">
                        <div class="attention-details">
                            <div class="attention-title" style="display: flex; align-items: center; justify-content: space-between;">
                                <span>${escapeHtml(item.repoName)}</span>
                                ${Components.formatHealthBadge(item.score, item.rating)}
                            </div>
                            <div class="attention-issue">
                                ${(item.issues && item.issues.length > 0) ? escapeHtml(item.issues[0]) : 'Health score below threshold'}
                            </div>
                        </div>
                        <button class="btn btn-secondary btn-sm" onclick="RepositoriesPage.openDetailDrawer(${item.id})">
                            Inspect
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    }
};

