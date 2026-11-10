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
        const sidebarUserCard = document.getElementById('sidebar-user-card');
        const sidebarUserEmail = document.getElementById('sidebar-user-email');
        const sidebarUserAvatar = document.getElementById('sidebar-user-avatar');

        if (loadingEl) loadingEl.style.display = 'none';
        if (authRoot) {
            authRoot.style.display = 'none';
            if (window.unmountAuth) window.unmountAuth(authRoot);
        }
        if (appShell) appShell.style.display = 'flex';

        const displayEmail = session.user.email || 'User';
        if (userEmail) userEmail.innerText = displayEmail;
        if (userPill) userPill.style.display = 'inline-flex';
        if (signoutBtn) signoutBtn.style.display = 'inline-flex';
        if (sidebarSignout) sidebarSignout.style.display = 'flex';
        if (sidebarUserCard) sidebarUserCard.style.display = 'flex';
        if (sidebarUserEmail) sidebarUserEmail.innerText = displayEmail;
        if (sidebarUserAvatar) sidebarUserAvatar.innerText = displayEmail.charAt(0).toUpperCase();

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
        const sidebarUserCard = document.getElementById('sidebar-user-card');

        if (loadingEl) loadingEl.style.display = 'none';
        if (appShell) appShell.style.display = 'none';
        if (userPill) userPill.style.display = 'none';
        if (signoutBtn) signoutBtn.style.display = 'none';
        if (sidebarSignout) sidebarSignout.style.display = 'none';
        if (sidebarUserCard) sidebarUserCard.style.display = 'none';

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

window.toast = (message) => {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = message;
    t.classList.add('o');
    clearTimeout(t._hideTimer);
    t._hideTimer = setTimeout(() => {
        t.classList.remove('o');
    }, 2200);
};

/**
 * Command Palette (Ctrl+K / Cmd+K)
 */
const PaletteManager = {
    selectedIdx: 0,
    list: [],

    getItems() {
        const items = [
            { l: 'Go to Overview', f: () => App.navigateTo('overview'), i: 'grid' },
            { l: 'Go to Repositories', f: () => App.navigateTo('repositories'), i: 'gitBranch' },
            { l: 'Go to Dependencies', f: () => App.navigateTo('explorer'), i: 'box' },
            { l: 'Go to Impact Analysis', f: () => App.navigateTo('impact'), i: 'alertTriangle' },
            { l: 'Go to CodeCity (2D)', f: () => App.navigateTo('codecity'), i: 'city' },
            { l: 'Go to Architecture Explorer', f: () => App.navigateTo('architecture'), i: 'layers' },
            { l: 'Go to Dependency Map', f: () => App.navigateTo('dependency-map'), i: 'share' },
            { l: 'Go to Repo Network', f: () => App.navigateTo('repository-network'), i: 'network' },
            { l: 'Go to Topology Canvas', f: () => App.navigateTo('network'), i: 'network' },
            { l: 'Go to Settings', f: () => App.navigateTo('settings'), i: 'settings' },
            { l: 'Switch Theme (Dark / Light)', f: () => { State.toggleTheme(); App.updateThemeToggleIcon(); }, i: 'sun' },
            { l: 'Refresh Active View', f: () => {
                const c = App.views[State.currentView];
                if (c && typeof c.loadData === 'function') c.loadData();
                else if (c && typeof c.render === 'function') c.render(document.getElementById(`view-${State.currentView}`));
                window.toast('View refreshed');
            }, i: 'refresh' }
        ];

        if (Array.isArray(State.repositories) && State.repositories.length) {
            State.repositories.forEach(repo => {
                const name = repo.repoName || repo.name || `Repo #${repo.id}`;
                items.push({
                    l: `Open CodeCity: ${name}`,
                    f: () => {
                        State.selectedRepoId = repo.id;
                        App.navigateTo('codecity');
                    },
                    i: 'city'
                });
                items.push({
                    l: `Open Architecture: ${name}`,
                    f: () => {
                        State.selectedRepoId = repo.id;
                        App.navigateTo('architecture');
                    },
                    i: 'layers'
                });
            });
        }
        return items;
    },

    open() {
        const pal = document.getElementById('pal');
        const pi = document.getElementById('pi');
        if (!pal || !pi) return;
        pal.classList.add('o');
        pi.value = '';
        this.selectedIdx = 0;
        this.render();
        setTimeout(() => pi.focus(), 30);
    },

    close() {
        const pal = document.getElementById('pal');
        if (pal) pal.classList.remove('o');
    },

    render() {
        const pi = document.getElementById('pi');
        const pl = document.getElementById('pl');
        if (!pl) return;
        const q = (pi ? pi.value : '').toLowerCase().trim();
        this.list = this.getItems().filter(item => item.l.toLowerCase().includes(q));
        this.selectedIdx = Math.min(this.selectedIdx, Math.max(0, this.list.length - 1));

        if (!this.list.length) {
            pl.innerHTML = `<li style="padding: 12px 16px; color: var(--m); cursor: default;">No matching commands or repositories.</li>`;
            return;
        }

        pl.innerHTML = this.list.map((item, idx) => {
            const isSelected = idx === this.selectedIdx;
            const iconSvg = Icons[item.i] ? Icons[item.i](15) : Icons.search(15);
            return `<li role="option" aria-selected="${isSelected}" data-idx="${idx}">
                <span style="display:inline-flex; align-items:center; color: var(--${isSelected ? 'a' : 'm'});">${iconSvg}</span>
                <span style="flex: 1; font-weight: 500;">${item.l}</span>
            </li>`;
        }).join('');
    },

    execute(idx) {
        this.close();
        if (this.list[idx] && typeof this.list[idx].f === 'function') {
            this.list[idx].f();
        }
    }
};

window.PaletteManager = PaletteManager;

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

        // Global Search / Command Palette Trigger
        const globalSearchTrigger = document.getElementById('global-search-trigger');
        if (globalSearchTrigger) {
            globalSearchTrigger.onclick = (e) => {
                e.preventDefault();
                PaletteManager.open();
            };
        }
        const globalSearch = document.getElementById('global-search-input');
        if (globalSearch) {
            globalSearch.onfocus = (e) => {
                e.preventDefault();
                globalSearch.blur();
                PaletteManager.open();
            };
        }

        // Command Palette events
        const pi = document.getElementById('pi');
        if (pi) {
            pi.oninput = () => {
                PaletteManager.selectedIdx = 0;
                PaletteManager.render();
            };
        }

        const palModal = document.getElementById('pal');
        if (palModal) {
            palModal.onclick = (e) => {
                if (e.target.id === 'pal') {
                    PaletteManager.close();
                }
                const li = e.target.closest('li[data-idx]');
                if (li) {
                    PaletteManager.execute(Number(li.dataset.idx));
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
            const isPalOpen = palModal && palModal.classList.contains('o');

            // Escape key closes palette, modals and drawers
            if (e.key === 'Escape') {
                if (isPalOpen) {
                    PaletteManager.close();
                    return;
                }
                Components.Drawer.close();
                document.querySelectorAll('.modal-backdrop.open').forEach(m => m.classList.remove('open'));
                document.body.style.overflow = '';
            }

            // Command palette keyboard navigation
            if (isPalOpen) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    PaletteManager.selectedIdx = Math.min(PaletteManager.list.length - 1, PaletteManager.selectedIdx + 1);
                    PaletteManager.render();
                    return;
                }
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    PaletteManager.selectedIdx = Math.max(0, PaletteManager.selectedIdx - 1);
                    PaletteManager.render();
                    return;
                }
                if (e.key === 'Enter') {
                    e.preventDefault();
                    PaletteManager.execute(PaletteManager.selectedIdx);
                    return;
                }
            }

            // Ctrl+K / Cmd+K opens Command Palette
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                if (isPalOpen) {
                    PaletteManager.close();
                } else {
                    PaletteManager.open();
                }
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

