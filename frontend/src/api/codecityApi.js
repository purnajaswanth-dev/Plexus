/**
 * CodeCity API Client
 */
export const codecityApi = {
  baseUrl: '/api/codecity',

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

  async getRepositoryCities() {
    const res = await this.fetchWithAuth(`${this.baseUrl}/repositories`);
    if (!res.ok) throw new Error(`Failed to load repository cities: ${res.statusText}`);
    return res.json();
  },

  async getCityModel(repositoryId) {
    const res = await this.fetchWithAuth(`${this.baseUrl}/repositories/${repositoryId}/city`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error((err && err.error) || `Failed to load city model: ${res.statusText}`);
    }
    return res.json();
  },

  async getEndpoints(repositoryId) {
    const res = await this.fetchWithAuth(`${this.baseUrl}/repositories/${repositoryId}/endpoints`);
    if (!res.ok) throw new Error(`Failed to load endpoints: ${res.statusText}`);
    return res.json();
  },

  async getApis(repositoryId, { search, method, category, auth, status } = {}) {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (method && method !== 'ALL') params.append('method', method);
    if (category && category !== 'ALL') params.append('category', category);
    if (auth && auth !== 'ALL') params.append('auth', auth);
    if (status && status !== 'ALL') params.append('status', status);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await this.fetchWithAuth(`${this.baseUrl}/repositories/${repositoryId}/apis${qs}`);
    if (!res.ok) throw new Error(`Failed to load APIs: ${res.statusText}`);
    return res.json();
  },

  async getApiDetail(repositoryId, endpointId) {
    const res = await this.fetchWithAuth(`${this.baseUrl}/repositories/${repositoryId}/apis/${endpointId}`);
    if (!res.ok) throw new Error(`Failed to load API details: ${res.statusText}`);
    return res.json();
  },

  async getApiCoverage(repositoryId) {
    const res = await this.fetchWithAuth(`${this.baseUrl}/repositories/${repositoryId}/apis/coverage`);
    if (!res.ok) throw new Error(`Failed to load API coverage: ${res.statusText}`);
    return res.json();
  },

  async getApisReachingMethod(repositoryId, methodKey) {
    const res = await this.fetchWithAuth(`${this.baseUrl}/repositories/${repositoryId}/methods/${encodeURIComponent(methodKey)}/apis`);
    if (!res.ok) throw new Error(`Failed to load APIs reaching method: ${res.statusText}`);
    return res.json();
  },

  async getFrontendApiUsage(repositoryId) {
    const res = await this.fetchWithAuth(`${this.baseUrl}/repositories/${repositoryId}/frontend-apis`);
    if (!res.ok) throw new Error(`Failed to load frontend API usage: ${res.statusText}`);
    return res.json();
  },

  async getStaticExecutionPath(repositoryId, endpointId) {
    const res = await this.fetchWithAuth(`${this.baseUrl}/repositories/${repositoryId}/endpoints/${endpointId}/path`);
    if (!res.ok) throw new Error(`Failed to load execution path: ${res.statusText}`);
    return res.json();
  },

  async getJourneyGraph(repositoryId, endpointId, mode = 'STATIC') {
    const res = await this.fetchWithAuth(`${this.baseUrl}/repositories/${repositoryId}/endpoints/${endpointId}/journey?mode=${encodeURIComponent(mode)}`);
    if (!res.ok) throw new Error(`Failed to load journey graph: ${res.statusText}`);
    return res.json();
  },

  async getComponentDetail(repositoryId, nodeKey) {
    const res = await this.fetchWithAuth(`${this.baseUrl}/repositories/${repositoryId}/components?nodeKey=${encodeURIComponent(nodeKey)}`);
    if (!res.ok) throw new Error(`Failed to load component details: ${res.statusText}`);
    return res.json();
  },

  async getArchitectureIntelligence(repositoryId) {
    const res = await this.fetchWithAuth(`${this.baseUrl}/repositories/${repositoryId}/intelligence`);
    if (!res.ok) throw new Error(`Failed to load architecture intelligence: ${res.statusText}`);
    return res.json();
  },

  async getTraces(repositoryId) {
    const res = await this.fetchWithAuth(`${this.baseUrl}/repositories/${repositoryId}/traces`);
    if (!res.ok) throw new Error(`Failed to load traces: ${res.statusText}`);
    return res.json();
  },

  async getTraceDetail(repositoryId, traceId) {
    const res = await this.fetchWithAuth(`${this.baseUrl}/repositories/${repositoryId}/traces/${encodeURIComponent(traceId)}`);
    if (!res.ok) throw new Error(`Failed to load trace detail: ${res.statusText}`);
    return res.json();
  },

  async ingestTrace(traceData) {
    const res = await this.fetchWithAuth(`${this.baseUrl}/traces/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(traceData)
    });
    if (!res.ok) throw new Error(`Failed to ingest trace: ${res.statusText}`);
    return res.json();
  },

  async generateCity(repositoryId) {
    const res = await this.fetchWithAuth(`${this.baseUrl}/repositories/${repositoryId}/generate`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error(`Failed to generate city: ${res.statusText}`);
    return res.json();
  },

  async getSourceSnippet(repositoryId, filePath, startLine = null, endLine = null) {
    let url = `${this.baseUrl}/repositories/${repositoryId}/source?filePath=${encodeURIComponent(filePath)}`;
    if (startLine != null) url += `&startLine=${startLine}`;
    if (endLine != null) url += `&endLine=${endLine}`;
    const res = await this.fetchWithAuth(url);
    if (!res.ok) throw new Error(`Failed to load source snippet: ${res.statusText}`);
    return res.json();
  },

  async analyzeImpact({ groupId, artifactId, fromVersion, toVersion }) {
    const res = await this.fetchWithAuth('/api/impact/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, artifactId, fromVersion, toVersion })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error((err && err.message) || `Failed to analyze impact: ${res.statusText}`);
    }
    return res.json();
  },

  async reindexArchitecture(repositoryId) {
    const res = await this.fetchWithAuth(`/api/repos/${repositoryId}/architecture/reindex`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error(`Failed to reindex architecture: ${res.statusText}`);
    return res.json();
  }
};

