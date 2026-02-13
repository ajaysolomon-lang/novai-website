/* ═══════════════════════════════════════════════════════════════
   AliveTrust — Main Application
   SPA router, global state, toast/modal systems, auth management
   ═══════════════════════════════════════════════════════════════ */

const App = (function() {
  'use strict';

  /* ─── Global State ─── */
  const state = {
    currentUser: null,
    currentTrust: null,
    trustId: localStorage.getItem('alivetrust_trust_id') || null,
    computeResults: null,
    nbaActions: null,
    previousCompute: null,
    currentRoute: '',
    sidebarOpen: false
  };

  /* ─── Route Registry ─── */
  const routes = {};

  /* ─── DOM References ─── */
  let appContent = null;
  let authOverlay = null;
  let sidebar = null;
  let sidebarOverlay = null;
  let toastContainer = null;

  /* ═════════════════════════════════════════════════════════════
     INITIALIZATION
     ═════════════════════════════════════════════════════════════ */

  function init() {
    appContent = document.getElementById('app-content');
    authOverlay = document.getElementById('auth-overlay');
    sidebar = document.getElementById('sidebar');
    sidebarOverlay = document.getElementById('sidebar-overlay');
    toastContainer = document.getElementById('toast-container');

    // Set up event listeners
    setupAuth();
    setupNavigation();
    setupMobileNav();

    // Listen for auth expiration
    window.addEventListener('alivetrust:auth-expired', function() {
      state.currentUser = null;
      showAuth();
      toast('Session Expired', 'Please log in again to continue.', 'warning');
    });

    // Check auth state
    if (API.getToken()) {
      hideAuth();
      handleRoute();
    } else {
      showAuth();
    }

    // Listen for hash changes
    window.addEventListener('hashchange', handleRoute);
  }

  /* ═════════════════════════════════════════════════════════════
     ROUTING
     ═════════════════════════════════════════════════════════════ */

  function registerPage(path, renderFn) {
    routes[path] = renderFn;
  }

  function handleRoute() {
    if (!API.getToken()) {
      showAuth();
      return;
    }

    const hash = window.location.hash || '#/dashboard';
    const path = hash.replace('#', '');
    state.currentRoute = path;

    // Update nav active state
    updateNavActive(path);

    // Close mobile sidebar
    closeSidebar();

    // Find matching route
    const renderFn = routes[path];
    if (renderFn) {
      appContent.innerHTML = '<div class="loading-spinner"></div>';
      try {
        renderFn(appContent);
      } catch (err) {
        console.error('Route render error:', err);
        appContent.innerHTML = renderError('Something went wrong loading this page.');
      }
    } else {
      // Default to dashboard
      window.location.hash = '#/dashboard';
    }
  }

  function navigate(path) {
    window.location.hash = '#' + path;
  }

  function updateNavActive(path) {
    const links = document.querySelectorAll('.sidebar-link');
    links.forEach(function(link) {
      const href = link.getAttribute('href');
      if (href === '#' + path) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  /* ═════════════════════════════════════════════════════════════
     AUTHENTICATION
     ═════════════════════════════════════════════════════════════ */

  function setupAuth() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    const loginView = document.getElementById('auth-login');
    const registerView = document.getElementById('auth-register');

    if (showRegisterLink) {
      showRegisterLink.addEventListener('click', function(e) {
        e.preventDefault();
        loginView.classList.add('hidden');
        registerView.classList.remove('hidden');
      });
    }

    if (showLoginLink) {
      showLoginLink.addEventListener('click', function(e) {
        e.preventDefault();
        registerView.classList.add('hidden');
        loginView.classList.remove('hidden');
      });
    }

    if (loginForm) {
      loginForm.addEventListener('submit', handleLogin);
    }

    if (registerForm) {
      registerForm.addEventListener('submit', handleRegister);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    const errorEl = form.querySelector('.auth-error');
    const email = form.querySelector('[name="email"]').value.trim();
    const password = form.querySelector('[name="password"]').value;

    if (!email || !password) {
      showAuthError(errorEl, 'Please enter your email and password.');
      return;
    }

    btn.classList.add('btn-loading');
    btn.disabled = true;
    hideAuthError(errorEl);

    try {
      const data = await API.login(email, password);
      API.setToken(data.token);
      state.currentUser = data.user;
      if (data.trustId) {
        state.trustId = data.trustId;
        localStorage.setItem('alivetrust_trust_id', data.trustId);
      }
      hideAuth();
      updateUserDisplay();
      toast('Welcome back', 'Good to see you, ' + (state.currentUser.name || email.split('@')[0]) + '.', 'success');

      // Route to onboarding if no trust, otherwise dashboard
      if (!state.trustId) {
        navigate('/onboarding');
      } else {
        handleRoute();
      }
    } catch (err) {
      showAuthError(errorEl, err.message);
    } finally {
      btn.classList.remove('btn-loading');
      btn.disabled = false;
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    const errorEl = form.querySelector('.auth-error');
    const name = form.querySelector('[name="name"]').value.trim();
    const email = form.querySelector('[name="email"]').value.trim();
    const password = form.querySelector('[name="password"]').value;
    const confirm = form.querySelector('[name="confirm"]').value;

    if (!name || !email || !password) {
      showAuthError(errorEl, 'Please fill in all fields.');
      return;
    }

    if (password.length < 8) {
      showAuthError(errorEl, 'Password must be at least 8 characters.');
      return;
    }

    if (password !== confirm) {
      showAuthError(errorEl, 'Passwords do not match.');
      return;
    }

    btn.classList.add('btn-loading');
    btn.disabled = true;
    hideAuthError(errorEl);

    try {
      const data = await API.register(email, password, name);
      API.setToken(data.token);
      state.currentUser = data.user;
      hideAuth();
      updateUserDisplay();
      toast('Account created', 'Welcome to AliveTrust, ' + name + '. Let\'s get started.', 'success');
      navigate('/onboarding');
    } catch (err) {
      showAuthError(errorEl, err.message);
    } finally {
      btn.classList.remove('btn-loading');
      btn.disabled = false;
    }
  }

  function showAuth() {
    if (authOverlay) authOverlay.classList.remove('hidden');
  }

  function hideAuth() {
    if (authOverlay) authOverlay.classList.add('hidden');
  }

  function showAuthError(el, msg) {
    if (el) {
      el.textContent = msg;
      el.classList.add('show');
    }
  }

  function hideAuthError(el) {
    if (el) {
      el.classList.remove('show');
    }
  }

  function updateUserDisplay() {
    const nameEl = document.getElementById('user-display-name');
    const avatarEl = document.getElementById('user-avatar');
    if (state.currentUser && nameEl) {
      nameEl.textContent = state.currentUser.name || state.currentUser.email;
    }
    if (state.currentUser && avatarEl) {
      const initials = (state.currentUser.name || state.currentUser.email || 'U')
        .split(' ').map(function(w) { return w[0]; }).join('').substring(0, 2).toUpperCase();
      avatarEl.textContent = initials;
    }
  }

  async function logout() {
    try {
      await API.logout();
    } catch (e) {
      // Ignore logout API errors
    }
    API.clearToken();
    state.currentUser = null;
    state.currentTrust = null;
    state.trustId = null;
    state.computeResults = null;
    state.nbaActions = null;
    localStorage.removeItem('alivetrust_trust_id');
    showAuth();
    toast('Signed out', 'You have been logged out.', 'info');
  }

  /* ═════════════════════════════════════════════════════════════
     NAVIGATION
     ═════════════════════════════════════════════════════════════ */

  function setupNavigation() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function(e) {
        e.preventDefault();
        logout();
      });
    }
  }

  function setupMobileNav() {
    const hamburger = document.getElementById('hamburger-btn');
    if (hamburger) {
      hamburger.addEventListener('click', toggleSidebar);
    }
    if (sidebarOverlay) {
      sidebarOverlay.addEventListener('click', closeSidebar);
    }
  }

  function toggleSidebar() {
    state.sidebarOpen = !state.sidebarOpen;
    if (sidebar) sidebar.classList.toggle('open', state.sidebarOpen);
    if (sidebarOverlay) sidebarOverlay.classList.toggle('show', state.sidebarOpen);
  }

  function closeSidebar() {
    state.sidebarOpen = false;
    if (sidebar) sidebar.classList.remove('open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('show');
  }

  /* ═════════════════════════════════════════════════════════════
     TOAST NOTIFICATIONS
     ═════════════════════════════════════════════════════════════ */

  function toast(title, message, type) {
    type = type || 'info';

    const icons = {
      success: '\u2713',
      error: '\u2717',
      warning: '\u26A0',
      info: '\u2139'
    };

    const el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.innerHTML =
      '<span class="toast-icon">' + (icons[type] || icons.info) + '</span>' +
      '<div class="toast-content">' +
        '<div class="toast-title">' + escapeHtml(title) + '</div>' +
        '<div class="toast-message">' + escapeHtml(message) + '</div>' +
      '</div>' +
      '<button class="toast-close" aria-label="Close">&times;</button>';

    el.querySelector('.toast-close').addEventListener('click', function() {
      removeToast(el);
    });

    if (toastContainer) {
      toastContainer.appendChild(el);
    }

    // Auto-remove after 5 seconds
    setTimeout(function() {
      removeToast(el);
    }, 5000);
  }

  function removeToast(el) {
    if (!el || !el.parentNode) return;
    el.classList.add('removing');
    setTimeout(function() {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 300);
  }

  /* ═════════════════════════════════════════════════════════════
     MODAL SYSTEM
     ═════════════════════════════════════════════════════════════ */

  function showModal(options) {
    // options: { title, body (HTML string), footer (HTML string), large, onClose }
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal' + (options.large ? ' modal-lg' : '') + '">' +
        '<div class="modal-header">' +
          '<h3>' + escapeHtml(options.title || '') + '</h3>' +
          '<button class="modal-close" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="modal-body">' + (options.body || '') + '</div>' +
        (options.footer ? '<div class="modal-footer">' + options.footer + '</div>' : '') +
      '</div>';

    document.body.appendChild(overlay);

    // Trigger show animation
    requestAnimationFrame(function() {
      overlay.classList.add('show');
    });

    // Close handlers
    const closeBtn = overlay.querySelector('.modal-close');
    closeBtn.addEventListener('click', function() {
      closeModal(overlay, options.onClose);
    });

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        closeModal(overlay, options.onClose);
      }
    });

    // ESC key
    function escHandler(e) {
      if (e.key === 'Escape') {
        closeModal(overlay, options.onClose);
        document.removeEventListener('keydown', escHandler);
      }
    }
    document.addEventListener('keydown', escHandler);

    return overlay;
  }

  function closeModal(overlay, callback) {
    if (!overlay) return;
    overlay.classList.remove('show');
    setTimeout(function() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (typeof callback === 'function') callback();
    }, 200);
  }

  /* ═════════════════════════════════════════════════════════════
     UTILITY HELPERS
     ═════════════════════════════════════════════════════════════ */

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatCurrency(num) {
    if (num === null || num === undefined) return '$0';
    return '$' + Number(num).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function formatPercent(num) {
    if (num === null || num === undefined) return '0%';
    return Math.round(num) + '%';
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  function scoreColor(value, thresholds) {
    // thresholds: { green: 80, amber: 50 } — defaults
    const t = thresholds || { green: 80, amber: 50 };
    if (value >= t.green) return 'green';
    if (value >= t.amber) return 'amber';
    return 'red';
  }

  function scoreColorClass(value, thresholds) {
    return 'score-' + scoreColor(value, thresholds);
  }

  function fundingBadge(status) {
    const map = {
      funded: '<span class="badge badge-funded">Funded</span>',
      unfunded: '<span class="badge badge-unfunded">Unfunded</span>',
      partial: '<span class="badge badge-partial">Partial</span>',
      unknown: '<span class="badge badge-unknown">Unknown</span>'
    };
    return map[status] || map.unknown;
  }

  function renderError(message) {
    return '<div class="empty-state">' +
      '<div class="empty-state-icon">\u26A0</div>' +
      '<h3>Something went wrong</h3>' +
      '<p>' + escapeHtml(message) + '</p>' +
      '<button class="btn btn-primary" onclick="location.reload()">Reload Page</button>' +
    '</div>';
  }

  function renderLoading() {
    return '<div class="loading-spinner"></div>';
  }

  /* ═════════════════════════════════════════════════════════════
     PUBLIC API
     ═════════════════════════════════════════════════════════════ */

  return {
    init: init,
    state: state,
    registerPage: registerPage,
    navigate: navigate,
    toast: toast,
    showModal: showModal,
    closeModal: closeModal,
    escapeHtml: escapeHtml,
    formatCurrency: formatCurrency,
    formatPercent: formatPercent,
    formatDate: formatDate,
    formatDateTime: formatDateTime,
    scoreColor: scoreColor,
    scoreColorClass: scoreColorClass,
    fundingBadge: fundingBadge,
    renderError: renderError,
    renderLoading: renderLoading,
    logout: logout
  };
})();

/* ─── Boot on DOM Ready ─── */
document.addEventListener('DOMContentLoaded', function() {
  App.init();
});
