/**
 * Application State Store
 */
const State = {
    currentView: 'overview',
    theme: localStorage.getItem('dim_theme') || 'light',
    sidebarCollapsed: localStorage.getItem('dim_sidebar_collapsed') === 'true',
    
    // Cached data
    overviewData: null,
    repositories: [],
    dependencies: [],
    settings: null,
    
    // Filters & Selections
    repoFilter: '',
    repoStatusFilter: 'ALL',
    repoEcosystemFilter: 'ALL',
    repoSortBy: 'lastIndexed',

    depSearch: '',
    depTypeFilter: 'ALL',
    depConsistencyFilter: 'ALL',

    listeners: {},

    subscribe(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    },

    notify(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    },

    setTheme(newTheme) {
        this.theme = newTheme;
        localStorage.setItem('dim_theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
        this.notify('themeChanged', newTheme);
    },

    toggleTheme() {
        this.setTheme(this.theme === 'light' ? 'dark' : 'light');
    },

    setSidebarCollapsed(collapsed) {
        this.sidebarCollapsed = collapsed;
        localStorage.setItem('dim_sidebar_collapsed', collapsed ? 'true' : 'false');
        const sidebar = document.getElementById('app-sidebar');
        if (sidebar) {
            sidebar.classList.toggle('collapsed', collapsed);
        }
        this.notify('sidebarToggled', collapsed);
    },

    toggleSidebar() {
        this.setSidebarCollapsed(!this.sidebarCollapsed);
    }
};

