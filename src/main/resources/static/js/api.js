/**
 * API Client Module
 * Communicates with Spring Boot REST endpoints
 */
const API = {
    baseUrl: '/api',

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const token = (typeof window !== 'undefined' && window.__SUPABASE_ACCESS_TOKEN__) || null;
        const headers = {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...(options.headers || {})
        };

        try {
            const response = await fetch(url, { ...options, headers });
            
            if (response.status === 204) {
                return null;
            }

            if (response.status === 401) {
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('supabase-auth-expired', {
                        detail: { status: 401, endpoint }
                    }));
                }
            }

            const data = await response.json().catch(() => null);

            if (!response.ok) {
                let message;
                if (data && data.error === 'RESOURCE_LIMIT_EXCEEDED') {
                    message = `Free Tier Limit: ${data.message}`;
                } else if (data && data.error === 'CONCURRENCY_LIMIT_REACHED') {
                    message = `Server Busy: ${data.message}`;
                } else if (data && data.error) {
                    message = data.error;
                } else {
                    message = `HTTP ${response.status}: ${response.statusText}`;
                }
                throw new Error(message);
            }

            return data;
        } catch (error) {
            console.error(`API Request failed [${endpoint}]:`, error);
            throw error;
        }
    },

    // Overview API
    getOverview() {
        return this.request('/overview');
    },

    // Repositories API
    getRepositories() {
        return this.request('/repos');
    },

    getRepository(id) {
        return this.request(`/repos/${id}`);
    },

    addRepository(githubUrl) {
        return this.request('/repos', {
            method: 'POST',
            body: JSON.stringify({ githubUrl })
        });
    },

    reindexRepository(id) {
        return this.request(`/repos/${id}/reindex`, {
            method: 'POST'
        });
    },

    deleteRepository(id) {
        return this.request(`/repos/${id}`, {
            method: 'DELETE'
        });
    },

    reindexAll() {
        return this.request('/repos/reindex-all', {
            method: 'POST'
        });
    },

    // Architecture Intelligence API
    getArchitecture(repoId, level = 3) {
        return this.request(`/repos/${repoId}/architecture?level=${level}`);
    },

    reindexArchitecture(repoId) {
        return this.request(`/repos/${repoId}/architecture/reindex`, {
            method: 'POST'
        });
    },

    getArchitectureStatus() {
        return this.request('/architecture/status');
    },

    backfillArchitecture(repoIds = null) {
        return this.request('/architecture/backfill', {
            method: 'POST',
            body: JSON.stringify(repoIds ? { repoIds } : {})
        });
    },

    // Dependencies API
    getDependencies(params = {}) {
        const query = new URLSearchParams();
        if (params.q) query.set('q', params.q);
        if (params.type && params.type !== 'ALL') query.set('type', params.type);
        if (params.consistency && params.consistency !== 'ALL') query.set('consistency', params.consistency);
        if (params.repoId) query.set('repoId', params.repoId);
        
        const qs = query.toString() ? `?${query.toString()}` : '';
        return this.request(`/dependencies${qs}`);
    },

    getDependencyDetail(artifactId, groupId = '', packageType = '') {
        const query = new URLSearchParams({ artifactId });
        if (groupId) query.set('groupId', groupId);
        if (packageType) query.set('packageType', packageType);
        return this.request(`/dependencies/detail?${query.toString()}`);
    },

    // Impact Analysis API
    analyzeImpact(payload) {
        return this.request('/impact/analyze', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    },

    async downloadPdfReport(payload) {
        const url = `${this.baseUrl}/impact/report/pdf`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: 'PDF generation failed' }));
            throw new Error(err.error || 'Failed to generate PDF report');
        }

        const blob = await response.blob();
        const contentDisp = response.headers.get('Content-Disposition') || '';
        let filename = 'dependency-impact-assessment.pdf';
        const filenameMatch = contentDisp.match(/filename="?([^";]+)"?/);
        if (filenameMatch && filenameMatch[1]) {
            filename = filenameMatch[1];
        }

        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        return filename;
    },

    searchLibrary(artifactId) {
        return this.request(`/impact/library/${encodeURIComponent(artifactId)}`);
    },

    // Graph Network API
    getGraphData() {
        return this.request('/graph/repositories');
    },

    getBipartiteGraph() {
        return this.request('/graph/bipartite');
    },

    // Settings API
    getSettingsStatus() {
        return this.request('/settings/status');
    }
};
