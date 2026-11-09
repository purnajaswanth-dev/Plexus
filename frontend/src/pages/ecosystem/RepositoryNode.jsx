import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { GitBranch, ShieldCheck, AlertCircle } from 'lucide-react';

export const RepositoryNode = ({ data, selected }) => {
  const name = data.label || data.repoName || 'Repository';
  const depCount = data.dependencyCount ?? 0;
  const ecosystem = data.ecosystem || data.group || 'MAVEN';
  const healthScore = data.healthScore ?? 100;
  const healthRating = data.healthRating || (healthScore >= 80 ? 'Healthy' : healthScore >= 50 ? 'Moderate' : 'Critical');

  return (
    <div className={`rf-node-base rf-node-repo ${selected ? 'selected' : ''}`} style={{ minWidth: 200 }}>
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="source" position={Position.Bottom} id="bottom" />

      <div className="rf-node-header">
        <div className="rf-node-title-group">
          <div className="rf-node-icon">
            <GitBranch size={14} />
          </div>
          <div className="rf-node-name" title={name}>
            {name}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, gap: 6 }}>
        <span className="rf-node-type-badge">{ecosystem}</span>
        <span className={`meta-pill ${healthRating === 'Healthy' ? 'success' : 'warning'}`} style={{ fontSize: '10px' }}>
          {healthRating === 'Healthy' ? <ShieldCheck size={10} /> : <AlertCircle size={10} />}
          {healthScore}%
        </span>
      </div>

      <div className="rf-node-subtext" style={{ marginTop: 4 }}>
        {depCount} {depCount === 1 ? 'dependency' : 'dependencies'}
      </div>
    </div>
  );
};

