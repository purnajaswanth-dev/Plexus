/**
 * UI Components & Helper Utilities
 */
const Components = {
    // Toast Notification Manager
    Toast: {
        container: null,

        init() {
            this.container = document.getElementById('toast-container');
            if (!this.container) {
                this.container = document.createElement('div');
                this.container.id = 'toast-container';
                this.container.className = 'toast-container';
                document.body.appendChild(this.container);
            }
        },

        show(message, type = 'info', duration = 4000) {
            this.init();
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;

            let iconSvg = Icons.info(16);
            if (type === 'success') iconSvg = Icons.check(16);
            if (type === 'error') iconSvg = Icons.impact(16);

            toast.innerHTML = `
                <div class="toast-icon">${iconSvg}</div>
                <div class="toast-message">${escapeHtml(message)}</div>
                <button class="toast-close" aria-label="Close">${Icons.x(14)}</button>
            `;

            const closeBtn = toast.querySelector('.toast-close');
            closeBtn.onclick = () => this.dismiss(toast);

            this.container.appendChild(toast);

            if (duration > 0) {
                setTimeout(() => this.dismiss(toast), duration);
            }
        },

        dismiss(toast) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(20px)';
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 200);
        },

        success(msg) { this.show(msg, 'success'); },
        error(msg) { this.show(msg, 'error', 6000); },
        info(msg) { this.show(msg, 'info'); }
    },

    // Slide-over Drawer
    Drawer: {
        backdrop: null,
        drawer: null,
        titleEl: null,
        bodyEl: null,
        footerEl: null,

        init() {
            this.backdrop = document.getElementById('drawer-backdrop');
            this.drawer = document.getElementById('slideover-drawer');
            this.titleEl = document.getElementById('drawer-title');
            this.bodyEl = document.getElementById('drawer-body');
            this.footerEl = document.getElementById('drawer-footer');
        },

        open(title, bodyHtml, footerHtml = '') {
            this.init();
            if (this.titleEl) this.titleEl.innerHTML = title;
            if (this.bodyEl) this.bodyEl.innerHTML = bodyHtml;
            if (this.footerEl) {
                this.footerEl.innerHTML = footerHtml;
                this.footerEl.style.display = footerHtml ? 'flex' : 'none';
            }
            if (this.backdrop) this.backdrop.classList.add('open');
            if (this.drawer) this.drawer.classList.add('open');
            document.body.style.overflow = 'hidden';
        },

        close() {
            this.init();
            if (this.backdrop) this.backdrop.classList.remove('open');
            if (this.drawer) this.drawer.classList.remove('open');
            document.body.style.overflow = '';
        }
    },

    // Modal Manager
    Modal: {
        open(modalId) {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.add('open');
                document.body.style.overflow = 'hidden';
            }
        },

        close(modalId) {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.remove('open');
                document.body.style.overflow = '';
            }
        }
    },

    // Confirmation Dialog
    ConfirmDialog: {
        show({ title = 'Confirm Action', message, confirmText = 'Confirm', confirmClass = 'btn-danger', onConfirm }) {
            let dialog = document.getElementById('confirm-modal');
            if (!dialog) {
                dialog = document.createElement('div');
                dialog.id = 'confirm-modal';
                dialog.className = 'modal-backdrop';
                document.body.appendChild(dialog);
            }

            dialog.innerHTML = `
                <div class="modal-dialog">
                    <div class="modal-header">
                        <h3 class="modal-title">${escapeHtml(title)}</h3>
                        <button class="modal-close-btn" id="confirm-cancel-x">${Icons.x(16)}</button>
                    </div>
                    <div class="modal-body">
                        <p style="margin: 0; font-size: 13.5px; color: var(--text-secondary); line-height: 1.5;">${escapeHtml(message)}</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" id="confirm-cancel-btn">Cancel</button>
                        <button class="btn ${confirmClass}" id="confirm-action-btn">${escapeHtml(confirmText)}</button>
                    </div>
                </div>
            `;

            dialog.classList.add('open');

            const cleanup = () => {
                dialog.classList.remove('open');
            };

            document.getElementById('confirm-cancel-btn').onclick = cleanup;
            document.getElementById('confirm-cancel-x').onclick = cleanup;
            document.getElementById('confirm-action-btn').onclick = () => {
                cleanup();
                if (typeof onConfirm === 'function') onConfirm();
            };
        }
    },

    // Formatters
    formatDate(dateStr) {
        if (!dateStr) return 'Not indexed';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;

            const now = new Date();
            const diffMs = now - date;
            const diffSec = Math.floor(diffMs / 1000);
            const diffMin = Math.floor(diffSec / 60);
            const diffHour = Math.floor(diffMin / 60);
            const diffDays = Math.floor(diffHour / 24);

            if (diffMin < 1) return 'Just now';
            if (diffMin < 60) return `${diffMin}m ago`;
            if (diffHour < 24) return `${diffHour}h ago`;
            if (diffDays < 7) return `${diffDays}d ago`;

            return date.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (e) {
            return dateStr;
        }
    },

    formatExactDateTime(dateStr) {
        if (!dateStr) return 'N/A';
        try {
            const date = new Date(dateStr);
            return date.toLocaleString();
        } catch (e) {
            return dateStr;
        }
    },

    formatEcosystemBadge(type) {
        const t = (type || 'NONE').toUpperCase();
        if (t === 'MAVEN') {
            return `<span class="badge badge-maven"><span class="badge-dot" style="background:#4f46e5;"></span>Maven</span>`;
        }
        if (t === 'GRADLE') {
            return `<span class="badge" style="background: rgba(14, 165, 233, 0.1); color: #0284c7; border: 1px solid rgba(14, 165, 233, 0.3);"><span class="badge-dot" style="background:#0284c7;"></span>Gradle</span>`;
        }
        if (t === 'NPM') {
            return `<span class="badge badge-npm"><span class="badge-dot" style="background:#16a34a;"></span>npm</span>`;
        }
        if (t === 'PYTHON') {
            return `<span class="badge" style="background: rgba(234, 179, 8, 0.1); color: #ca8a04; border: 1px solid rgba(234, 179, 8, 0.3);"><span class="badge-dot" style="background:#ca8a04;"></span>Python</span>`;
        }
        if (t === 'GO') {
            return `<span class="badge" style="background: rgba(6, 182, 212, 0.1); color: #0891b2; border: 1px solid rgba(6, 182, 212, 0.3);"><span class="badge-dot" style="background:#0891b2;"></span>Go</span>`;
        }
        if (t === 'MULTI_ECOSYSTEM') {
            return `<span class="badge" style="background: rgba(168, 85, 247, 0.1); color: #9333ea; border: 1px solid rgba(168, 85, 247, 0.3);"><span class="badge-dot" style="background:#9333ea;"></span>Multi-Ecosystem</span>`;
        }
        return `<span class="badge badge-none"><span class="badge-dot" style="background:#64748b;"></span>None</span>`;
    },

    formatStatusBadge(status) {
        const s = (status || 'UNKNOWN').toUpperCase();
        if (s === 'INDEXED') {
            return `<span class="badge badge-indexed"><span class="badge-dot"></span>Indexed</span>`;
        }
        if (s === 'INDEXED_NO_MANIFEST') {
            return `<span class="badge" style="background: rgba(56, 189, 248, 0.1); color: #0284c7; border: 1px solid rgba(56, 189, 248, 0.3);"><span class="badge-dot" style="background: #0284c7;"></span>Indexed (No Manifest)</span>`;
        }
        if (s === 'FAILED') {
            return `<span class="badge badge-failed"><span class="badge-dot"></span>Failed</span>`;
        }
        if (s === 'PENDING') {
            return `<span class="badge badge-pending"><span class="badge-dot"></span>Pending</span>`;
        }
        return `<span class="badge badge-neutral"><span class="badge-dot"></span>${escapeHtml(s)}</span>`;
    },

    formatHealthBadge(score, rating) {
        const sc = typeof score === 'number' ? score : 0;
        const r = rating || (sc >= 80 ? 'Healthy' : (sc >= 50 ? 'Moderate' : 'Critical'));

        let cls = 'badge-healthy';
        if (r === 'Moderate') cls = 'badge-warning';
        if (r === 'Critical') cls = 'badge-critical';

        return `<span class="badge ${cls}"><span class="badge-dot"></span>${sc}/100 ${r}</span>`;
    },

    formatRiskBadge(level) {
        const l = (level || 'SAFE').toUpperCase();
        if (l === 'BREAKING') {
            return `<span class="badge badge-critical"><span class="badge-dot"></span>BREAKING</span>`;
        }
        if (l === 'WARNING') {
            return `<span class="badge badge-warning"><span class="badge-dot"></span>WARNING</span>`;
        }
        return `<span class="badge badge-safe"><span class="badge-dot"></span>SAFE</span>`;
    },

    renderEmptyState({ icon, title, description, actionText, onAction }) {
        const actionHtml = actionText ? `<button class="btn btn-primary btn-sm" id="empty-state-action-btn">${escapeHtml(actionText)}</button>` : '';
        return `
            <div class="empty-state">
                <div class="empty-state-icon">${icon || Icons.info(24)}</div>
                <h4 class="empty-state-title">${escapeHtml(title)}</h4>
                <p class="empty-state-desc">${escapeHtml(description)}</p>
                ${actionHtml}
            </div>
        `;
    }
};

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

