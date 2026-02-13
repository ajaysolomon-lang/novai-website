/* ═══════════════════════════════════════════════════════════════
   AliveTrust — Provider Directory
   Search, filter, consent gate, provider cards
   ═══════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  let providers = [];
  let consentGiven = false;
  let filterState = '';
  let filterCounty = '';
  let filterSpecialty = '';
  let isLoading = false;

  const SPECIALTIES = [
    { value: 'estate_planning', label: 'Estate Planning Attorney' },
    { value: 'trust_administration', label: 'Trust Administration' },
    { value: 'elder_law', label: 'Elder Law' },
    { value: 'tax_planning', label: 'Tax Planning' },
    { value: 'financial_advisor', label: 'Financial Advisor' },
    { value: 'cpa', label: 'CPA / Tax Professional' },
    { value: 'insurance', label: 'Insurance Specialist' },
    { value: 'notary', label: 'Notary Public' },
    { value: 'real_estate', label: 'Real Estate Attorney' }
  ];

  // Load consent from session
  consentGiven = sessionStorage.getItem('alivetrust_provider_consent') === 'true';

  /* ─── Main Render ─── */
  async function render(container) {
    container.innerHTML =
      '<div class="page-container">' +
        '<div class="page-header">' +
          '<h1 class="page-title">Provider Directory</h1>' +
          '<p class="page-subtitle">Find verified professionals in your area who can help with your trust.</p>' +
        '</div>' +
        '<div class="disclaimer mb-2">' +
          '<strong>Important:</strong> Providers are shown based on verified credentials and locality. ' +
          'This is not a referral or endorsement. AliveTrust does not receive compensation from listed providers. ' +
          'Always perform your own due diligence before engaging any professional.' +
        '</div>' +
        '<div id="provider-consent"></div>' +
        '<div id="provider-filters"></div>' +
        '<div id="provider-results"></div>' +
      '</div>';

    renderConsentGate();
    renderFilters();

    // Auto-search if trust has state info
    if (App.state.currentTrust && App.state.currentTrust.state) {
      filterState = App.state.currentTrust.state;
      filterCounty = App.state.currentTrust.county || '';
      renderFilters();
    }
  }

  /* ─── Consent Gate ─── */
  function renderConsentGate() {
    const el = document.getElementById('provider-consent');
    if (!el) return;

    if (consentGiven) {
      el.innerHTML = '';
      return;
    }

    el.innerHTML =
      '<div class="consent-gate">' +
        '<div class="form-checkbox-group">' +
          '<input type="checkbox" id="provider-consent-cb">' +
          '<label for="provider-consent-cb">' +
            'I understand that contacting a provider is my choice. AliveTrust does not endorse or guarantee any provider. ' +
            'I will perform my own research and due diligence before engaging any professional listed here.' +
          '</label>' +
        '</div>' +
      '</div>';

    el.querySelector('#provider-consent-cb').addEventListener('change', function(e) {
      consentGiven = e.target.checked;
      if (consentGiven) {
        sessionStorage.setItem('alivetrust_provider_consent', 'true');
        renderConsentGate();
        renderResults();
      }
    });
  }

  /* ─── Filters ─── */
  function renderFilters() {
    const el = document.getElementById('provider-filters');
    if (!el) return;

    el.innerHTML =
      '<div class="filter-bar">' +
        '<input type="text" class="form-input" id="filter-state" placeholder="State (e.g., California)" value="' + App.escapeHtml(filterState) + '">' +
        '<input type="text" class="form-input" id="filter-county" placeholder="County (optional)" value="' + App.escapeHtml(filterCounty) + '" style="min-width: 180px;">' +
        '<select class="form-select" id="filter-specialty">' +
          '<option value="">All Specialties</option>' +
          SPECIALTIES.map(function(s) {
            return '<option value="' + s.value + '"' + (filterSpecialty === s.value ? ' selected' : '') + '>' + s.label + '</option>';
          }).join('') +
        '</select>' +
        '<button class="btn btn-primary" id="search-providers-btn">Search</button>' +
      '</div>';

    el.querySelector('#filter-state').addEventListener('input', function(e) {
      filterState = e.target.value;
    });
    el.querySelector('#filter-county').addEventListener('input', function(e) {
      filterCounty = e.target.value;
    });
    el.querySelector('#filter-specialty').addEventListener('change', function(e) {
      filterSpecialty = e.target.value;
    });
    el.querySelector('#search-providers-btn').addEventListener('click', searchProviders);

    // Enter key triggers search
    el.querySelectorAll('.form-input').forEach(function(input) {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') searchProviders();
      });
    });
  }

  /* ─── Search ─── */
  async function searchProviders() {
    if (!filterState.trim()) {
      App.toast('Enter a State', 'Please enter a state to search for providers.', 'warning');
      return;
    }

    const resultsEl = document.getElementById('provider-results');
    if (!resultsEl) return;

    isLoading = true;
    resultsEl.innerHTML = App.renderLoading();

    const searchBtn = document.getElementById('search-providers-btn');
    if (searchBtn) {
      searchBtn.classList.add('btn-loading');
      searchBtn.disabled = true;
    }

    try {
      const filters = { state: filterState.trim() };
      if (filterCounty.trim()) filters.county = filterCounty.trim();
      if (filterSpecialty) filters.specialty = filterSpecialty;

      providers = await API.searchProviders(filters);
      renderResults();
    } catch (err) {
      resultsEl.innerHTML = App.renderError(err.message);
    } finally {
      isLoading = false;
      if (searchBtn) {
        searchBtn.classList.remove('btn-loading');
        searchBtn.disabled = false;
      }
    }
  }

  /* ─── Results ─── */
  function renderResults() {
    const el = document.getElementById('provider-results');
    if (!el) return;

    if (isLoading) return;

    if (providers.length === 0) {
      if (filterState.trim()) {
        el.innerHTML =
          '<div class="card">' +
            '<div class="empty-state">' +
              '<div class="empty-state-icon">\uD83D\uDD0D</div>' +
              '<h3>No providers found</h3>' +
              '<p>We couldn\'t find verified providers matching your criteria. Try broadening your search or check back later as our directory grows.</p>' +
            '</div>' +
          '</div>';
      } else {
        el.innerHTML =
          '<div class="card">' +
            '<div class="empty-state">' +
              '<div class="empty-state-icon">\uD83D\uDC64</div>' +
              '<h3>Search for providers</h3>' +
              '<p>Enter your state and optional county above, then click Search to find verified professionals near you.</p>' +
            '</div>' +
          '</div>';
      }
      return;
    }

    let html = '<div class="mb-1 text-sm text-dim">' + providers.length + ' provider' + (providers.length !== 1 ? 's' : '') + ' found</div>';
    html += '<div class="grid-cards">';

    providers.forEach(function(provider) {
      const specialtyLabel = (SPECIALTIES.find(function(s) { return s.value === provider.specialty; }) || {}).label || provider.specialty || '';

      html += '<div class="provider-card">' +
        '<div class="provider-card-name">' + App.escapeHtml(provider.name || 'Provider') + '</div>' +
        '<div class="provider-card-specialty">' + App.escapeHtml(specialtyLabel) + '</div>' +
        '<div class="provider-card-location">' +
          App.escapeHtml((provider.city || '') + (provider.city && provider.state ? ', ' : '') + (provider.state || '')) +
          (provider.county ? ' &middot; ' + App.escapeHtml(provider.county) + ' County' : '') +
        '</div>';

      // Verification badges
      const badges = provider.verifications || [];
      if (badges.length > 0) {
        html += '<div class="provider-card-badges">';
        badges.forEach(function(v) {
          html += '<span class="badge badge-verified">' + App.escapeHtml(v) + '</span>';
        });
        html += '</div>';
      }

      // Why shown
      if (provider.why_shown) {
        html += '<div class="provider-card-why">"' + App.escapeHtml(provider.why_shown) + '"</div>';
      }

      // Contact info (hidden behind consent)
      html += '<div class="provider-card-contact' + (consentGiven ? '' : ' hidden') + '">';
      if (provider.phone) {
        html += '<p><strong>Phone:</strong> ' + App.escapeHtml(provider.phone) + '</p>';
      }
      if (provider.email) {
        html += '<p><strong>Email:</strong> <a href="mailto:' + App.escapeHtml(provider.email) + '">' + App.escapeHtml(provider.email) + '</a></p>';
      }
      if (provider.website) {
        html += '<p><strong>Website:</strong> <a href="' + App.escapeHtml(provider.website) + '" target="_blank" rel="noopener">' + App.escapeHtml(provider.website) + '</a></p>';
      }
      if (!consentGiven) {
        html += '<p class="text-xs text-dim mt-1">Accept the consent agreement above to view contact information.</p>';
      }
      html += '</div>';

      // If no consent, show lock message
      if (!consentGiven) {
        html += '<div class="text-xs text-dim mt-1" style="padding: 0.5rem 0.75rem; background: var(--surface-alt); border-radius: var(--radius-xs);">' +
          '\uD83D\uDD12 Accept the consent agreement above to view contact details.' +
        '</div>';
      }

      html += '</div>';
    });

    html += '</div>';
    el.innerHTML = html;
  }

  /* ─── Register Route ─── */
  App.registerPage('/providers', render);

})();
