window.App = (() => {
  const state = {
    user: null,
    settings: {},
    currentPage: 'overview',
    globalSearch: '',
    categories: [],
    suppliers: [],
  };

  const pageRegistry = {};

  function registerPage(name, renderFn) {
    pageRegistry[name] = renderFn;
  }

  async function refreshAlertsBadge() {
    try {
      const res = await API.get('/alerts?status=ACTIVE');
      const alerts = res.data || [];
      const badge = document.getElementById('sidebarAlertBadge');
      const dot = document.getElementById('topbarAlertDot');
      const list = document.getElementById('notifList');

      if (alerts.length > 0) {
        badge.style.display = 'inline-block';
        badge.textContent = alerts.length;
        dot.style.display = 'block';
      } else {
        badge.style.display = 'none';
        dot.style.display = 'none';
      }

      if (alerts.length === 0) {
        list.innerHTML = '<div style="padding:16px; text-align:center; color:var(--text-muted); font-size:12.5px;">No active low-stock alerts.</div>';
      } else {
        list.innerHTML = alerts.slice(0, 6).map((a) => `
          <div style="padding:10px 14px; border-bottom:1px solid var(--border); font-size:12.5px;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
              <strong>${UI.esc(a.item_name)}</strong>
              <span class="badge ${a.alert_type === 'OUT_OF_STOCK' ? 'badge-danger' : 'badge-warning'}">
                ${a.alert_type === 'OUT_OF_STOCK' ? 'Out' : 'Low'}
              </span>
            </div>
            <div style="color:var(--text-muted); margin-top:2px;">
              Available: ${UI.formatNumber(a.current_quantity)} ${UI.esc(a.unit)} (Min: ${UI.formatNumber(a.minimum_stock_level)})
            </div>
          </div>
        `).join('');
      }
    } catch {
      // Ignore transient errors
    }
  }

  async function loadSharedLookups() {
    try {
      const [catRes, supRes, setRes] = await Promise.all([
        API.get('/categories'),
        API.get('/suppliers'),
        API.get('/settings'),
      ]);
      state.categories = catRes.data || [];
      state.suppliers = supRes.data || [];
      state.settings = setRes.data || {};
      if (state.settings.company_name) {
        document.getElementById('sidebarCompanyName').textContent = state.settings.company_name;
      }
    } catch {
      // Handled gracefully
    }
  }

  function navigate(page, params = {}) {
    if (['reports', 'users', 'settings'].includes(page) && state.user?.role !== 'ADMIN') {
      UI.toast('Administrator access required.', 'warning');
      return;
    }

    state.currentPage = page;
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.page === page);
    });

    // Close mobile drawer on navigation
    document.getElementById('sidebar').classList.remove('mobile-open');
    document.getElementById('mobileBackdrop').classList.remove('open');

    const renderer = pageRegistry[page];
    const pageContainer = document.getElementById('pageContent');
    if (renderer) {
      Promise.resolve(renderer(pageContainer, params)).catch((err) => {
        pageContainer.innerHTML = `<div class="empty-state">Failed to load page: ${UI.esc(err.message || 'Unknown error')}</div>`;
        UI.toast(err.message || 'Failed to load page', 'error');
      });
    } else {
      pageContainer.innerHTML = `<div class="empty-state">Page "${UI.esc(page)}" is not registered.</div>`;
    }
  }

  async function init() {
    try {
      const me = await API.get('/auth/me');
      state.user = me.user;
    } catch {
      window.location.replace('/login');
      return;
    }

    // Populate user profile
    document.getElementById('topUserName').textContent = state.user.name;
    document.getElementById('topUserRole').textContent = state.user.role;
    document.getElementById('userAvatar').textContent = state.user.name
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    if (state.user.role === 'ADMIN') {
      document.querySelectorAll('.admin-only').forEach((el) => {
        el.style.display = '';
      });
    }

    await loadSharedLookups();
    await refreshAlertsBadge();

    // Navigation bindings
    document.querySelectorAll('.nav-item[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => navigate(btn.dataset.page));
    });

    // Collapse sidebar
    const sidebar = document.getElementById('sidebar');
    document.getElementById('collapseSidebarBtn').addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
    });

    // Mobile drawer
    const backdrop = document.getElementById('mobileBackdrop');
    document.getElementById('mobileMenuBtn').addEventListener('click', () => {
      sidebar.classList.add('mobile-open');
      backdrop.classList.add('open');
    });
    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('mobile-open');
      backdrop.classList.remove('open');
    });

    // Modal close
    document.getElementById('appModalClose').addEventListener('click', UI.closeModal);
    document.getElementById('appModalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'appModalOverlay') UI.closeModal();
    });

    // Notifications dropdown
    const bellBtn = document.getElementById('notifBellBtn');
    const dropdown = document.getElementById('notifDropdown');
    bellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });
    document.addEventListener('click', () => dropdown.classList.remove('open'));
    document.getElementById('viewAllAlertsBtn').addEventListener('click', () => {
      dropdown.classList.remove('open');
      navigate('alerts');
    });

    // Global search jumps to Inventory with search term
    let searchTimer = null;
    document.getElementById('globalSearchInput').addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      const val = e.target.value;
      searchTimer = setTimeout(() => {
        state.globalSearch = val;
        if (state.currentPage !== 'inventory' && val.trim().length > 0) {
          navigate('inventory', { search: val });
        } else if (state.currentPage === 'inventory') {
          navigate('inventory', { search: val });
        }
      }, 280);
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      try {
        await API.post('/auth/logout', {});
      } finally {
        window.location.replace('/login');
      }
    });

    // Socket.IO live sync
    AppSocket.connect((payload) => {
      refreshAlertsBadge();
      if (payload?.actorName && payload.actorName !== state.user.name) {
        UI.toast(`Live update: ${payload.name || 'Inventory'} updated by ${payload.actorName}`, 'info');
      }
      if (['overview', 'inventory', 'alerts', 'transactions'].includes(state.currentPage)) {
        navigate(state.currentPage);
      }
    });

    UI.refreshIcons();
    navigate('overview');
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    state,
    registerPage,
    navigate,
    refreshAlertsBadge,
    loadSharedLookups,
  };
})();

