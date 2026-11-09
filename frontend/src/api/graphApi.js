/**
 * Relative Graph API Client
 * Seamlessly interfaces with Spring Boot backend endpoints
 */
export const graphApi = {
  getAuthHeaders(customHeaders = {}) {
    const headers = { ...customHeaders };
    const token = (typeof window !== 'undefined' && window.__SUPABASE_ACCESS_TOKEN__) || null;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  },

  async fetchWithAuth(url, options = {}) {
    const headers = this.getAuthHeaders(options.headers);
    return fetch(url, { ...options, headers });
  },

  async fetchRepositories() {
    const res = await this.fetchWithAuth('/api/repos');
    if (!res.ok) throw new Error(`Failed to load repositories: ${res.statusText}`);
    return res.json();
  },

  async fetchArchitecture(repoId, level = 3) {
    const res = await this.fetchWithAuth(`/api/repos/${repoId}/architecture?level=${level}`);
    if (!res.ok) throw new Error(`Failed to load repository architecture: ${res.statusText}`);
    return res.json();
  },

  async reindexArchitecture(repoId) {
    const res = await this.fetchWithAuth(`/api/repos/${repoId}/architecture/reindex`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error(`Failed to re-analyze architecture: ${res.statusText}`);
    return res.json();
  },

  async fetchBipartiteGraph() {
    const res = await this.fetchWithAuth('/api/graph/bipartite');
    if (!res.ok) throw new Error(`Failed to load dependency ecosystem: ${res.statusText}`);
    return res.json();
  },

  async fetchRepositoryRelationships() {
    const res = await this.fetchWithAuth('/api/graph/repositories');
    if (!res.ok) throw new Error(`Failed to load repository relationships: ${res.statusText}`);
    return res.json();
  }
};

