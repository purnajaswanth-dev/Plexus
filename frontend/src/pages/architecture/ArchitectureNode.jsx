import React from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  Folder,
  Package,
  Layers,
  Server,
  Database,
  Globe,
  Code2,
  Box,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

const getNodeIcon = (type) => {
  switch ((type || '').toUpperCase()) {
    case 'REPOSITORY':
      return <Layers size={14} />;
    case 'MODULE':
    case 'PACKAGE':
      return <Package size={14} />;
    case 'DIRECTORY':
      return <Folder size={14} />;
    case 'CONTROLLER':
      return <Globe size={14} />;
    case 'SERVICE':
      return <Server size={14} />;
    case 'REPOSITORY_INTERFACE':
    case 'DAO':
      return <Database size={14} />;
    case 'ENTITY':
    case 'MODEL':
      return <Box size={14} />;
    case 'API_ENDPOINT':
      return <Code2 size={14} />;
    default:
      return <Code2 size={14} />;
  }
};

const getNodeClass = (type) => {
  switch ((type || '').toUpperCase()) {
    case 'REPOSITORY':
      return 'rf-node-repo';
    case 'MODULE':
      return 'rf-node-module';
    case 'PACKAGE':
    case 'DIRECTORY':
      return 'rf-node-package';
    case 'CONTROLLER':
      return 'rf-node-controller';
    case 'SERVICE':
      return 'rf-node-service';
    case 'REPOSITORY_INTERFACE':
    case 'DAO':
      return 'rf-node-repo-interface';
    case 'ENTITY':
    case 'MODEL':
      return 'rf-node-entity';
    case 'API_ENDPOINT':
      return 'rf-node-endpoint';
    default:
      return 'rf-node-external';
  }
};

export const ArchitectureNode = ({ data, selected }) => {
  const nodeType = data.nodeType || 'COMPONENT';
  const name = data.name || data.label || 'Component';
  const subtext = data.packageOrModule || data.filePath || '';
  const childCount = data.childCount || 0;
  const isExpanded = data.isExpanded ?? true;
  const isDimmed = data.isDimmed;

  return (
    <div className={`rf-node-base ${getNodeClass(nodeType)} ${selected ? 'selected' : ''} ${isDimmed ? 'dimmed' : ''}`}>
      {/* React Flow Handles for all 4 layout directions */}
      <Handle type="target" position={Position.Top} id="top" style={{ background: '#81776F' }} />
      <Handle type="target" position={Position.Left} id="left" style={{ background: '#81776F' }} />
      <Handle type="source" position={Position.Right} id="right" style={{ background: '#81776F' }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ background: '#81776F' }} />

      <div className="rf-node-header">
        <div className="rf-node-title-group">
          <div className="rf-node-icon">{getNodeIcon(nodeType)}</div>
          <div className="rf-node-name" title={name}>
            {name}
          </div>
        </div>
        <span className="rf-node-type-badge">{nodeType}</span>
      </div>

      {subtext && (
        <div className="rf-node-subtext" title={subtext}>
          {subtext}
        </div>
      )}

      {childCount > 0 && data.onToggleExpand && (
        <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="rf-node-expand-btn"
            onClick={(e) => {
              e.stopPropagation();
              data.onToggleExpand(data.id || data.nodeKey);
            }}
            title={isExpanded ? 'Collapse children' : `Expand ${childCount} children`}
          >
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        </div>
      )}
    </div>
  );
};

