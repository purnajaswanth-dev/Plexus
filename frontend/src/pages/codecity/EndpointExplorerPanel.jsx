import React, { useState, useMemo } from 'react';
import { Search, Route, Play, Filter, Sparkles, Shield, ChevronRight, Lock, Unlock, Database, Cpu, ArrowRight } from 'lucide-react';

const METHOD_COLORS = {
  GET: { bg: 'rgba(88, 124, 120, 0.15)', text: '#587C78', border: '#587C78' },
  POST: { bg: 'rgba(113, 134, 155, 0.15)', text: '#71869B', border: '#71869B' },
  PUT: { bg: 'rgba(192, 154, 98, 0.15)', text: '#C09A62', border: '#C09A62' },
  DELETE: { bg: 'rgba(183, 101, 93, 0.15)', text: '#B7655D', border: '#B7655D' },
  PATCH: { bg: 'rgba(146, 125, 145, 0.15)', text: '#927D91', border: '#927D91' }
};

export const EndpointExplorerPanel = ({
  endpoints = [],
  selectedEndpoint = null,
  onSelectEndpoint,
  onClearEndpoint
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedAuth, setSelectedAuth] = useState('ALL');

  const methods = ['ALL', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
  const categories = ['ALL', 'REST', 'ACTUATOR', 'WEBSOCKET'];
  const authTypes = ['ALL', 'PERMIT_ALL', 'ROLE_PROTECTED', 'AUTHENTICATED'];

  const filteredEndpoints = useMemo(() => {
    return endpoints.filter(ep => {
      const matchMethod = selectedMethod === 'ALL' || ep.httpMethod?.toUpperCase() === selectedMethod;
      const matchCategory = selectedCategory === 'ALL' || (ep.apiCategory || 'REST').toUpperCase() === selectedCategory;
      const matchAuth = selectedAuth === 'ALL' || (ep.authClassification || 'AUTHENTICATED').toUpperCase() === selectedAuth;
      const q = searchQuery.toLowerCase();
      const matchQuery = !searchQuery ||
        (ep.routePath && ep.routePath.toLowerCase().includes(q)) ||
        (ep.controllerClass && ep.controllerClass.toLowerCase().includes(q)) ||
        (ep.handlerMethod && ep.handlerMethod.toLowerCase().includes(q));
      return matchMethod && matchCategory && matchAuth && matchQuery;
    });
  }, [endpoints, selectedMethod, selectedCategory, selectedAuth, searchQuery]);

  const renderAuthBadge = (auth) => {
    if (auth === 'ROLE_PROTECTED') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-950/60 text-amber-400 border border-amber-600/40">
          <Shield size={10} /> Role
        </span>
      );
    }
    if (auth === 'PERMIT_ALL') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-600/40">
          <Unlock size={10} /> Public
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-950/60 text-sky-400 border border-sky-600/40">
        <Lock size={10} /> Auth
      </span>
    );
  };

  return (
    <div className="endpoint-explorer-panel flex flex-col h-full bg-slate-900/95 border-r border-slate-800">
      {/* Panel Header */}
      <div className="panel-header p-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Route size={16} className="text-cyan-400" />
          <span className="font-semibold text-sm text-slate-100">API Inventory & Routes</span>
        </div>
        <span className="text-xs text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
          {endpoints.length} APIs
        </span>
      </div>

      {/* Search Input */}
      <div className="p-2 border-b border-slate-800">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 pl-8 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            placeholder="Search route, controller, method..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-200 text-xs px-1"
              onClick={() => setSearchQuery('')}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Method Filter Tabs */}
      <div className="px-2 pt-2 flex flex-wrap gap-1">
        {methods.map(m => (
          <button
            key={m}
            className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
              selectedMethod === m
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 font-bold'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-slate-700/50'
            }`}
            onClick={() => setSelectedMethod(m)}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Auth & Category Filters */}
      <div className="px-2 pt-1 pb-2 border-b border-slate-800 flex items-center justify-between gap-1 text-[10px]">
        <div className="flex items-center gap-1">
          <span className="text-slate-500 uppercase">Auth:</span>
          {authTypes.map(a => (
            <button
              key={a}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                selectedAuth === a ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-slate-300'
              }`}
              onClick={() => setSelectedAuth(a)}
            >
              {a === 'ROLE_PROTECTED' ? 'Role' : a === 'PERMIT_ALL' ? 'Public' : a === 'AUTHENTICATED' ? 'Auth' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Route Active Alert */}
      {selectedEndpoint && (
        <div className="p-2 bg-cyan-950/40 border-b border-cyan-800/40 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono shrink-0"
              style={{
                backgroundColor: METHOD_COLORS[selectedEndpoint.httpMethod]?.bg,
                color: METHOD_COLORS[selectedEndpoint.httpMethod]?.text,
                border: `1px solid ${METHOD_COLORS[selectedEndpoint.httpMethod]?.border}`
              }}
            >
              {selectedEndpoint.httpMethod}
            </span>
            <span className="text-xs font-mono text-cyan-200 truncate" title={selectedEndpoint.routePath}>
              {selectedEndpoint.routePath}
            </span>
          </div>
          <button
            className="text-[11px] text-slate-400 hover:text-slate-200 underline shrink-0"
            onClick={onClearEndpoint}
            title="Clear selected route"
          >
            Reset
          </button>
        </div>
      )}

      {/* Endpoints List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filteredEndpoints.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-xs">
            <p>No endpoints match filter</p>
            <span className="text-[10px] text-slate-600">Try clearing filters or search query</span>
          </div>
        ) : (
          filteredEndpoints.map(ep => {
            const isSelected = selectedEndpoint && selectedEndpoint.id === ep.id;
            const style = METHOD_COLORS[ep.httpMethod] || METHOD_COLORS.GET;
            const stages = ep.stages || ['REQUEST_ENTRY', 'CONTROLLER', 'BUSINESS_SERVICE', 'DATA_ACCESS', 'RESPONSE_CONSTRUCTION'];

            return (
              <div
                key={ep.id}
                className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800 border-cyan-400 shadow-lg shadow-cyan-950/50'
                    : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
                onClick={() => onSelectEndpoint(ep)}
              >
                {/* Top: Method, Route, Auth Badge */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono shrink-0"
                      style={{
                        backgroundColor: style.bg,
                        color: style.text,
                        border: `1px solid ${style.border}`
                      }}
                    >
                      {ep.httpMethod}
                    </span>
                    <span className="font-mono text-xs font-medium text-slate-200 truncate" title={ep.routePath}>
                      {ep.routePath}
                    </span>
                  </div>
                  <div className="shrink-0">
                    {renderAuthBadge(ep.authClassification)}
                  </div>
                </div>

                {/* Handler Method */}
                <div className="text-[11px] text-slate-400 font-mono truncate mb-2">
                  <span className="text-slate-300 font-semibold">{ep.controllerClass}</span>
                  <span className="text-slate-500">.</span>
                  <span className="text-cyan-400">{ep.handlerMethod}()</span>
                </div>

                {/* Route Journey Stages Breadcrumb */}
                <div className="flex items-center gap-1 text-[9px] text-slate-400 overflow-x-hidden pt-1 border-t border-slate-800/50">
                  <span className="px-1 py-0.5 rounded bg-slate-800/80 text-slate-300">Gate</span>
                  <ArrowRight size={8} className="text-slate-600 shrink-0" />
                  <span className="px-1 py-0.5 rounded bg-slate-800/80 text-amber-300">Sec</span>
                  <ArrowRight size={8} className="text-slate-600 shrink-0" />
                  <span className="px-1 py-0.5 rounded bg-slate-800/80 text-sky-300">Ctrl</span>
                  <ArrowRight size={8} className="text-slate-600 shrink-0" />
                  <span className="px-1 py-0.5 rounded bg-slate-800/80 text-indigo-300">Srv</span>
                  {stages.includes('DATA_ACCESS') && (
                    <>
                      <ArrowRight size={8} className="text-slate-600 shrink-0" />
                      <span className="px-1 py-0.5 rounded bg-slate-800/80 text-emerald-300">DB</span>
                    </>
                  )}
                  <div className="ml-auto flex items-center gap-0.5 text-cyan-400 hover:text-cyan-300">
                    <span>Trace</span>
                    <ChevronRight size={10} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
