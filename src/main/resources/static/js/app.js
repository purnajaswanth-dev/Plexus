/**
 * Authentication Manager & Top-Level Guard
 */
const AuthManager = {
    isAuthenticated: false,
    currentUser: null,
    preservedHash: null,

    async init() {
        const loadingEl = document.getElementById('app-loading-screen');
        const authRoot = document.getElementById('auth-root');
        const appShell = document.getElementById('app');

        const waitForSupabase = async () => {
            if (window.supabase) return window.supabase;
            for (let i = 0; i < 30; i++) {
                await new Promise(r => setTimeout(r, 50));
                if (window.supabase) return window.supabase;
            }
            return window.supabase || null;
        };

        const supabase = await waitForSupabase();

        let session = null;
        if (supabase) {
            try {
                const { data, error } = await supabase.auth.getSession();
                if (data && data.session && !error) {
                    session = data.session;
                }
            } catch (e) {
                console.warn('Supabase getSession error:', e);
            }
        }

        if (session && session.user) {
            this.handleAuthenticated(session, false);
        } else {
            this.handleUnauthenticated();
        }

        // Listen for Supabase auth state change events
        if (supabase) {
            supabase.auth.onAuthStateChange((event, newSession) => {
                if (event === 'SIGNED_IN' || (event === 'TOKEN_REFRESHED' && newSession)) {
                    if (!this.isAuthenticated || (newSession && newSession.user?.id !== this.currentUser?.id)) {
                        this.handleAuthenticated(newSession, true);
                    }
                } else if (event === 'SIGNED_OUT') {
                    this.handleUnauthenticated();
                }
            });
        }

        // Listen for 401 session expiration
        window.addEventListener('supabase-auth-expired', () => {
            if (this.isAuthenticated) {
                alert('Your session has expired. Please sign in again.');
                this.handleUnauthenticated();
            }
        });
    },

    handleAuthenticated(session, isNewLogin = false) {
        this.isAuthenticated = true;
        this.currentUser = session.user;
        window.__SUPABASE_ACCESS_TOKEN__ = session.access_token;
        window.__SUPABASE_USER__ = session.user;

        const loadingEl = document.getElementById('app-loading-screen');
        const authRoot = document.getElementById('auth-root');
        const appShell = document.getElementById('app');
        const userPill = document.getElementById('topbar-user-pill');
        const userEmail = document.getElementById('topbar-user-email');
        const signoutBtn = document.getElementById('topbar-signout-btn');
        const sidebarSignout = document.getElementById('sidebar-signout-btn');

        if (loadingEl) loadingEl.style.display = 'none';
        if (authRoot) {
            authRoot.style.display = 'none';
            if (window.unmountAuth) window.unmountAuth(authRoot);
        }
        if (appShell) appShell.style.display = 'flex';

        if (userEmail) userEmail.innerText = session.user.email || 'User';
        if (userPill) userPill.style.display = 'inline-flex';
        if (signoutBtn) signoutBtn.style.display = 'inline-flex';
        if (sidebarSignout) sidebarSignout.style.display = 'flex';

        // Target view: preservedHash -> current hash -> overview
        const targetRoute = this.preservedHash || window.location.hash.replace('#', '') || 'overview';
        this.preservedHash = null;
        const initialHash = targetRoute.split('?')[0] || 'overview';
        App.navigateTo(App.views[initialHash] ? initialHash : 'overview', true);
    },

    handleUnauthenticated() {
        this.isAuthenticated = false;
        this.currentUser = null;
        window.__SUPABASE_ACCESS_TOKEN__ = null;
        window.__SUPABASE_USER__ = null;

        const currentHash = window.location.hash.replace('#', '');
        if (currentHash && currentHash !== 'overview' && !currentHash.startsWith('login')) {
            this.preservedHash = currentHash;
        }

        const loadingEl = document.getElementById('app-loading-screen');
        const authRoot = document.getElementById('auth-root');
        const appShell = document.getElementById('app');
        const userPill = document.getElementById('topbar-user-pill');
        const signoutBtn = document.getElementById('topbar-signout-btn');
        const sidebarSignout = document.getElementById('sidebar-signout-btn');

        if (loadingEl) loadingEl.style.display = 'none';
        if (appShell) appShell.style.display = 'none';
        if (userPill) userPill.style.display = 'none';
        if (signoutBtn) signoutBtn.style.display = 'none';
        if (sidebarSignout) sidebarSignout.style.display = 'none';

        if (authRoot) {
            authRoot.style.display = 'block';
            const renderAuth = () => {
                if (window.mountAuth) {
                    window.mountAuth(authRoot, {
                        onAuthenticated: () => {
                            if (window.supabase) {
                                window.supabase.auth.getSession().then(({ data: { session } }) => {
                                    if (session) this.handleAuthenticated(session, true);
                                });
                            }
                        }
                    });
                }
            };

            if (window.mountAuth) {
                renderAuth();
            } else {
                const interval = setInterval(() => {
                    if (window.mountAuth) {
                        clearInterval(interval);
                        renderAuth();
                    }
                }, 50);
                setTimeout(() => clearInterval(interval), 5000);
            }
        }
    },

    async signOut() {
        if (window.supabase) {
            try {
                await window.supabase.auth.signOut();
            } catch (e) {
                console.warn('Sign out error:', e);
            }
        }
        try {
            localStorage.removeItem('codecity-supabase-auth-token');
            localStorage.removeItem('codecity_selected_repo');
            localStorage.removeItem('codecity_impact_cache');
        } catch (e) {}
        this.handleUnauthenticated();
    }
};

window.AuthManager = AuthManager;

/**
 * Main Application Orchestrator & Router
 */
const App = {
    views: {
        overview: OverviewPage,
        repositories: RepositoriesPage,
        explorer: ExplorerPage,
        impact: ImpactPage,
        codecity: {
            render: async (containerEl) => {
                const mount = document.getElementById('mount-codecity');
                const mountFn = () => {
                    const hashParts = window.location.hash.split('?');
                    const hashParams = new URLSearchParams(hashParts[1] || '');
                    const repoId = hashParams.get('repoId') || State.selectedRepoId;
                    window.mountGraphExplorer(mount, { fixedView: 'codecity', initialRepoId: repoId ? Number(repoId) : null });
                };
                if (window.mountGraphExplorer && mount) {
                    mountFn();
                } else if (mount) {
                    const interval = setInterval(() => {
                        if (window.mountGraphExplorer) {
                            clearInterval(interval);
                            mountFn();
                        }
                    }, 50);
                    setTimeout(() => clearInterval(interval), 5000);
                }
            }
        },
        architecture: {
            render: async (containerEl) => {
                const mount = document.getElementById('mount-architecture');
                const mountFn = () => {
                    const hashParts = window.location.hash.split('?');
                    const hashParams = new URLSearchParams(hashParts[1] || '');
                    const repoId = hashParams.get('repoId') || State.selectedRepoId;
                    window.mountGraphExplorer(mount, { fixedView: 'architecture', initialRepoId: repoId });
                };
                if (window.mountGraphExplorer && mount) {
                    mountFn();
                } else if (mount) {
                    const interval = setInterval(() => {
                        if (window.mountGraphExplorer) {
                            clearInterval(interval);
                            mountFn();
                        }
                    }, 50);
                    setTimeout(() => clearInterval(interval), 5000);
                }
            }
        },
        'dependency-map': {
            render: async (containerEl) => {
                const mount = document.getElementById('mount-dependency-map');
                const mountFn = () => {
                    window.mountGraphExplorer(mount, { fixedView: 'ecosystem' });
                };
                if (window.mountGraphExplorer && mount) {
                    mountFn();
                } else if (mount) {
                    const interval = setInterval(() => {
                        if (window.mountGraphExplorer) {
                            clearInterval(interval);
                            mountFn();
                        }
                    }, 50);
                    setTimeout(() => clearInterval(interval), 5000);
                }
            }
        },
        'repository-network': {
            render: async (containerEl) => {
                const mount = document.getElementById('mount-repository-network');
                const mountFn = () => {
                    window.mountGraphExplorer(mount, { fixedView: 'relationships' });
                };
                if (window.mountGraphExplorer && mount) {
                    mountFn();
                } else if (mount) {
                    const interval = setInterval(() => {
                        if (window.mountGraphExplorer) {
                            clearInterval(interval);
                            mountFn();
                        }
                    }, 50);
                    setTimeout(() => clearInterval(interval), 5000);
                }
            }
        },
        network: NetworkPage,
        settings: SettingsPage
    },

    pageMeta: {
        overview: { title: 'Overview', breadcrumb: 'Engineering Overview' },
        repositories: { title: 'Repositories', breadcrumb: 'Repository Management' },
        explorer: { title: 'Dependency Explorer', breadcrumb: 'Library Catalog' },
        impact: { title: 'Impact Analysis', breadcrumb: 'Upgrade Risk Assessment' },
        codecity: { title: 'CodeCity', breadcrumb: 'Visual Explorer / CodeCity (2D Software City)' },
        architecture: { title: 'Repository Architecture', breadcrumb: 'Visual Explorer / Architecture' },
        'dependency-map': { title: 'Dependency Ecosystem', breadcrumb: 'Visual Explorer / Dependency Map' },
        'repository-network': { title: 'Repository Relationships', breadcrumb: 'Visual Explorer / Repo Network' },
        network: { title: 'Dependency Network', breadcrumb: 'Coupling Topology' },
        settings: { title: 'Settings', breadcrumb: 'System Configuration' }
    },

    init() {
        // Initialize Theme
        document.documentElement.setAttribute('data-theme', State.theme);
        
        // Initialize Sidebar state
        if (State.sidebarCollapsed) {
            const sidebar = document.getElementById('app-sidebar');
            if (sidebar) sidebar.classList.add('collapsed');
        }

        // Bind Shell UI Events
        this.bindShellEvents();

        // Initialize Authentication Guard
        AuthManager.init();
    },

    bindShellEvents() {
        // Sidebar Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.onclick = (e) => {
                e.preventDefault();
                const view = item.getAttribute('data-view');
                if (view) this.navigateTo(view);
                // Close mobile sidebar if open
                document.getElementById('app-sidebar').classList.remove('mobile-open');
            };
        });

        // Sidebar Toggle
        const collapseBtn = document.getElementById('sidebar-collapse-btn');
        if (collapseBtn) {
            collapseBtn.onclick = () => State.toggleSidebar();
        }

        // Mobile Menu Button
        const mobileBtn = document.getElementById('mobile-menu-btn');
        if (mobileBtn) {
            mobileBtn.onclick = () => {
                document.getElementById('app-sidebar').classList.toggle('mobile-open');
            };
        }

        // Topbar Theme Toggle
        const themeBtn = document.getElementById('topbar-theme-toggle');
        if (themeBtn) {
            this.updateThemeToggleIcon();
            themeBtn.onclick = () => {
                State.toggleTheme();
                this.updateThemeToggleIcon();
            };
        }

        // Topbar Refresh Action
        const topbarRefresh = document.getElementById('topbar-refresh-btn');
        if (topbarRefresh) {
            topbarRefresh.onclick = () => {
                const currentController = this.views[State.currentView];
                if (currentController && typeof currentController.loadData === 'function') {
                    currentController.loadData();
                } else if (currentController && typeof currentController.render === 'function') {
                    currentController.render(document.getElementById(`view-${State.currentView}`));
                }
            };
        }

        // Global Search Input
        const globalSearch = document.getElementById('global-search-input');
        if (globalSearch) {
            globalSearch.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    const query = e.target.value.trim();
                    if (query) {
                        State.depSearch = query;
                        this.navigateTo('explorer');
                        const explorerSearch = document.getElementById('explorer-search-input');
                        if (explorerSearch) explorerSearch.value = query;
                    }
                }
            };
        }

        // Drawer Close
        const drawerCloseBtn = document.getElementById('drawer-close-btn');
        if (drawerCloseBtn) drawerCloseBtn.onclick = () => Components.Drawer.close();

        const drawerBackdrop = document.getElementById('drawer-backdrop');
        if (drawerBackdrop) drawerBackdrop.onclick = () => Components.Drawer.close();

        // Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            // Escape key closes modals and drawers
            if (e.key === 'Escape') {
                Components.Drawer.close();
                document.querySelectorAll('.modal-backdrop.open').forEach(m => m.classList.remove('open'));
                document.body.style.overflow = '';
            }

            // Ctrl+K or '/' focuses global search
            if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA')) {
                e.preventDefault();
                const searchEl = document.getElementById('global-search-input');
                if (searchEl) searchEl.focus();
            }
        });

        // Hash change listener
        window.addEventListener('hashchange', () => {
            const rawHash = window.location.hash.replace('#', '');
            const route = rawHash.split('?')[0];
            if (this.views[route]) {
                this.navigateTo(route, false);
            }
        });

        // Topbar and Sidebar Sign Out actions
        const topbarSignOut = document.getElementById('topbar-signout-btn');
        if (topbarSignOut) {
            topbarSignOut.onclick = (e) => {
                e.preventDefault();
                AuthManager.signOut();
            };
        }

        const sidebarSignOut = document.getElementById('sidebar-signout-btn');
        if (sidebarSignOut) {
            sidebarSignOut.onclick = (e) => {
                e.preventDefault();
                AuthManager.signOut();
            };
        }

        // Supabase Auth State Change Listener
        window.addEventListener('supabase-auth-state-change', (e) => {
            const userPill = document.getElementById('topbar-user-pill');
            const userEmail = document.getElementById('topbar-user-email');
            if (userPill && userEmail) {
                if (e.detail && e.detail.authenticated && e.detail.user) {
                    userEmail.innerText = e.detail.user.email || 'User';
                    userPill.style.display = 'inline-flex';
                } else {
                    userPill.style.display = 'none';
                }
            }
        });
    },

    updateThemeToggleIcon() {
        const themeBtn = document.getElementById('topbar-theme-toggle');
        if (themeBtn) {
            themeBtn.innerHTML = State.theme === 'light' ? Icons.moon(16) : Icons.sun(16);
            themeBtn.title = `Switch to ${State.theme === 'light' ? 'Dark' : 'Light'} theme`;
        }
    },

    async navigateTo(viewName, updateHash = true) {
        if (!AuthManager.isAuthenticated) {
            AuthManager.handleUnauthenticated();
            return;
        }

        if (!this.views[viewName]) viewName = 'overview';
        State.currentView = viewName;

        if (updateHash) {
            window.location.hash = viewName;
        }

        // Update active navigation item in sidebar
        document.querySelectorAll('.nav-item').forEach(item => {
            const v = item.getAttribute('data-view');
            item.classList.toggle('active', v === viewName);
        });

        // Update Topbar breadcrumbs
        const meta = this.pageMeta[viewName] || { title: viewName, breadcrumb: viewName };
        const breadcrumbEl = document.getElementById('topbar-breadcrumb');
        if (breadcrumbEl) {
            breadcrumbEl.innerText = meta.breadcrumb;
        }
        document.title = `${meta.title} — Cross-Repo Dependency Impact Mapper`;

        // Hide all views and show active
        document.querySelectorAll('.page-view').forEach(viewEl => {
            viewEl.classList.remove('active');
        });

        let targetViewEl = document.getElementById(`view-${viewName}`);
        if (!targetViewEl) {
            targetViewEl = document.createElement('div');
            targetViewEl.id = `view-${viewName}`;
            targetViewEl.className = 'page-view';
            document.getElementById('content-area').appendChild(targetViewEl);
        }

        targetViewEl.classList.add('active');

        // Toggle full viewport mode on content-area for graph visual explorers
        const contentArea = document.getElementById('content-area');
        const isGraph = (viewName === 'architecture' || viewName === 'dependency-map' || viewName === 'repository-network');
        if (contentArea) {
            contentArea.classList.toggle('is-graph-active', isGraph);
        }
        if (isGraph) {
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, 60);
        }

        // Render page controller
        const controller = this.views[viewName];
        if (controller && typeof controller.render === 'function') {
            await controller.render(targetViewEl);
        }
    }
};

// Mount application once DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

