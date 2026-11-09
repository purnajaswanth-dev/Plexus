import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthPage } from './pages/auth/AuthPage';
import { ArchitecturePage } from './pages/architecture/ArchitecturePage';
import { EcosystemPage } from './pages/ecosystem/EcosystemPage';
import { RelationshipsPage } from './pages/relationships/RelationshipsPage';
import { CodeCityWorkspace } from './pages/codecity/CodeCityWorkspace';
import './styles/graphWorkspace.css';
import './styles/codecity.css';

const AppContent = ({ initialView = 'architecture', initialRepoId = null, fixedView = null }) => {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState(fixedView || initialView);
  const [targetRepoId, setTargetRepoId] = useState(initialRepoId);

  // Sync with window hash changes only if NOT fixedView
  useEffect(() => {
    if (fixedView) {
      setCurrentView(fixedView);
      return;
    }

    const parseHash = () => {
      const hash = window.location.hash.replace('#', '');
      const [route, queryString] = hash.split('?');
      const params = new URLSearchParams(queryString || '');

      if (route === 'codecity') {
        setCurrentView('codecity');
        const rId = params.get('repoId');
        if (rId) setTargetRepoId(rId);
      } else if (route === 'architecture') {
        setCurrentView('architecture');
        const rId = params.get('repoId');
        if (rId) setTargetRepoId(rId);
      } else if (route === 'dependency-map' || route === 'ecosystem') {
        setCurrentView('ecosystem');
      } else if (route === 'repository-network' || route === 'relationships' || route === 'network') {
        setCurrentView('relationships');
      }
    };

    parseHash();
    window.addEventListener('hashchange', parseHash);
    return () => window.removeEventListener('hashchange', parseHash);
  }, [fixedView]);

  // Sync props changes if re-rendered with new props
  useEffect(() => {
    if (fixedView) setCurrentView(fixedView);
    if (initialRepoId) setTargetRepoId(initialRepoId);
  }, [fixedView, initialRepoId]);

  // Listen for custom navigation events from outside React
  useEffect(() => {
    const handleCustomNav = (e) => {
      const { view, repoId } = e.detail || {};
      if (!fixedView && view) setCurrentView(view);
      if (repoId) setTargetRepoId(repoId);
    };

    window.addEventListener('graph-navigate', handleCustomNav);
    return () => window.removeEventListener('graph-navigate', handleCustomNav);
  }, [fixedView]);

  // Navigation callbacks
  const handleNavigateToArchitecture = (repoId) => {
    setTargetRepoId(repoId);
    if (window.App && typeof window.App.navigateTo === 'function') {
      window.location.hash = `architecture?repoId=${repoId}`;
      window.App.navigateTo('architecture');
      const archMount = document.getElementById('mount-architecture');
      if (archMount && window.mountGraphExplorer) {
        window.mountGraphExplorer(archMount, { fixedView: 'architecture', initialRepoId: repoId });
      }
    } else {
      window.location.hash = `architecture?repoId=${repoId}`;
      if (!fixedView) setCurrentView('architecture');
    }
  };

  const handleNavigateToImpact = (artifactId, targetVersion) => {
    if (window.State) {
      window.State.impactArtifact = artifactId;
      window.State.impactToVersion = targetVersion || '';
    }
    if (window.App && typeof window.App.navigateTo === 'function') {
      window.App.navigateTo('impact');
    } else {
      window.location.hash = 'impact';
    }
  };

  const handleNavigateToExplorer = (artifactId) => {
    if (window.State) {
      window.State.depSearch = artifactId;
    }
    if (window.App && typeof window.App.navigateTo === 'function') {
      window.App.navigateTo('explorer');
    } else {
      window.location.hash = 'explorer';
    }
  };

  if (loading) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F9F8F6',
        color: '#39332E',
        fontFamily: "'Inter', system-ui, sans-serif"
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          border: '3px solid #D9CFC7',
          borderTopColor: '#7A5C38',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <span style={{ fontSize: '13px', marginTop: '16px', color: '#62574E', fontWeight: 500 }}>
          Connecting to CodeCity Workspace...
        </span>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        minHeight: '420px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F9F8F6',
        color: '#39332E',
        fontFamily: "'Inter', system-ui, sans-serif",
        padding: '32px'
      }}>
        <div style={{
          padding: '28px 36px',
          background: '#FFFFFF',
          border: '1px solid #D9CFC7',
          borderRadius: '12px',
          boxShadow: '0 4px 16px rgba(57, 51, 46, 0.06)',
          textAlign: 'center',
          maxWidth: '420px'
        }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600, color: '#39332E' }}>
            Authentication Required
          </h3>
          <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#62574E', lineHeight: 1.5 }}>
            You need to be signed in to view this CodeCity architecture workspace.
          </p>
          <button
            type="button"
            onClick={() => {
              if (window.AuthManager && typeof window.AuthManager.handleUnauthenticated === 'function') {
                window.AuthManager.handleUnauthenticated();
              } else {
                window.location.reload();
              }
            }}
            style={{
              padding: '9px 20px',
              borderRadius: '6px',
              background: '#C9B59C',
              color: '#39332E',
              border: '1px solid #B8A085',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Sign In to CodeCity
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="graph-subsystem-root" style={{ width: '100%', height: '100%' }}>
      {currentView === 'codecity' && (
        <CodeCityWorkspace
          initialRepoId={targetRepoId}
          onNavigateToArchitecture={handleNavigateToArchitecture}
        />
      )}
      {currentView === 'architecture' && (
        <ArchitecturePage
          initialRepoId={targetRepoId}
          onNavigateToArchitecture={handleNavigateToArchitecture}
        />
      )}
      {currentView === 'ecosystem' && (
        <EcosystemPage
          onNavigateToImpact={handleNavigateToImpact}
          onNavigateToExplorer={handleNavigateToExplorer}
          onNavigateToArchitecture={handleNavigateToArchitecture}
        />
      )}
      {currentView === 'relationships' && (
        <RelationshipsPage
          onNavigateToArchitecture={handleNavigateToArchitecture}
        />
      )}
    </div>
  );
};

export const App = (props) => (
  <AuthProvider>
    <AppContent {...props} />
  </AuthProvider>
);
