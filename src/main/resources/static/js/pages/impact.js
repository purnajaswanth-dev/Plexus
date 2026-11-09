/**
 * Page 4: Dependency Impact Analysis Controller
 * Evaluates semantic version upgrade risks, potential breaking changes,
 * displays evidence-based architectural findings, and generates OpenPDF reports.
 */
const ImpactPage = {
    currentResult: null,

    async render(container) {
        container.innerHTML = `
            <div class="page-header">
                <div class="page-title-group">
                    <h1>Dependency Impact Analysis</h1>
                    <p>Evaluate semantic version upgrade risks, potential breaking changes, and cross-repo migration costs.</p>
                </div>
            </div>

            <!-- Methodology Disclaimer Banner -->
            <div class="impact-disclaimer">
                <span style="color: var(--brand-500);">${Icons.info(18)}</span>
                <div>
                    <strong>Heuristic Risk Assessment Note:</strong>
                    Impact levels (Breaking, Warning, Safe) are calculated using Semantic Versioning (SemVer) specifications and baseline delta heuristics. 
                    A "Breaking" classification indicates major version increments where breaking API modifications are customary, not byte-level compile failures.
                </div>
            </div>

            <!-- Analysis Configuration Card -->
            <div class="impact-config-card">
                <form id="impact-analysis-form">
                    <div class="impact-form-grid">
                        <div class="form-group" style="margin-bottom: 0;">
                            <label class="form-label" for="impact-ecosystem">Ecosystem</label>
                            <select class="form-select" id="impact-ecosystem">
                                <option value="MAVEN">Maven (Java)</option>
                                <option value="NPM">npm (JavaScript/TypeScript)</option>
                            </select>
                        </div>

                        <div class="form-group" style="margin-bottom: 0;" id="group-id-container">
                            <label class="form-label" for="impact-group">Group ID</label>
                            <input type="text" class="form-input" id="impact-group" placeholder="e.g. org.springframework">
                        </div>

                        <div class="form-group" style="margin-bottom: 0;">
                            <label class="form-label" for="impact-artifact">Artifact / Package Name *</label>
                            <input type="text" class="form-input" id="impact-artifact" placeholder="e.g. spring-web" required>
                        </div>

                        <div class="form-group" style="margin-bottom: 0;">
                            <label class="form-label" for="impact-from">Current / Baseline Version</label>
                            <input type="text" class="form-input" id="impact-from" placeholder="e.g. 5.3.20 (optional)">
                        </div>

                        <div class="form-group" style="margin-bottom: 0;">
                            <label class="form-label" for="impact-to">Target Version *</label>
                            <input type="text" class="form-input" id="impact-to" placeholder="e.g. 6.0.0" required>
                        </div>
                    </div>

                    <div style="margin-top: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                        <div id="impact-quick-suggestions" style="font-size: 12px; color: var(--text-muted); display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <span>Quick presets:</span>
                            <button type="button" class="btn btn-secondary btn-sm" onclick="ImpactPage.loadPreset('org.springframework.boot', 'spring-boot-starter-web', '3.0.0', '3.2.5', 'MAVEN')">Spring Boot 3.2.5</button>
                            <button type="button" class="btn btn-secondary btn-sm" onclick="ImpactPage.loadPreset('org.junit.jupiter', 'junit-jupiter-engine', '5.8.0', '5.10.0', 'MAVEN')">JUnit 5.10.0</button>
                            <button type="button" class="btn btn-secondary btn-sm" onclick="ImpactPage.loadPreset('express', 'express', '4.17.1', '5.0.0', 'NPM')">Express 5.0.0</button>
                        </div>

                        <button type="submit" class="btn btn-primary" id="btn-run-impact">
                            <span id="btn-run-impact-text">${Icons.impact(14)} Analyze Upgrade Impact</span>
                        </button>
                    </div>
                </form>
            </div>

            <!-- Loading Skeleton -->
            <div id="impact-loading" style="display: none; margin-bottom: 24px;">
                <div class="kpi-grid">
                    <div class="kpi-card skeleton skeleton-card"></div>
                    <div class="kpi-card skeleton skeleton-card"></div>
                    <div class="kpi-card skeleton skeleton-card"></div>
                    <div class="kpi-card skeleton skeleton-card"></div>
                </div>
            </div>

            <!-- Analysis Results Section -->
            <div id="impact-results-container" style="display: none;">
                <!-- Header Actions Bar (PDF Report & CSV Export) -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
                    <div>
                        <h2 style="font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 0 0 4px 0;" id="results-headline">
                            Impact Assessment Report
                        </h2>
                        <div style="font-size: 12.5px; color: var(--text-muted);" id="results-subheadline">
                            Comprehensive upgrade evaluation across indexed codebases
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <button class="btn btn-secondary btn-sm" id="btn-export-csv">
                            ${Icons.download(14)} Export CSV
                        </button>
                        <button class="btn btn-primary btn-sm" id="btn-generate-pdf">
                            ${Icons.fileText(14)} <span id="btn-pdf-text">Generate PDF Report</span>
                        </button>
                    </div>
                </div>

                <!-- Strategic Recommendation Banner -->
                <div id="recommendation-banner-container"></div>

                <!-- Summary Cards -->
                <div class="impact-summary-cards">
                    <div class="risk-card breaking">
                        <div class="risk-title">${Icons.impact(16)} Breaking Upgrades</div>
                        <div class="risk-count" id="risk-count-breaking" style="color: var(--status-danger-text);">0</div>
                        <div class="risk-percentage" id="risk-pct-breaking">0% of affected repos</div>
                    </div>

                    <div class="risk-card warning">
                        <div class="risk-title">${Icons.impact(16)} Warning Upgrades</div>
                        <div class="risk-count" id="risk-count-warning" style="color: var(--status-warning-text);">0</div>
                        <div class="risk-percentage" id="risk-pct-warning">0% of affected repos</div>
                    </div>

                    <div class="risk-card safe">
                        <div class="risk-title">${Icons.check(16)} Safe Upgrades</div>
                        <div class="risk-count" id="risk-count-safe" style="color: var(--status-success-text);">0</div>
                        <div class="risk-percentage" id="risk-pct-safe">0% of affected repos</div>
                    </div>

                    <div class="risk-card">
                        <div class="risk-title" style="color: var(--text-muted);">${Icons.repos(16)} Total Impacted</div>
                        <div class="risk-count" id="risk-count-total">0</div>
                        <div class="risk-percentage" id="risk-library-label">Across active repositories</div>
                    </div>
                </div>

                <!-- Visual Stacked Bar -->
                <div style="margin-bottom: 24px; background: var(--bg-surface); padding: 16px 20px; border-radius: var(--radius-lg); border: 1px solid var(--border-base);">
                    <div style="display: flex; justify-content: space-between; font-size: 12.5px; font-weight: 500; margin-bottom: 8px;">
                        <span>Risk Distribution Spectrum</span>
                        <span id="risk-summary-badge" class="badge badge-neutral">Analysis completed</span>
                    </div>
                    <div class="health-dist-bar" style="height: 14px; margin: 0;">
                        <div id="bar-breaking" class="health-dist-segment segment-critical" style="width: 0%;"></div>
                        <div id="bar-warning" class="health-dist-segment segment-moderate" style="width: 0%;"></div>
                        <div id="bar-safe" class="health-dist-segment segment-healthy" style="width: 0%;"></div>
                    </div>
                </div>

                <!-- Structured Evidence-Based Findings Section -->
                <div style="margin-bottom: 28px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                        <div>
                            <h3 style="margin: 0; font-size: 15px; font-weight: 600; color: var(--text-primary);">
                                Evidence-Based Findings & Architectural Signals
                            </h3>
                            <div style="font-size: 12px; color: var(--text-muted);">
                                Traceable static evidence identified across repository manifests and codebases
                            </div>
                        </div>
                        <span class="badge badge-neutral" id="findings-count-badge">0 findings</span>
                    </div>
                    <div id="findings-list-container"></div>
                </div>

                <!-- Impacted Repositories Table -->
                <div class="table-container">
                    <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-base);">
                        <h3 style="margin: 0 0 4px 0; font-size: 15px; font-weight: 600; color: var(--text-primary);">
                            Impacted Repositories Detail
                        </h3>
                        <div style="font-size: 12px; color: var(--text-muted);">
                            Specific impact classification, detected delta, and remediation action per codebase
                        </div>
                    </div>

                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Repository</th>
                                <th>Current Version</th>
                                <th>Target Version</th>
                                <th>Risk Classification</th>
                                <th>Heuristic Assessment Reason</th>
                                <th>Recommended Action</th>
                            </tr>
                        </thead>
                        <tbody id="impact-table-body"></tbody>
                    </table>
                </div>
            </div>

            <div id="impact-empty-state" style="margin-top: 32px;">
                ${Components.renderEmptyState({
                    icon: Icons.impact(32),
                    title: 'No analysis performed yet',
                    description: 'Select a library and specify target version above to run cross-repository impact evaluation.'
                })}
            </div>
        `;

        this.bindEvents();
    },

    bindEvents() {
        const form = document.getElementById('impact-analysis-form');
        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                await this.executeAnalysis();
            };
        }

        const ecoSelect = document.getElementById('impact-ecosystem');
        if (ecoSelect) {
            ecoSelect.onchange = (e) => {
                const groupContainer = document.getElementById('group-id-container');
                if (groupContainer) {
                    groupContainer.style.display = e.target.value === 'NPM' ? 'none' : 'block';
                }
            };
        }

        const exportCsvBtn = document.getElementById('btn-export-csv');
        if (exportCsvBtn) {
            exportCsvBtn.onclick = () => this.exportCsv();
        }

        const generatePdfBtn = document.getElementById('btn-generate-pdf');
        if (generatePdfBtn) {
            generatePdfBtn.onclick = () => this.generatePdf();
        }
    },

    loadPreset(groupId, artifactId, fromVersion, toVersion, packageType) {
        document.getElementById('impact-ecosystem').value = packageType;
        document.getElementById('impact-group').value = groupId;
        document.getElementById('impact-artifact').value = artifactId;
        document.getElementById('impact-from').value = fromVersion;
        document.getElementById('impact-to').value = toVersion;

        const groupContainer = document.getElementById('group-id-container');
        if (groupContainer) {
            groupContainer.style.display = packageType === 'NPM' ? 'none' : 'block';
        }

        this.executeAnalysis();
    },

    prefillAndNavigate(groupId, artifactId, fromVersion, packageType) {
        App.navigateTo('impact');
        setTimeout(() => {
            const ecoEl = document.getElementById('impact-ecosystem');
            const groupEl = document.getElementById('impact-group');
            const artEl = document.getElementById('impact-artifact');
            const fromEl = document.getElementById('impact-from');
            const groupContainer = document.getElementById('group-id-container');

            if (ecoEl) ecoEl.value = (packageType || 'MAVEN').toUpperCase();
            if (groupEl) groupEl.value = groupId || '';
            if (artEl) artEl.value = artifactId || '';
            if (fromEl) fromEl.value = fromVersion || '';
            if (groupContainer) {
                groupContainer.style.display = (packageType || '').toUpperCase() === 'NPM' ? 'none' : 'block';
            }

            // Calculate suggested next version
            const toEl = document.getElementById('impact-to');
            if (toEl && fromVersion) {
                const parts = fromVersion.split('.');
                if (parts.length > 0 && !isNaN(parseInt(parts[0]))) {
                    const nextMajor = parseInt(parts[0]) + 1;
                    toEl.value = `${nextMajor}.0.0`;
                } else {
                    toEl.value = '2.0.0';
                }
            } else if (toEl && !toEl.value) {
                toEl.value = '2.0.0';
            }

            if (artEl && toEl && toEl.value) {
                this.executeAnalysis();
            }
        }, 100);
    },

    async executeAnalysis() {
        const ecosystem = document.getElementById('impact-ecosystem').value;
        const groupId = document.getElementById('impact-group').value.trim();
        const artifactId = document.getElementById('impact-artifact').value.trim();
        const fromVersion = document.getElementById('impact-from').value.trim();
        const toVersion = document.getElementById('impact-to').value.trim();

        if (!artifactId) {
            Components.Toast.error('Please enter an artifact / library name');
            return;
        }
        if (!toVersion) {
            Components.Toast.error('Please enter a target upgrade version');
            return;
        }

        const runBtn = document.getElementById('btn-run-impact');
        const btnText = document.getElementById('btn-run-impact-text');
        const loading = document.getElementById('impact-loading');
        const resultsContainer = document.getElementById('impact-results-container');
        const emptyState = document.getElementById('impact-empty-state');

        runBtn.disabled = true;
        btnText.innerHTML = `<span class="btn-spinner"></span> Analyzing Codebases...`;
        loading.style.display = 'block';
        resultsContainer.style.display = 'none';
        emptyState.style.display = 'none';

        try {
            const payload = {
                groupId: ecosystem === 'NPM' ? 'npm' : groupId,
                artifactId,
                fromVersion,
                toVersion
            };

            const result = await API.analyzeImpact(payload);
            this.currentResult = result;
            this.renderResults(result);
            resultsContainer.style.display = 'block';
        } catch (error) {
            Components.Toast.error(`Analysis failed: ${error.message}`);
            emptyState.style.display = 'block';
        } finally {
            runBtn.disabled = false;
            btnText.innerHTML = `${Icons.impact(14)} Analyze Upgrade Impact`;
            loading.style.display = 'none';
        }
    },

    renderResults(result) {
        const total = result.totalAffectedRepos || 0;
        const breaking = result.breakingCount || 0;
        const warning = result.warningCount || 0;
        const safe = result.safeCount || 0;

        // Headline
        const headline = document.getElementById('results-headline');
        if (headline) {
            headline.innerText = `Upgrade Assessment: ${result.libraryName} → ${result.toVersion}`;
        }

        // Render Strategic Recommendation Banner
        this.renderRecommendationBanner(result);

        // Counts
        document.getElementById('risk-count-breaking').innerText = breaking;
        document.getElementById('risk-count-warning').innerText = warning;
        document.getElementById('risk-count-safe').innerText = safe;
        document.getElementById('risk-count-total').innerText = total;

        const breakingPct = total > 0 ? ((breaking / total) * 100).toFixed(0) : 0;
        const warningPct = total > 0 ? ((warning / total) * 100).toFixed(0) : 0;
        const safePct = total > 0 ? ((safe / total) * 100).toFixed(0) : 0;

        document.getElementById('risk-pct-breaking').innerText = `${breakingPct}% of affected repos`;
        document.getElementById('risk-pct-warning').innerText = `${warningPct}% of affected repos`;
        document.getElementById('risk-pct-safe').innerText = `${safePct}% of affected repos`;
        document.getElementById('risk-library-label').innerText = `Target: ${escapeHtml(result.libraryName)} → ${escapeHtml(result.toVersion)}`;

        // Spectrum Bar
        document.getElementById('bar-breaking').style.width = `${breakingPct}%`;
        document.getElementById('bar-warning').style.width = `${warningPct}%`;
        document.getElementById('bar-safe').style.width = `${safePct}%`;

        const summaryBadge = document.getElementById('risk-summary-badge');
        if (summaryBadge) {
            if (breaking > 0) {
                summaryBadge.className = 'badge badge-critical';
                summaryBadge.innerHTML = `<span class="badge-dot"></span>High Risk (${breaking} breaking)`;
            } else if (warning > 0) {
                summaryBadge.className = 'badge badge-warning';
                summaryBadge.innerHTML = `<span class="badge-dot"></span>Moderate Risk (${warning} warnings)`;
            } else {
                summaryBadge.className = 'badge badge-safe';
                summaryBadge.innerHTML = `<span class="badge-dot"></span>Low Risk (All safe)`;
            }
        }

        // Render Evidence Findings
        this.renderFindings(result.findings || []);

        // Table Body
        const tableBody = document.getElementById('impact-table-body');
        const repos = result.allImpactedRepos || [];

        if (repos.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 32px;">
                        No indexed repositories currently declare <strong>${escapeHtml(result.libraryName)}</strong>.
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = repos.map(r => `
            <tr>
                <td>
                    <a href="${escapeHtml(r.repoUrl || '#')}" target="_blank" rel="noopener" class="table-repo-link">
                        ${escapeHtml(r.repoName)} ${Icons.externalLink(12)}
                    </a>
                    <div style="font-size: 11px; color: var(--text-muted);">
                        Scope: <code>${escapeHtml(r.dependencyScope || 'compile')}</code>
                    </div>
                </td>
                <td>
                    <span class="version-tag">${escapeHtml(r.currentVersion)}</span>
                </td>
                <td>
                    <span class="version-tag" style="background: var(--brand-surface); color: var(--brand-text); border-color: var(--brand-border); font-weight: 600;">
                        ${escapeHtml(r.targetVersion)}
                    </span>
                </td>
                <td>${Components.formatRiskBadge(r.impactLevel)}</td>
                <td style="max-width: 320px; font-size: 12.5px; line-height: 1.4; color: var(--text-secondary);">
                    ${escapeHtml(r.reason)}
                </td>
                <td style="max-width: 320px; font-size: 12px; line-height: 1.4; color: var(--text-muted);">
                    ${escapeHtml(r.recommendedAction || 'Verify unit and integration test suite.')}
                </td>
            </tr>
        `).join('');
    },

    renderRecommendationBanner(result) {
        const container = document.getElementById('recommendation-banner-container');
        if (!container) return;

        const rec = result.overallRecommendation || 'PROCEED';
        const reason = result.recommendationReason || '';
        const exec = result.executiveSummary || '';
        const vDiff = result.versionDifference || 'DELTA';

        let bannerClass = 'banner-proceed';
        let iconHtml = Icons.check(24);
        if (rec === 'INVESTIGATE BEFORE UPGRADING') {
            bannerClass = 'banner-investigate';
            iconHtml = Icons.impact(24);
        } else if (rec === 'PROCEED WITH CAUTION') {
            bannerClass = 'banner-caution';
            iconHtml = Icons.info(24);
        }

        container.innerHTML = `
            <div class="recommendation-banner ${bannerClass}">
                <div style="flex-shrink: 0; margin-top: 2px;">
                    ${iconHtml}
                </div>
                <div style="flex-grow: 1;">
                    <div class="recommendation-title">
                        <span>Strategic Verdict: ${escapeHtml(rec)}</span>
                        <span class="badge badge-neutral" style="font-size: 11px; text-transform: uppercase;">
                            ${escapeHtml(vDiff)} UPGRADE
                        </span>
                    </div>
                    <div class="recommendation-reason">
                        ${escapeHtml(reason)}
                    </div>
                    ${exec ? `
                        <div class="recommendation-exec">
                            ${escapeHtml(exec)}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    },

    renderFindings(findings) {
        const container = document.getElementById('findings-list-container');
        const badge = document.getElementById('findings-count-badge');
        if (!container) return;

        if (badge) {
            badge.innerText = `${findings.length} findings`;
        }

        if (findings.length === 0) {
            container.innerHTML = `
                <div style="background: var(--bg-surface); border: 1px dashed var(--border-base); border-radius: var(--radius-md); padding: 18px; text-align: center; color: var(--text-muted); font-size: 13px;">
                    No potential breaking changes or divergence issues detected for this upgrade path.
                </div>
            `;
            return;
        }

        container.innerHTML = findings.map(f => {
            const level = f.evidenceLevel || 'LEVEL_1_DIRECTLY_DETECTED';
            let levelBadge = `<span class="evidence-badge evidence-level-1">Directly Detected</span>`;
            if (level === 'LEVEL_2_VERSION_BASED_INFERENCE') {
                levelBadge = `<span class="evidence-badge evidence-level-2">Version-Based Inference</span>`;
            } else if (level === 'LEVEL_3_VERIFIED_COMPATIBILITY') {
                levelBadge = `<span class="evidence-badge evidence-level-3">Verified Compatibility</span>`;
            }

            return `
                <div class="finding-card">
                    <div class="finding-header">
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <span class="finding-title">${escapeHtml(f.title)}</span>
                            <span class="badge badge-neutral" style="font-size: 10px; font-family: var(--font-mono);">${escapeHtml(f.category || 'SIGNAL')}</span>
                        </div>
                        <div>${levelBadge}</div>
                    </div>
                    <div style="font-size: 12.5px; color: var(--text-secondary); margin-bottom: 8px; line-height: 1.45;">
                        ${escapeHtml(f.explanation || '')}
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 16px; font-size: 11.5px; color: var(--text-muted); background: var(--bg-subtle); padding: 8px 12px; border-radius: var(--radius-sm);">
                        <div><strong>Repository:</strong> ${escapeHtml(f.affectedRepo || 'Global')}</div>
                        <div><strong>Source:</strong> <code>${escapeHtml(f.sourceLocation || 'manifest')}</code></div>
                        <div><strong>Transition:</strong> <code>${escapeHtml(f.currentValue || '')} → ${escapeHtml(f.targetValue || '')}</code></div>
                    </div>
                    ${f.exactEvidence ? `
                        <div style="margin-top: 8px; font-size: 11px; font-family: var(--font-mono); color: var(--text-muted); background: var(--bg-surface); border: 1px solid var(--border-subtle); padding: 6px 10px; border-radius: var(--radius-xs);">
                            <strong>Evidence:</strong> ${escapeHtml(f.exactEvidence)}
                        </div>
                    ` : ''}
                    ${f.recommendedAction ? `
                        <div style="margin-top: 8px; font-size: 12px; color: var(--brand-500); display: flex; align-items: center; gap: 6px;">
                            ${Icons.check(12)} <strong>Action:</strong> ${escapeHtml(f.recommendedAction)}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    },

    async generatePdf() {
        if (!this.currentResult) {
            Components.Toast.error('Please run an impact analysis before generating a PDF report.');
            return;
        }

        const btn = document.getElementById('btn-generate-pdf');
        const btnText = document.getElementById('btn-pdf-text');

        if (btn) btn.disabled = true;
        if (btnText) btnText.innerHTML = `<span class="btn-spinner"></span> Generating Report...`;

        try {
            const ecosystem = document.getElementById('impact-ecosystem').value;
            const groupId = document.getElementById('impact-group').value.trim();
            const artifactId = document.getElementById('impact-artifact').value.trim();
            const fromVersion = document.getElementById('impact-from').value.trim();
            const toVersion = document.getElementById('impact-to').value.trim();

            const payload = {
                groupId: ecosystem === 'NPM' ? 'npm' : groupId,
                artifactId,
                fromVersion,
                toVersion
            };

            const filename = await API.downloadPdfReport(payload);
            Components.Toast.success(`PDF report downloaded: ${filename}`);
        } catch (error) {
            Components.Toast.error(`PDF generation failed: ${error.message}`);
        } finally {
            if (btn) btn.disabled = false;
            if (btnText) btnText.innerHTML = `Generate PDF Report`;
        }
    },

    exportCsv() {
        if (!this.currentResult || !this.currentResult.allImpactedRepos) {
            Components.Toast.error('No analysis results available for export.');
            return;
        }

        const result = this.currentResult;
        const repos = result.allImpactedRepos;

        const headers = ['Repository', 'GitHub URL', 'Current Version', 'Target Version', 'Risk Classification', 'Dependency Scope', 'Assessment Reason', 'Recommended Action'];
        
        const rows = repos.map(r => [
            `"${(r.repoName || '').replace(/"/g, '""')}"`,
            `"${(r.repoUrl || '').replace(/"/g, '""')}"`,
            `"${(r.currentVersion || '').replace(/"/g, '""')}"`,
            `"${(r.targetVersion || '').replace(/"/g, '""')}"`,
            `"${(r.impactLevel || '').replace(/"/g, '""')}"`,
            `"${(r.dependencyScope || '').replace(/"/g, '""')}"`,
            `"${(r.reason || '').replace(/"/g, '""')}"`,
            `"${(r.recommendedAction || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        const cleanName = (result.libraryName || 'library').replace(/[^a-zA-Z0-9_-]/g, '_');
        link.setAttribute('href', url);
        link.setAttribute('download', `impact-analysis-${cleanName}-${result.toVersion}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        Components.Toast.success('CSV report exported successfully.');
    }
};
