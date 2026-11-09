import React from 'react';
import { X, ExternalLink, ArrowRight, ShieldCheck, Zap, Layers, GitBranch, BookOpen } from 'lucide-react';

export const GraphInspector = ({
  selectedItem,
  itemType = 'node', // 'node' or 'edge'
  mode = 'architecture',
  repository = null,
  onClose,
  onNavigateToImpact,
  onNavigateToExplorer,
  onNavigateToArchitecture
}) => {
  if (!selectedItem) return null;

  const data = selectedItem.data || selectedItem;

  // Render Architecture Node Inspector
  if (mode === 'architecture' && itemType === 'node') {
    const startLine = data.startLine;
    const endLine = data.endLine;
    const filePath = data.filePath;
    const repoUrl = repository?.repoUrl || '';
    const branch = repository?.defaultBranch || 'main';

    let githubLineUrl = '';
    if (repoUrl && filePath && filePath !== '/') {
      githubLineUrl = `${repoUrl}/blob/${branch}/${filePath}${startLine ? `#L${startLine}${endLine ? `-L${endLine}` : ''}` : ''}`;
    }

    let parsedAnnotations = [];
    if (data.annotationsJson) {
      try {
        parsedAnnotations = JSON.parse(data.annotationsJson);
      } catch {
        parsedAnnotations = [];
      }
    }

    return (
      <aside className="graph-inspector-panel">
        <div className="inspector-header">
          <div className="inspector-title">
            <Layers size={16} color="var(--brand-500, #C9B59C)" />
            <span>Architecture Component</span>
          </div>
          <button className="inspector-close-btn" onClick={onClose} title="Close inspector">
            <X size={16} />
          </button>
        </div>

        <div className="inspector-content">
          <div className="inspector-section">
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {data.name || selectedItem.id}
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: 4 }}>
              <span className="rf-node-type-badge" style={{ background: '#EFE9E3', color: '#39332E' }}>
                {data.nodeType || 'COMPONENT'}
              </span>
              {data.level && (
                <span className="meta-pill">Level {data.level}</span>
              )}
              {data.evidenceConfidence && (
                <span className="meta-pill success">{data.evidenceConfidence}</span>
              )}
            </div>
          </div>

          <div className="inspector-section">
            <div className="inspector-section-label">Source Metadata</div>
            {data.packageOrModule && (
              <div className="inspector-meta-row">
                <span className="inspector-meta-key">Package / Module</span>
                <span className="inspector-meta-val">{data.packageOrModule}</span>
              </div>
            )}
            {filePath && (
              <div className="inspector-meta-row">
                <span className="inspector-meta-key">File Path</span>
                <span className="inspector-meta-val">{filePath}</span>
              </div>
            )}
            {startLine && (
              <div className="inspector-meta-row">
                <span className="inspector-meta-key">Lines</span>
                <span className="inspector-meta-val">
                  L{startLine} {endLine ? `- L${endLine}` : ''}
                </span>
              </div>
            )}
          </div>

          {parsedAnnotations.length > 0 && (
            <div className="inspector-section">
              <div className="inspector-section-label">Annotations / Decorators</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {parsedAnnotations.map((ann, i) => (
                  <span key={i} className="meta-pill brand">
                    @{ann}
                  </span>
                ))}
              </div>
            </div>
          )}

          {githubLineUrl && (
            <div className="inspector-section" style={{ marginTop: 6 }}>
              <a
                href={githubLineUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="graph-btn"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <ExternalLink size={13} /> View Source on GitHub
              </a>
            </div>
          )}
        </div>
      </aside>
    );
  }

  // Render Ecosystem Dependency Node Inspector
  if (mode === 'ecosystem' && itemType === 'node' && data.nodeCategory === 'DEPENDENCY') {
    const versions = data.versions || [];
    const isDivergent = data.isDivergent || versions.length > 1;

    return (
      <aside className="graph-inspector-panel">
        <div className="inspector-header">
          <div className="inspector-title">
            <BookOpen size={16} color="var(--brand-500, #C9B59C)" />
            <span>Dependency Details</span>
          </div>
          <button className="inspector-close-btn" onClick={onClose} title="Close inspector">
            <X size={16} />
          </button>
        </div>

        <div className="inspector-content">
          <div className="inspector-section">
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {data.label || data.artifactId || selectedItem.id}
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: 4 }}>
              <span className={`meta-pill ${data.ecosystem === 'MAVEN' ? 'brand' : 'success'}`}>
                {data.ecosystem || 'LIBRARY'}
              </span>
              {isDivergent ? (
                <span className="meta-pill warning">Divergent Versions</span>
              ) : (
                <span className="meta-pill success">Consistent Version</span>
              )}
            </div>
          </div>

          <div className="inspector-section">
            <div className="inspector-section-label">Fleet Usage</div>
            <div className="inspector-meta-row">
              <span className="inspector-meta-key">Consuming Repositories</span>
              <span className="inspector-meta-val">{data.repoCount || 1}</span>
            </div>
            {data.groupId && (
              <div className="inspector-meta-row">
                <span className="inspector-meta-key">Group ID</span>
                <span className="inspector-meta-val">{data.groupId}</span>
              </div>
            )}
            {data.artifactId && (
              <div className="inspector-meta-row">
                <span className="inspector-meta-key">Artifact ID</span>
                <span className="inspector-meta-val">{data.artifactId}</span>
              </div>
            )}
          </div>

          <div className="inspector-section">
            <div className="inspector-section-label">Detected Versions Across Fleet</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {versions.map((ver, i) => (
                <span key={i} className={`meta-pill ${isDivergent ? 'warning' : 'brand'}`}>
                  {ver}
                </span>
              ))}
            </div>
          </div>

          <div className="inspector-actions" style={{ marginTop: 'auto' }}>
            <button
              className="graph-btn primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => onNavigateToImpact?.(data.artifactId || data.label, versions[0])}
            >
              <Zap size={13} /> Analyze Upgrade Impact
            </button>
            <button
              className="graph-btn"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => onNavigateToExplorer?.(data.artifactId || data.label)}
            >
              <BookOpen size={13} /> Open Dependency Explorer
            </button>
          </div>
        </div>
      </aside>
    );
  }

  // Render Repository Node Inspector (Ecosystem or Relationships)
  if (itemType === 'node' && (data.nodeCategory === 'REPOSITORY' || data.nodeType === 'REPOSITORY')) {
    return (
      <aside className="graph-inspector-panel">
        <div className="inspector-header">
          <div className="inspector-title">
            <GitBranch size={16} color="var(--brand-500, #C9B59C)" />
            <span>Repository Inspector</span>
          </div>
          <button className="inspector-close-btn" onClick={onClose} title="Close inspector">
            <X size={16} />
          </button>
        </div>

        <div className="inspector-content">
          <div className="inspector-section">
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {data.label || data.repoName || selectedItem.id}
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: 4 }}>
              <span className="meta-pill brand">{data.group || data.ecosystem || 'REPO'}</span>
              {data.healthRating && (
                <span className={`meta-pill ${data.healthRating === 'Healthy' ? 'success' : 'warning'}`}>
                  {data.healthRating} ({data.healthScore ?? 100}%)
                </span>
              )}
            </div>
          </div>

          <div className="inspector-section">
            <div className="inspector-section-label">Metrics</div>
            <div className="inspector-meta-row">
              <span className="inspector-meta-key">Total Dependencies</span>
              <span className="inspector-meta-val">{data.dependencyCount ?? 0}</span>
            </div>
            {data.language && (
              <div className="inspector-meta-row">
                <span className="inspector-meta-key">Language</span>
                <span className="inspector-meta-val">{data.language}</span>
              </div>
            )}
            {data.repoUrl && (
              <div className="inspector-meta-row">
                <span className="inspector-meta-key">GitHub URL</span>
                <span className="inspector-meta-val">
                  <a href={data.repoUrl} target="_blank" rel="noopener noreferrer" className="inspector-link">
                    Open <ExternalLink size={11} />
                  </a>
                </span>
              </div>
            )}
          </div>

          <div className="inspector-actions" style={{ marginTop: 'auto' }}>
            <button
              className="graph-btn primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => onNavigateToArchitecture?.(data.rawId || data.id)}
            >
              <Layers size={13} /> View Architecture Explorer
            </button>
          </div>
        </div>
      </aside>
    );
  }

  // Render Edge Inspector (Shared Dependency Link)
  if (itemType === 'edge') {
    const shared = data.sharedDependencies || [];
    const sourceName = data.sourceName || selectedItem.source;
    const targetName = data.targetName || selectedItem.target;

    return (
      <aside className="graph-inspector-panel">
        <div className="inspector-header">
          <div className="inspector-title">
            <Zap size={16} color="var(--brand-500, #C9B59C)" />
            <span>Relationship Edge</span>
          </div>
          <button className="inspector-close-btn" onClick={onClose} title="Close inspector">
            <X size={16} />
          </button>
        </div>

        <div className="inspector-content">
          <div className="inspector-section">
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {sourceName} ↔ {targetName}
            </div>
            {data.relationshipType && (
              <span className="meta-pill brand" style={{ marginTop: 4, alignSelf: 'flex-start' }}>
                {data.relationshipType}
              </span>
            )}
          </div>

          <div className="inspector-section">
            <div className="inspector-section-label">Edge Metrics</div>
            {data.weight !== undefined && (
              <div className="inspector-meta-row">
                <span className="inspector-meta-key">Shared Dependency Count</span>
                <span className="inspector-meta-val" style={{ color: 'var(--brand-500)', fontWeight: 700 }}>
                  {data.weight}
                </span>
              </div>
            )}
            {data.similarityPercentage !== undefined && (
              <div className="inspector-meta-row">
                <span className="inspector-meta-key">Jaccard Similarity</span>
                <span className="inspector-meta-val">{data.similarityPercentage}%</span>
              </div>
            )}
            {data.totalUnionDependencies !== undefined && (
              <div className="inspector-meta-row">
                <span className="inspector-meta-key">Union Dependency Count</span>
                <span className="inspector-meta-val">{data.totalUnionDependencies}</span>
              </div>
            )}
            {data.evidence && (
              <div className="inspector-meta-row">
                <span className="inspector-meta-key">Evidence</span>
                <span className="inspector-meta-val">{data.evidence}</span>
              </div>
            )}
          </div>

          {shared.length > 0 && (
            <div className="inspector-section">
              <div className="inspector-section-label">Shared Dependencies ({shared.length})</div>
              <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {shared.map((dep, idx) => (
                  <div key={idx} className="inspector-code-snippet">
                    • {dep}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    );
  }

  return null;
};

