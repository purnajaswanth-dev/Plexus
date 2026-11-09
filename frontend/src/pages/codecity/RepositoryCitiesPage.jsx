import React, { useState, useEffect, useMemo } from 'react';
import { codecityApi } from '../../api/codecityApi';
import { Building2, Layers, Route, ArrowRight, RefreshCw, GitBranch, Shield, Sparkles, MapPin, Database, Search } from 'lucide-react';

export const RepositoryCitiesPage = ({ onSelectCity }) => {
  const [repositories, setRepositories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generatingRepoId, setGeneratingRepoId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'PENDING'

  useEffect(() => {
    loadRepositories();
  }, []);

  const loadRepositories = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await codecityApi.getRepositoryCities();
      setRepositories(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (e, repoId) => {
    e.stopPropagation();
    try {
      setGeneratingRepoId(repoId);
      await codecityApi.generateCity(repoId);
      await loadRepositories();
    } catch (err) {
      alert(`Generation failed: ${err.message}`);
    } finally {
      setGeneratingRepoId(null);
    }
  };

  const filteredRepositories = useMemo(() => {
    return repositories.filter(repo => {
      if (statusFilter === 'ACTIVE' && !repo.hasCity) return false;
      if (statusFilter === 'PENDING' && repo.hasCity) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (repo.repoName || '').toLowerCase().includes(q);
        const langMatch = (repo.language || '').toLowerCase().includes(q);
        const ecoMatch = (repo.dependencyFileType || '').toLowerCase().includes(q);
        if (!nameMatch && !langMatch && !ecoMatch) return false;
      }
      return true;
    });
  }, [repositories, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    const totalRepos = repositories.length;
    const activeCities = repositories.filter(r => r.hasCity).length;
    const totalBuildings = repositories.reduce((acc, r) => acc + (r.componentsCount || 0), 0);
    return { totalRepos, activeCities, totalBuildings };
  }, [repositories]);

  if (loading) {
    return (
      <div className="city-page-loading">
        <div className="city-spinner" />
        <span className="text-sm text-slate-400 mt-3 font-medium">Constructing Software Cities catalogue...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="city-page-error">
        <span className="text-rose-400 font-semibold">Failed to load repository cities</span>
        <span className="text-xs text-slate-400 mt-1">{error}</span>
        <button className="btn-retry mt-3" onClick={loadRepositories}>Retry</button>
      </div>
    );
  }

  return (
    <div className="repository-cities-page">
      {/* Header */}
      <div className="cities-header">
        <div>
          <h1 className="cities-main-title">
            <span style={{ color: '#587C78' }}>CodeCity</span> Software Metropolis
          </h1>
          <p className="cities-subtitle">
            Explore your entire codebase as a 2D digital city. Observe execution routes, explore architectural blocks, and inspect traceable source evidence.
          </p>
        </div>
        <button className="btn-refresh-cities" onClick={loadRepositories} title="Refresh Catalogue">
          <RefreshCw size={14} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Toolbar: Search, Filters, and Summary */}
      <div className="cities-toolbar">
        <div className="cities-search-bar">
          <Search size={15} style={{ color: '#64748b' }} />
          <input
            type="text"
            className="cities-search-input"
            placeholder="Search repository or language..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '13px' }}
            >
              ✕
            </button>
          )}
        </div>

        <div className="cities-filter-tabs">
          <button
            className={`filter-tab-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            All Repositories ({repositories.length})
          </button>
          <button
            className={`filter-tab-btn ${statusFilter === 'ACTIVE' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ACTIVE')}
          >
            Active Cities ({stats.activeCities})
          </button>
          <button
            className={`filter-tab-btn ${statusFilter === 'PENDING' ? 'active' : ''}`}
            onClick={() => setStatusFilter('PENDING')}
          >
            Pending ({repositories.length - stats.activeCities})
          </button>
        </div>

        <div className="cities-summary-stats">
          <span><b>{stats.activeCities}</b> Active Cities</span>
          <span>•</span>
          <span><b>{stats.totalBuildings}</b> Buildings Mapped</span>
        </div>
      </div>

      {/* Grid of Repository Cities */}
      <div className="cities-grid">
        {filteredRepositories.map(repo => {
          const isGenerating = generatingRepoId === repo.id;

          return (
            <div
              key={repo.id}
              className={`city-card ${repo.hasCity ? 'has-city' : 'no-city'}`}
              onClick={() => repo.hasCity && onSelectCity(repo.id)}
            >
              {/* Card Top */}
              <div className="city-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div className="city-avatar-box">
                    <Building2 size={20} style={{ color: '#587C78' }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h3 className="city-repo-name truncate" title={repo.repoName}>{repo.repoName}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#828fa8' }}>
                      <span style={{ color: '#cbd5e1', fontWeight: 500 }}>{repo.language || 'Java'}</span>
                      <span>•</span>
                      <span>{repo.defaultBranch || 'main'}</span>
                      {repo.isMonorepo && (
                        <span className="monorepo-tag">Monorepo</span>
                      )}
                    </div>
                  </div>
                </div>

                {repo.commitSha && (
                  <span className="commit-tag" title={repo.commitSha}>
                    {repo.commitSha.substring(0, 7)}
                  </span>
                )}
              </div>

              {/* City Architectural Preview / Metaphor Skyline */}
              <div className="city-skyline-preview">
                <div className="skyline-bars">
                  <div className="sky-bar" style={{ height: '48%', background: '#587C78' }} />
                  <div className="sky-bar" style={{ height: '78%', background: '#71869B' }} />
                  <div className="sky-bar" style={{ height: '60%', background: '#587C78' }} />
                  <div className="sky-bar" style={{ height: '90%', background: '#8599ad' }} />
                  <div className="sky-bar" style={{ height: '52%', background: '#C09A62' }} />
                  <div className="sky-bar" style={{ height: '96%', background: '#8D916B' }} />
                  <div className="sky-bar" style={{ height: '68%', background: '#9EA37E' }} />
                  <div className="sky-bar" style={{ height: '44%', background: '#62574E' }} />
                </div>
                <div className="skyline-overlay">
                  <span className="skyline-text" style={{ color: repo.hasCity ? '#587C78' : '#9aa6c4' }}>
                    {repo.hasCity ? '● 2D Software City Active' : '○ City Pending Generation'}
                  </span>
                </div>
              </div>

              {/* Stats Row */}
              <div className="city-stats-row">
                <div className="city-stat-item">
                  <span className="stat-val" style={{ color: '#587C78' }}>{repo.componentsCount || 0}</span>
                  <span className="stat-lbl">Buildings</span>
                </div>
                <div className="city-stat-item">
                  <span className="stat-val" style={{ color: '#587C78' }}>{repo.relationshipsCount || 0}</span>
                  <span className="stat-lbl">Roads</span>
                </div>
                <div className="city-stat-item">
                  <span className="stat-val" style={{ color: '#C09A62' }}>{repo.dependencyFileType || 'MULTI'}</span>
                  <span className="stat-lbl">Ecosystem</span>
                </div>
              </div>

              {/* Card Footer */}
              <div className="city-card-footer">
                {repo.hasCity ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ fontSize: '12px', color: '#828fa8' }}>
                      {repo.analyzedAt ? new Date(repo.analyzedAt).toLocaleDateString() : 'Ready'}
                    </span>
                    <button className="btn-enter-city">
                      <span>Enter City</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn-build-city"
                    onClick={(e) => handleGenerate(e, repo.id)}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <RefreshCw size={14} className="animate-spin" /> Generating Metropolis...
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Sparkles size={14} style={{ color: '#587C78' }} /> Generate Software City
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
