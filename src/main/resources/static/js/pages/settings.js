/**
 * Page 6: Settings Controller
 */
const SettingsPage = {
    settingsData: null,

    async render(container) {
        container.innerHTML = `
            <div class="page-header">
                <div class="page-title-group">
                    <h1>Settings & Environment</h1>
                    <p>System runtime configuration, database status, GitHub API connectivity, and appearance preferences.</p>
                </div>
                <div class="page-header-actions">
                    <button class="btn btn-secondary btn-sm" id="settings-refresh-btn">
                        ${Icons.refresh(14)} Check Status
                    </button>
                </div>
            </div>

            <!-- Section 1: Appearance Preference -->
            <div class="settings-section">
                <h3 class="settings-section-title">Interface Appearance</h3>
                <div class="settings-section-desc">Select visual color theme for developer dashboard interface.</div>
                
                <div style="display: flex; gap: 12px; align-items: center;">
                    <button class="btn ${State.theme === 'light' ? 'btn-primary' : 'btn-secondary'}" id="theme-btn-light">
                        ${Icons.sun(16)} Light Theme (Default)
                    </button>
                    <button class="btn ${State.theme === 'dark' ? 'btn-primary' : 'btn-secondary'}" id="theme-btn-dark">
                        ${Icons.moon(16)} Dark Theme
                    </button>
                </div>
            </div>

            <!-- Section 2: Application & Runtime Environment -->
            <div class="settings-section">
                <h3 class="settings-section-title">Application & Runtime Environment</h3>
                <div class="settings-section-desc">Active backend runtime stack and database persistence layer.</div>

                <div class="settings-info-grid" id="settings-app-grid">
                    <div class="settings-info-box skeleton skeleton-card"></div>
                    <div class="settings-info-box skeleton skeleton-card"></div>
                    <div class="settings-info-box skeleton skeleton-card"></div>
                    <div class="settings-info-box skeleton skeleton-card"></div>
                </div>
            </div>

            <!-- Section 3: GitHub API Integration & Rate Limit -->
            <div class="settings-section">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                    <h3 class="settings-section-title">GitHub REST API Integration</h3>
                    <span id="github-status-badge" class="badge badge-neutral">Checking status...</span>
                </div>
                <div class="settings-section-desc">Upstream GitHub API connectivity, token authorization, and hourly rate limit consumption.</div>

                <div class="settings-info-grid" id="settings-github-grid">
                    <div class="settings-info-box skeleton skeleton-card"></div>
                    <div class="settings-info-box skeleton skeleton-card"></div>
                    <div class="settings-info-box skeleton skeleton-card"></div>
                </div>
                <div id="github-message-box" style="font-size: 12.5px; color: var(--text-muted); margin-top: 8px;"></div>
            </div>

            <!-- Section 4: Maintenance & Indexing Pipeline -->
            <div class="settings-section">
                <h3 class="settings-section-title">Maintenance & Indexing Operations</h3>
                <div class="settings-section-desc">Trigger batch repository re-indexing across all tracked projects.</div>

                <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background-color: var(--bg-subtle); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
                    <div>
                        <div style="font-weight: 600; font-size: 13.5px; color: var(--text-primary);">Re-index All Repositories</div>
                        <div style="font-size: 12px; color: var(--text-muted);">
                            Fetch latest manifest files (pom.xml & package.json) from GitHub default branches and update local MySQL dependency store.
                        </div>
                    </div>
                    <button class="btn btn-secondary" id="btn-reindex-all">
                        <span id="btn-reindex-all-text">${Icons.refresh(14)} Run Re-index All</span>
                    </button>
                </div>
            </div>
        `;

        this.bindEvents();
        await this.loadStatus();
    },

    bindEvents() {
        document.getElementById('settings-refresh-btn').onclick = () => this.loadStatus();

        document.getElementById('theme-btn-light').onclick = () => {
            State.setTheme('light');
            this.updateThemeButtons();
        };

        document.getElementById('theme-btn-dark').onclick = () => {
            State.setTheme('dark');
            this.updateThemeButtons();
        };

        document.getElementById('btn-reindex-all').onclick = () => this.handleReindexAll();
    },

    updateThemeButtons() {
        const lightBtn = document.getElementById('theme-btn-light');
        const darkBtn = document.getElementById('theme-btn-dark');
        if (lightBtn && darkBtn) {
            lightBtn.className = `btn ${State.theme === 'light' ? 'btn-primary' : 'btn-secondary'}`;
            darkBtn.className = `btn ${State.theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`;
        }
    },

    async loadStatus() {
        try {
            const data = await API.getSettingsStatus();
            this.settingsData = data;

            this.renderAppInfo(data);
            this.renderGitHubInfo(data.github);
        } catch (error) {
            Components.Toast.error(`Failed to load system settings: ${error.message}`);
        }
    },

    renderAppInfo(data) {
        const appGrid = document.getElementById('settings-app-grid');
        if (!appGrid) return;

        const app = data.application || {};
        const db = data.database || {};

        appGrid.innerHTML = `
            <div class="settings-info-box">
                <div class="settings-info-label">Application Version</div>
                <div class="settings-info-value">${escapeHtml(app.version || '1.0.0')}</div>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">${escapeHtml(app.platform || 'SaaS')}</div>
            </div>

            <div class="settings-info-box">
                <div class="settings-info-label">Runtime Platform</div>
                <div class="settings-info-value">Java ${escapeHtml(app.javaVersion || '17')}</div>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Spring Boot ${escapeHtml(app.springBootVersion || '3.2.5')}</div>
            </div>

            <div class="settings-info-box">
                <div class="settings-info-label">Database Persistence</div>
                <div class="settings-info-value" style="color: var(--status-success-text);">${escapeHtml(db.engine || 'MySQL')}</div>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Database: <code>${escapeHtml(db.database || 'impact_mapper_db')}</code></div>
            </div>

            <div class="settings-info-box">
                <div class="settings-info-label">Indexed Records</div>
                <div class="settings-info-value">${db.repositoriesCount || 0} repos / ${db.dependenciesCount || 0} deps</div>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Stored in MySQL table</div>
            </div>
        `;
    },

    renderGitHubInfo(github = {}) {
        const ghGrid = document.getElementById('settings-github-grid');
        const badge = document.getElementById('github-status-badge');
        const msgBox = document.getElementById('github-message-box');
        if (!ghGrid) return;

        const isOperational = github.status === 'OPERATIONAL' || github.status === 'UNAUTHENTICATED_FALLBACK';
        const isAuthenticated = Boolean(github.authenticated);

        if (badge) {
            if (isAuthenticated) {
                badge.className = 'badge badge-safe';
                badge.innerHTML = `<span class="badge-dot"></span>Authenticated (Token Active)`;
            } else if (github.status === 'UNAUTHENTICATED_FALLBACK') {
                badge.className = 'badge badge-warning';
                badge.innerHTML = `<span class="badge-dot"></span>Public Mode (Unauthenticated)`;
            } else if (github.status === 'RATE_LIMITED') {
                badge.className = 'badge badge-critical';
                badge.innerHTML = `<span class="badge-dot"></span>Rate Limited`;
            } else {
                badge.className = 'badge badge-neutral';
                badge.innerHTML = `<span class="badge-dot"></span>${escapeHtml(github.status || 'Unknown')}`;
            }
        }

        ghGrid.innerHTML = `
            <div class="settings-info-box">
                <div class="settings-info-label">Rate Limit Remaining</div>
                <div class="settings-info-value" style="color: ${(github.remaining || 0) < 10 ? 'var(--status-danger-text)' : 'var(--text-primary)'};">
                    ${github.remaining || 0} <span style="font-size: 13px; font-weight: 500; color: var(--text-muted);">/ ${github.limit || 60}</span>
                </div>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Requests available per hour</div>
            </div>

            <div class="settings-info-box">
                <div class="settings-info-label">Token Authentication</div>
                <div class="settings-info-value">
                    ${isAuthenticated ? 'Authenticated' : (github.tokenConfigured ? 'Fallback Mode' : 'Unauthenticated')}
                </div>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
                    ${isAuthenticated ? '5,000 req/hr allocation' : '60 req/hr public allocation'}
                </div>
            </div>

            <div class="settings-info-box">
                <div class="settings-info-label">Quota Reset Window</div>
                <div class="settings-info-value" style="font-size: 13px;">
                    ${github.resetTime ? Components.formatExactDateTime(github.resetTime) : 'N/A'}
                </div>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Hourly quota replenishment</div>
            </div>
        `;

        if (msgBox) {
            msgBox.innerText = github.message || '';
        }
    },

    handleReindexAll() {
        Components.ConfirmDialog.show({
            title: 'Re-index All Repositories',
            message: 'This will re-fetch manifest files from GitHub for every indexed repository. This process respects GitHub rate limits and may take several seconds. Do you want to proceed?',
            confirmText: 'Start Re-indexing',
            confirmClass: 'btn-primary',
            onConfirm: async () => {
                const btn = document.getElementById('btn-reindex-all');
                const btnText = document.getElementById('btn-reindex-all-text');

                if (btn) btn.disabled = true;
                if (btnText) btnText.innerHTML = `<span class="btn-spinner"></span> Re-indexing in progress...`;

                try {
                    const result = await API.reindexAll();
                    Components.Toast.success(`Successfully re-indexed ${result.reindexedCount || 0} repositories.`);
                    await this.loadStatus();
                } catch (error) {
                    Components.Toast.error(`Batch re-index failed: ${error.message}`);
                } finally {
                    if (btn) btn.disabled = false;
                    if (btnText) btnText.innerHTML = `${Icons.refresh(14)} Run Re-index All`;
                }
            }
        });
    }
};

