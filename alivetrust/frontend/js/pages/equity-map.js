/* ═══════════════════════════════════════════════════════════════
   AliveTrust — My Equity Map
   Asset inventory with funding status, evidence tracking, filters
   ═══════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  const ASSET_TYPES = [
    { value: 'real_estate', label: 'Real Estate' },
    { value: 'bank_account', label: 'Bank Account' },
    { value: 'investment', label: 'Investment / Brokerage' },
    { value: 'retirement', label: 'Retirement Account' },
    { value: 'life_insurance', label: 'Life Insurance' },
    { value: 'business', label: 'Business Interest' },
    { value: 'vehicle', label: 'Vehicle' },
    { value: 'personal_property', label: 'Personal Property' },
    { value: 'other', label: 'Other' }
  ];

  const FUNDING_STATUSES = [
    { value: 'funded', label: 'Funded (titled in trust)' },
    { value: 'partial', label: 'Partially transferred' },
    { value: 'unfunded', label: 'Not yet transferred' },
    { value: 'unknown', label: 'Unknown' }
  ];

  let assets = [];
  let evidence = [];
  let filterType = '';
  let filterFunding = '';

  /* ─── Main Render ─── */
  async function render(container) {
    container.innerHTML =
      '<div class="page-container">' +
        '<div class="page-header">' +
          '<div class="flex items-center justify-between">' +
            '<div>' +
              '<h1 class="page-title">My Equity Map</h1>' +
              '<p class="page-subtitle">Everything you own, and how well it\'s protected.</p>' +
            '</div>' +
            '<button class="btn btn-primary" id="add-asset-btn"><span>+</span> Add Asset</button>' +
          '</div>' +
        '</div>' +
        '<div id="equity-summary"></div>' +
        '<div id="equity-filters"></div>' +
        '<div id="equity-table"></div>' +
      '</div>';

    document.getElementById('add-asset-btn').addEventListener('click', function() {
      showAssetModal(null);
    });

    await loadData();
  }

  /* ─── Load Data ─── */
  async function loadData() {
    const trustId = App.state.trustId;
    if (!trustId) {
      App.navigate('/onboarding');
      return;
    }

    const tableEl = document.getElementById('equity-table');
    if (tableEl) tableEl.innerHTML = App.renderLoading();

    try {
      const results = await Promise.all([
        API.getAssets(trustId),
        API.getEvidence(trustId)
      ]);
      assets = results[0] || [];
      evidence = results[1] || [];
      renderSummary();
      renderFilters();
      renderTable();
    } catch (err) {
      if (tableEl) tableEl.innerHTML = App.renderError(err.message);
    }
  }

  /* ─── Summary Bar ─── */
  function renderSummary() {
    const el = document.getElementById('equity-summary');
    if (!el) return;

    const totalValue = assets.reduce(function(s, a) { return s + (a.value || 0); }, 0);
    const fundedValue = assets.filter(function(a) { return a.funding_status === 'funded'; })
      .reduce(function(s, a) { return s + (a.value || 0); }, 0);
    const fundedPct = totalValue > 0 ? Math.round((fundedValue / totalValue) * 100) : 0;
    const probateExposure = totalValue - fundedValue;
    const partialCount = assets.filter(function(a) { return a.funding_status === 'partial'; }).length;
    const unfundedCount = assets.filter(function(a) { return a.funding_status === 'unfunded' || a.funding_status === 'unknown'; }).length;

    el.innerHTML =
      '<div class="summary-bar">' +
        '<div class="summary-stat">' +
          '<div class="summary-stat-label">Total Estate Value</div>' +
          '<div class="summary-stat-value">' + App.formatCurrency(totalValue) + '</div>' +
        '</div>' +
        '<div class="summary-stat">' +
          '<div class="summary-stat-label">Funded</div>' +
          '<div class="summary-stat-value" style="color: var(--success);">' + fundedPct + '%</div>' +
        '</div>' +
        '<div class="summary-stat">' +
          '<div class="summary-stat-label">Probate Exposure</div>' +
          '<div class="summary-stat-value" style="color: ' + (probateExposure > 0 ? 'var(--danger)' : 'var(--success)') + ';">' + App.formatCurrency(probateExposure) + '</div>' +
        '</div>' +
        '<div class="summary-stat">' +
          '<div class="summary-stat-label">Need Attention</div>' +
          '<div class="summary-stat-value" style="color: ' + ((partialCount + unfundedCount) > 0 ? 'var(--warning)' : 'var(--success)') + ';">' + (partialCount + unfundedCount) + '</div>' +
        '</div>' +
      '</div>';
  }

  /* ─── Filters ─── */
  function renderFilters() {
    const el = document.getElementById('equity-filters');
    if (!el) return;

    el.innerHTML =
      '<div class="filter-bar">' +
        '<select class="form-select" id="filter-type">' +
          '<option value="">All Types</option>' +
          ASSET_TYPES.map(function(t) {
            return '<option value="' + t.value + '"' + (filterType === t.value ? ' selected' : '') + '>' + t.label + '</option>';
          }).join('') +
        '</select>' +
        '<select class="form-select" id="filter-funding">' +
          '<option value="">All Statuses</option>' +
          '<option value="funded"' + (filterFunding === 'funded' ? ' selected' : '') + '>Funded</option>' +
          '<option value="partial"' + (filterFunding === 'partial' ? ' selected' : '') + '>Partial</option>' +
          '<option value="unfunded"' + (filterFunding === 'unfunded' ? ' selected' : '') + '>Unfunded</option>' +
          '<option value="unknown"' + (filterFunding === 'unknown' ? ' selected' : '') + '>Unknown</option>' +
        '</select>' +
        '<span class="text-sm text-dim">' + getFilteredAssets().length + ' of ' + assets.length + ' assets</span>' +
      '</div>';

    el.querySelector('#filter-type').addEventListener('change', function(e) {
      filterType = e.target.value;
      renderFilters();
      renderTable();
    });

    el.querySelector('#filter-funding').addEventListener('change', function(e) {
      filterFunding = e.target.value;
      renderFilters();
      renderTable();
    });
  }

  function getFilteredAssets() {
    return assets.filter(function(a) {
      if (filterType && a.type !== filterType) return false;
      if (filterFunding && a.funding_status !== filterFunding) return false;
      return true;
    });
  }

  /* ─── Table ─── */
  function renderTable() {
    const el = document.getElementById('equity-table');
    if (!el) return;

    const filtered = getFilteredAssets();

    if (filtered.length === 0 && assets.length === 0) {
      el.innerHTML =
        '<div class="card">' +
          '<div class="empty-state">' +
            '<div class="empty-state-icon">\uD83D\uDCCA</div>' +
            '<h3>No assets yet</h3>' +
            '<p>Add your first asset to start building your equity map. Every piece of property, account, and valuable you own can be tracked here.</p>' +
            '<button class="btn btn-primary" id="empty-add-btn"><span>+</span> Add Your First Asset</button>' +
          '</div>' +
        '</div>';
      document.getElementById('empty-add-btn').addEventListener('click', function() {
        showAssetModal(null);
      });
      return;
    }

    if (filtered.length === 0) {
      el.innerHTML =
        '<div class="card"><div class="table-empty"><p class="text-dim">No assets match your filters.</p></div></div>';
      return;
    }

    let html = '<div class="table-container"><table>' +
      '<thead><tr>' +
        '<th>Asset</th>' +
        '<th>Type</th>' +
        '<th>Value</th>' +
        '<th>Funding</th>' +
        '<th>Evidence</th>' +
        '<th>Actions</th>' +
      '</tr></thead><tbody>';

    filtered.forEach(function(asset) {
      const typeLabel = (ASSET_TYPES.find(function(t) { return t.value === asset.type; }) || {}).label || asset.type;
      const assetEvidence = evidence.filter(function(e) { return e.asset_id === asset.id; });
      const hasEvidence = assetEvidence.length > 0;
      const hasConflict = asset.beneficiary_conflict;

      let badges = App.fundingBadge(asset.funding_status);
      if (!hasEvidence) {
        badges += ' <span class="badge badge-missing">No Evidence</span>';
      }
      if (hasConflict) {
        badges += ' <span class="badge badge-conflict">Conflict</span>';
      }

      html += '<tr>' +
        '<td><strong>' + App.escapeHtml(asset.name) + '</strong></td>' +
        '<td class="text-dim text-sm">' + App.escapeHtml(typeLabel) + '</td>' +
        '<td>' + App.formatCurrency(asset.value) + '</td>' +
        '<td>' + badges + '</td>' +
        '<td>' +
          (hasEvidence
            ? '<span class="badge badge-verified">' + assetEvidence.length + ' item' + (assetEvidence.length !== 1 ? 's' : '') + '</span>'
            : '<span class="text-light text-xs">None</span>') +
        '</td>' +
        '<td class="td-actions">' +
          '<button class="btn btn-ghost btn-sm" data-edit="' + asset.id + '">Edit</button>' +
          '<button class="btn btn-ghost btn-sm text-danger" data-delete="' + asset.id + '">Delete</button>' +
        '</td>' +
      '</tr>';
    });

    html += '</tbody></table></div>';
    el.innerHTML = html;

    // Event listeners
    el.querySelectorAll('[data-edit]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const assetId = btn.getAttribute('data-edit');
        const asset = assets.find(function(a) { return a.id === assetId; });
        if (asset) showAssetModal(asset);
      });
    });

    el.querySelectorAll('[data-delete]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const assetId = btn.getAttribute('data-delete');
        confirmDeleteAsset(assetId);
      });
    });
  }

  /* ─── Add/Edit Modal ─── */
  function showAssetModal(existingAsset) {
    const isEdit = !!existingAsset;
    const asset = existingAsset || { name: '', type: 'real_estate', value: '', funding_status: 'unknown' };

    const body =
      '<div class="form-group">' +
        '<label class="form-label">Asset Name</label>' +
        '<input type="text" class="form-input" id="m-asset-name" placeholder="e.g., Primary Residence" value="' + App.escapeHtml(asset.name || '') + '">' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label class="form-label">Type</label>' +
          '<select class="form-select" id="m-asset-type">' +
            ASSET_TYPES.map(function(t) {
              return '<option value="' + t.value + '"' + (asset.type === t.value ? ' selected' : '') + '>' + t.label + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Estimated Value</label>' +
          '<input type="number" class="form-input" id="m-asset-value" placeholder="500000" value="' + (asset.value || '') + '">' +
        '</div>' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Funding Status</label>' +
        '<select class="form-select" id="m-asset-funding">' +
          FUNDING_STATUSES.map(function(s) {
            return '<option value="' + s.value + '"' + (asset.funding_status === s.value ? ' selected' : '') + '>' + s.label + '</option>';
          }).join('') +
        '</select>' +
        '<span class="form-help">"Funded" means the title or registration has been changed to the trust\'s name.</span>' +
      '</div>';

    const modal = App.showModal({
      title: isEdit ? 'Edit Asset' : 'Add Asset',
      body: body,
      footer:
        '<button class="btn btn-secondary" id="m-cancel">Cancel</button>' +
        '<button class="btn btn-primary" id="m-save">' + (isEdit ? 'Save Changes' : 'Add Asset') + '</button>'
    });

    modal.querySelector('#m-cancel').addEventListener('click', function() {
      App.closeModal(modal);
    });

    modal.querySelector('#m-save').addEventListener('click', async function() {
      const name = modal.querySelector('#m-asset-name').value.trim();
      const type = modal.querySelector('#m-asset-type').value;
      const value = parseFloat(modal.querySelector('#m-asset-value').value) || 0;
      const funding_status = modal.querySelector('#m-asset-funding').value;

      if (!name) {
        App.toast('Missing Name', 'Please enter a name for this asset.', 'warning');
        return;
      }

      const saveBtn = modal.querySelector('#m-save');
      saveBtn.classList.add('btn-loading');
      saveBtn.disabled = true;

      try {
        const data = { name: name, type: type, value: value, funding_status: funding_status };
        if (isEdit) {
          await API.updateAsset(App.state.trustId, asset.id, data);
          App.toast('Asset Updated', name + ' has been updated.', 'success');
        } else {
          await API.createAsset(App.state.trustId, data);
          App.toast('Asset Added', name + ' has been added to your equity map.', 'success');
        }
        App.closeModal(modal);
        await loadData();
      } catch (err) {
        App.toast('Error', err.message, 'error');
        saveBtn.classList.remove('btn-loading');
        saveBtn.disabled = false;
      }
    });
  }

  /* ─── Delete Confirmation ─── */
  function confirmDeleteAsset(assetId) {
    const asset = assets.find(function(a) { return a.id === assetId; });
    if (!asset) return;

    const modal = App.showModal({
      title: 'Remove Asset',
      body:
        '<p>Are you sure you want to remove <strong>' + App.escapeHtml(asset.name) + '</strong> from your equity map?</p>' +
        '<p class="text-dim text-sm">This will also remove any linked evidence. This action cannot be undone.</p>',
      footer:
        '<button class="btn btn-secondary" id="m-cancel">Keep Asset</button>' +
        '<button class="btn btn-danger" id="m-delete">Remove Asset</button>'
    });

    modal.querySelector('#m-cancel').addEventListener('click', function() {
      App.closeModal(modal);
    });

    modal.querySelector('#m-delete').addEventListener('click', async function() {
      const btn = modal.querySelector('#m-delete');
      btn.classList.add('btn-loading');
      btn.disabled = true;

      try {
        await API.deleteAsset(App.state.trustId, assetId);
        App.toast('Asset Removed', asset.name + ' has been removed.', 'info');
        App.closeModal(modal);
        await loadData();
      } catch (err) {
        App.toast('Error', err.message, 'error');
        btn.classList.remove('btn-loading');
        btn.disabled = false;
      }
    });
  }

  /* ─── Register Route ─── */
  App.registerPage('/equity-map', render);

})();
