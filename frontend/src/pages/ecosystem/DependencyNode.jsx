import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { BookOpen, AlertTriangle } from 'lucide-react';

export const DependencyNode = ({ data, selected }) => {
  const name = data.label || data.artifactId || 'Dependency';
  const ecosystem = data.ecosystem || 'MAVEN';
  const repoCount = data.repoCount || 1;
  const versions = data.versions || [];
  const isDivergent = data.isDivergent || versions.length > 1;

  const isDimmed = data.isDimmed;

  return (
    <div className={`rf-node-base rf-node-dep ${isDivergent ? 'divergent' : ''} ${selected ? 'selected' : ''} ${isDimmed ? 'dimmed' : ''}`} style={{ minWidth: 190 }}>
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />

      <div className="rf-node-header">
        <div className="rf-node-title-group">
          <div className="rf-node-icon">
            <BookOpen size={14} />
          </div>
          <div className="rf-node-name" title={name}>
            {name}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, gap: 6 }}>
        <span className={`meta-pill ${ecosystem === 'MAVEN' ? 'brand' : 'success'}`} style={{ fontSize: '10px' }}>
          {ecosystem}
        </span>
        <span className="meta-pill" style={{ fontSize: '10px' }}>
          {repoCount} {repoCount === 1 ? 'repo' : 'repos'}
        </span>
      </div>

      <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {isDivergent ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '10px', color: '#B58A4A', fontWeight: 600 }}>
            <AlertTriangle size={11} /> {versions.length} versions
          </div>
        ) : (
          <div className="rf-node-subtext" style={{ fontSize: '10px' }}>
            v{versions[0] || 'declared'}
          </div>
        )}
      </div>
    </div>
  );
};

