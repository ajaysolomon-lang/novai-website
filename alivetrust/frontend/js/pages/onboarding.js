/* ═══════════════════════════════════════════════════════════════
   AliveTrust — Onboarding Wizard
   Multi-step wizard: Welcome > Assets > Documents > Review
   ═══════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  const STEPS = [
    { id: 'welcome', label: 'Welcome', num: 1 },
    { id: 'assets', label: 'Your Assets', num: 2 },
    { id: 'documents', label: 'Documents', num: 3 },
    { id: 'review', label: 'Review', num: 4 }
  ];

  const TRUST_TYPES = [
    { value: 'revocable', label: 'Revocable Living Trust' },
    { value: 'irrevocable', label: 'Irrevocable Trust' },
    { value: 'joint', label: 'Joint Trust' },
    { value: 'other', label: 'Other / Not Sure' }
  ];

  const ASSET_TYPES = [
    { value: 'real_estate', label: 'Real Estate' },
    { value: 'bank_account', label: 'Bank Account' },
    { value: 'investment', label: 'Investment / Brokerage' },
    { value: 'retirement', label: 'Retirement Account (401k, IRA)' },
    { value: 'life_insurance', label: 'Life Insurance' },
    { value: 'business', label: 'Business Interest' },
    { value: 'vehicle', label: 'Vehicle' },
    { value: 'personal_property', label: 'Valuable Personal Property' },
    { value: 'other', label: 'Other' }
  ];

  const FUNDING_STATUSES = [
    { value: 'funded', label: 'Titled in trust name' },
    { value: 'partial', label: 'Partially transferred' },
    { value: 'unfunded', label: 'Not yet transferred' },
    { value: 'unknown', label: 'I\'m not sure' }
  ];

  const ESSENTIAL_DOCUMENTS = [
    { key: 'trust_agreement', label: 'Trust Agreement (signed, original)', required: true },
    { key: 'trust_amendment', label: 'Trust Amendment(s)', required: false },
    { key: 'pour_over_will', label: 'Pour-Over Will', required: true },
    { key: 'power_of_attorney', label: 'Durable Power of Attorney', required: true },
    { key: 'healthcare_directive', label: 'Advance Healthcare Directive', required: true },
    { key: 'hipaa_authorization', label: 'HIPAA Authorization', required: false },
    { key: 'certificate_of_trust', label: 'Certificate / Abstract of Trust', required: false },
    { key: 'schedule_a', label: 'Schedule A (Asset Schedule)', required: false },
    { key: 'deed_transfer', label: 'Deed Transfer Confirmation(s)', required: false },
    { key: 'beneficiary_designations', label: 'Beneficiary Designation Forms', required: false }
  ];

  let currentStep = 0;
  let wizardData = {
    trust: { name: '', type: 'revocable', state: '', county: '' },
    assets: [],
    documents: {}
  };

  // Load saved progress
  const saved = localStorage.getItem('alivetrust_onboarding');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      wizardData = Object.assign(wizardData, parsed);
    } catch (e) { /* ignore */ }
  }

  function saveProgress() {
    localStorage.setItem('alivetrust_onboarding', JSON.stringify(wizardData));
  }

  /* ─── Main Render ─── */
  function render(container) {
    container.innerHTML =
      '<div class="page-container">' +
        '<div class="page-header text-center">' +
          '<h1 class="page-title">Set Up Your Trust Profile</h1>' +
          '<p class="page-subtitle">Let\'s get a clear picture of where things stand. This takes about 5 minutes.</p>' +
        '</div>' +
        renderStepper() +
        '<div class="card">' +
          '<div class="card-body wizard-body" id="wizard-body"></div>' +
          '<div class="card-footer wizard-footer" id="wizard-footer"></div>' +
        '</div>' +
      '</div>';

    renderStep();
  }

  /* ─── Stepper ─── */
  function renderStepper() {
    let html = '<div class="stepper">';
    STEPS.forEach(function(step, i) {
      let cls = 'stepper-step';
      if (i < currentStep) cls += ' completed';
      if (i === currentStep) cls += ' active';
      html += '<div class="' + cls + '">' +
        '<div class="stepper-dot">' + (i < currentStep ? '\u2713' : step.num) + '</div>' +
        '<span class="stepper-label">' + step.label + '</span>' +
        (i < STEPS.length - 1 ? '' : '') +
      '</div>';
    });
    html += '</div>';
    return html;
  }

  function updateStepper() {
    const container = document.querySelector('.stepper');
    if (container) {
      container.outerHTML = renderStepper();
    }
  }

  /* ─── Step Rendering ─── */
  function renderStep() {
    const body = document.getElementById('wizard-body');
    const footer = document.getElementById('wizard-footer');
    if (!body || !footer) return;

    switch (STEPS[currentStep].id) {
      case 'welcome': renderWelcomeStep(body); break;
      case 'assets': renderAssetsStep(body); break;
      case 'documents': renderDocumentsStep(body); break;
      case 'review': renderReviewStep(body); break;
    }

    renderFooter(footer);
  }

  /* ─── Step 1: Welcome ─── */
  function renderWelcomeStep(body) {
    body.innerHTML =
      '<div style="max-width: 520px; margin: 0 auto;">' +
        '<h3 style="margin-bottom: 0.5rem;">Tell us about your trust</h3>' +
        '<p class="text-dim" style="margin-bottom: 1.5rem;">Don\'t worry if you\'re not sure about everything. We\'ll help you figure it out as we go.</p>' +
        '<div class="form-group">' +
          '<label class="form-label">Trust Name</label>' +
          '<input type="text" class="form-input" id="trust-name" placeholder="e.g., The Smith Family Trust" value="' + App.escapeHtml(wizardData.trust.name) + '">' +
          '<span class="form-help">Usually your family name followed by "Trust" or "Living Trust"</span>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Trust Type</label>' +
          '<select class="form-select" id="trust-type">' +
            TRUST_TYPES.map(function(t) {
              return '<option value="' + t.value + '"' + (wizardData.trust.type === t.value ? ' selected' : '') + '>' + t.label + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div class="form-row">' +
          '<div class="form-group">' +
            '<label class="form-label">State</label>' +
            '<input type="text" class="form-input" id="trust-state" placeholder="e.g., California" value="' + App.escapeHtml(wizardData.trust.state) + '">' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label">County <span class="form-label-hint">(optional)</span></label>' +
            '<input type="text" class="form-input" id="trust-county" placeholder="e.g., Los Angeles" value="' + App.escapeHtml(wizardData.trust.county) + '">' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function collectWelcome() {
    wizardData.trust.name = (document.getElementById('trust-name').value || '').trim();
    wizardData.trust.type = document.getElementById('trust-type').value;
    wizardData.trust.state = (document.getElementById('trust-state').value || '').trim();
    wizardData.trust.county = (document.getElementById('trust-county').value || '').trim();
    saveProgress();
  }

  function validateWelcome() {
    if (!wizardData.trust.name) {
      App.toast('Missing Information', 'Please enter a name for your trust.', 'warning');
      return false;
    }
    if (!wizardData.trust.state) {
      App.toast('Missing Information', 'Please enter the state where your trust was created.', 'warning');
      return false;
    }
    return true;
  }

  /* ─── Step 2: Assets ─── */
  function renderAssetsStep(body) {
    let html =
      '<h3 style="margin-bottom: 0.5rem;">What do you own?</h3>' +
      '<p class="text-dim" style="margin-bottom: 1.5rem;">List the assets you\'d like your trust to protect. You can always add more later.</p>';

    if (wizardData.assets.length > 0) {
      html += '<div class="table-container mb-2"><table>' +
        '<thead><tr><th>Asset</th><th>Type</th><th>Est. Value</th><th>Funding</th><th></th></tr></thead><tbody>';
      wizardData.assets.forEach(function(asset, i) {
        const typeLabel = ASSET_TYPES.find(function(t) { return t.value === asset.type; });
        html += '<tr>' +
          '<td><strong>' + App.escapeHtml(asset.name) + '</strong></td>' +
          '<td class="text-dim text-sm">' + (typeLabel ? typeLabel.label : asset.type) + '</td>' +
          '<td>' + App.formatCurrency(asset.value) + '</td>' +
          '<td>' + App.fundingBadge(asset.funding_status) + '</td>' +
          '<td class="td-actions">' +
            '<button class="btn btn-ghost btn-sm" data-edit-asset="' + i + '">Edit</button>' +
            '<button class="btn btn-ghost btn-sm text-danger" data-remove-asset="' + i + '">Remove</button>' +
          '</td>' +
        '</tr>';
      });
      html += '</tbody></table></div>';
    } else {
      html += '<div class="empty-state" style="padding: 2rem;">' +
        '<div class="empty-state-icon">\uD83C\uDFE0</div>' +
        '<p>No assets added yet. Start by adding your first asset below.</p>' +
      '</div>';
    }

    html += '<button class="btn btn-secondary" id="add-asset-btn">' +
      '<span>+</span> Add an Asset' +
    '</button>';

    body.innerHTML = html;

    // Event listeners
    document.getElementById('add-asset-btn').addEventListener('click', function() {
      showAssetModal(-1);
    });

    body.querySelectorAll('[data-edit-asset]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        showAssetModal(parseInt(btn.getAttribute('data-edit-asset')));
      });
    });

    body.querySelectorAll('[data-remove-asset]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const idx = parseInt(btn.getAttribute('data-remove-asset'));
        wizardData.assets.splice(idx, 1);
        saveProgress();
        renderAssetsStep(body);
      });
    });
  }

  function showAssetModal(editIndex) {
    const isEdit = editIndex >= 0;
    const asset = isEdit ? wizardData.assets[editIndex] : { name: '', type: 'real_estate', value: '', funding_status: 'unknown' };

    const modalBody =
      '<div class="form-group">' +
        '<label class="form-label">Asset Name</label>' +
        '<input type="text" class="form-input" id="modal-asset-name" placeholder="e.g., Primary Residence at 123 Main St" value="' + App.escapeHtml(asset.name) + '">' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Asset Type</label>' +
        '<select class="form-select" id="modal-asset-type">' +
          ASSET_TYPES.map(function(t) {
            return '<option value="' + t.value + '"' + (asset.type === t.value ? ' selected' : '') + '>' + t.label + '</option>';
          }).join('') +
        '</select>' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Estimated Value</label>' +
        '<input type="number" class="form-input" id="modal-asset-value" placeholder="e.g., 500000" value="' + (asset.value || '') + '">' +
        '<span class="form-help">Your best estimate is fine. We\'ll refine later.</span>' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Funding Status</label>' +
        '<select class="form-select" id="modal-asset-funding">' +
          FUNDING_STATUSES.map(function(s) {
            return '<option value="' + s.value + '"' + (asset.funding_status === s.value ? ' selected' : '') + '>' + s.label + '</option>';
          }).join('') +
        '</select>' +
        '<span class="form-help">"Funded" means the asset title has been transferred to the trust.</span>' +
      '</div>';

    const modal = App.showModal({
      title: isEdit ? 'Edit Asset' : 'Add an Asset',
      body: modalBody,
      footer:
        '<button class="btn btn-secondary" id="modal-cancel">Cancel</button>' +
        '<button class="btn btn-primary" id="modal-save">' + (isEdit ? 'Update' : 'Add Asset') + '</button>'
    });

    modal.querySelector('#modal-cancel').addEventListener('click', function() {
      App.closeModal(modal);
    });

    modal.querySelector('#modal-save').addEventListener('click', function() {
      const name = modal.querySelector('#modal-asset-name').value.trim();
      const type = modal.querySelector('#modal-asset-type').value;
      const value = parseFloat(modal.querySelector('#modal-asset-value').value) || 0;
      const funding_status = modal.querySelector('#modal-asset-funding').value;

      if (!name) {
        App.toast('Missing Name', 'Please enter a name for this asset.', 'warning');
        return;
      }

      const assetData = { name: name, type: type, value: value, funding_status: funding_status };

      if (isEdit) {
        wizardData.assets[editIndex] = assetData;
      } else {
        wizardData.assets.push(assetData);
      }

      saveProgress();
      App.closeModal(modal);
      renderAssetsStep(document.getElementById('wizard-body'));
    });
  }

  /* ─── Step 3: Documents ─── */
  function renderDocumentsStep(body) {
    let html =
      '<h3 style="margin-bottom: 0.5rem;">Your Essential Documents</h3>' +
      '<p class="text-dim" style="margin-bottom: 1.5rem;">Check off the documents you currently have. Missing items will show up in your health score.</p>';

    html += '<div style="max-width: 600px;">';
    ESSENTIAL_DOCUMENTS.forEach(function(doc) {
      const checked = wizardData.documents[doc.key] ? ' checked' : '';
      html += '<div class="form-checkbox-group" style="padding: 0.625rem 0; border-bottom: 1px solid var(--border);">' +
        '<input type="checkbox" id="doc-' + doc.key + '" data-doc-key="' + doc.key + '"' + checked + '>' +
        '<label for="doc-' + doc.key + '">' +
          doc.label +
          (doc.required ? ' <span class="text-danger text-xs">(essential)</span>' : ' <span class="text-light text-xs">(recommended)</span>') +
        '</label>' +
      '</div>';
    });
    html += '</div>';

    body.innerHTML = html;

    // Event listeners for checkboxes
    body.querySelectorAll('[data-doc-key]').forEach(function(cb) {
      cb.addEventListener('change', function() {
        wizardData.documents[cb.getAttribute('data-doc-key')] = cb.checked;
        saveProgress();
      });
    });
  }

  /* ─── Step 4: Review ─── */
  function renderReviewStep(body) {
    // Calculate preview scores
    const totalAssets = wizardData.assets.length;
    const fundedAssets = wizardData.assets.filter(function(a) { return a.funding_status === 'funded'; }).length;
    const totalValue = wizardData.assets.reduce(function(sum, a) { return sum + (a.value || 0); }, 0);
    const fundedValue = wizardData.assets.filter(function(a) { return a.funding_status === 'funded'; })
      .reduce(function(sum, a) { return sum + (a.value || 0); }, 0);
    const fundingPct = totalAssets > 0 ? Math.round((fundedAssets / totalAssets) * 100) : 0;
    const valuePct = totalValue > 0 ? Math.round((fundedValue / totalValue) * 100) : 0;

    const essentialDocs = ESSENTIAL_DOCUMENTS.filter(function(d) { return d.required; });
    const completedDocs = essentialDocs.filter(function(d) { return wizardData.documents[d.key]; }).length;
    const docPct = essentialDocs.length > 0 ? Math.round((completedDocs / essentialDocs.length) * 100) : 0;

    let html =
      '<h3 style="margin-bottom: 0.5rem;">Here\'s what we see so far</h3>' +
      '<p class="text-dim" style="margin-bottom: 1.5rem;">Review your information below. You can always update this later.</p>';

    // Trust info
    html += '<div class="card mb-2" style="box-shadow: none; border: 1px solid var(--border);">' +
      '<div class="card-header"><h3>Trust Information</h3></div>' +
      '<div class="card-body">' +
        '<p><strong>' + App.escapeHtml(wizardData.trust.name || 'Unnamed Trust') + '</strong></p>' +
        '<p class="text-dim text-sm">' +
          (TRUST_TYPES.find(function(t) { return t.value === wizardData.trust.type; }) || {}).label +
          ' &middot; ' + App.escapeHtml(wizardData.trust.state || 'No state') +
          (wizardData.trust.county ? ', ' + App.escapeHtml(wizardData.trust.county) : '') +
        '</p>' +
      '</div>' +
    '</div>';

    // Preview scores
    html += '<div class="grid-3 mb-2">' +
      '<div class="score-card ' + App.scoreColorClass(valuePct) + '">' +
        '<div class="score-card-indicator"></div>' +
        '<div class="score-card-label">Funding (by value)</div>' +
        '<div class="score-card-value">' + valuePct + '%</div>' +
        '<div class="score-card-detail">' + App.formatCurrency(fundedValue) + ' of ' + App.formatCurrency(totalValue) + '</div>' +
      '</div>' +
      '<div class="score-card ' + App.scoreColorClass(fundingPct) + '">' +
        '<div class="score-card-indicator"></div>' +
        '<div class="score-card-label">Funding (by count)</div>' +
        '<div class="score-card-value">' + fundingPct + '%</div>' +
        '<div class="score-card-detail">' + fundedAssets + ' of ' + totalAssets + ' assets</div>' +
      '</div>' +
      '<div class="score-card ' + App.scoreColorClass(docPct) + '">' +
        '<div class="score-card-indicator"></div>' +
        '<div class="score-card-label">Document Completeness</div>' +
        '<div class="score-card-value">' + docPct + '%</div>' +
        '<div class="score-card-detail">' + completedDocs + ' of ' + essentialDocs.length + ' essential docs</div>' +
      '</div>' +
    '</div>';

    // Assets summary
    html += '<div class="card mb-2" style="box-shadow: none; border: 1px solid var(--border);">' +
      '<div class="card-header"><h3>Assets (' + totalAssets + ')</h3></div>' +
      '<div class="card-body">';
    if (totalAssets === 0) {
      html += '<p class="text-dim">No assets added yet. You can add them after setup.</p>';
    } else {
      wizardData.assets.forEach(function(asset) {
        html += '<div style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--border);">' +
          '<div>' +
            '<strong class="text-sm">' + App.escapeHtml(asset.name) + '</strong>' +
            '<br><span class="text-xs text-dim">' + App.formatCurrency(asset.value) + '</span>' +
          '</div>' +
          App.fundingBadge(asset.funding_status) +
        '</div>';
      });
    }
    html += '</div></div>';

    // Documents summary
    const allDocs = ESSENTIAL_DOCUMENTS;
    const checkedCount = allDocs.filter(function(d) { return wizardData.documents[d.key]; }).length;
    html += '<div class="card" style="box-shadow: none; border: 1px solid var(--border);">' +
      '<div class="card-header"><h3>Documents (' + checkedCount + ' of ' + allDocs.length + ')</h3></div>' +
      '<div class="card-body">';
    allDocs.forEach(function(doc) {
      const has = wizardData.documents[doc.key];
      html += '<div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.375rem 0;" class="text-sm">' +
        '<span style="color: ' + (has ? 'var(--success)' : 'var(--text-light)') + ';">' + (has ? '\u2713' : '\u2014') + '</span>' +
        '<span' + (has ? '' : ' class="text-light"') + '>' + doc.label + '</span>' +
      '</div>';
    });
    html += '</div></div>';

    body.innerHTML = html;
  }

  /* ─── Footer Navigation ─── */
  function renderFooter(footer) {
    const isFirst = currentStep === 0;
    const isLast = currentStep === STEPS.length - 1;

    footer.innerHTML =
      (isFirst
        ? '<div></div>'
        : '<button class="btn btn-secondary" id="wizard-back">Back</button>') +
      (isLast
        ? '<button class="btn btn-primary btn-lg" id="wizard-finish">Create My Trust Profile</button>'
        : '<button class="btn btn-primary" id="wizard-next">Continue</button>');

    if (!isFirst) {
      footer.querySelector('#wizard-back').addEventListener('click', goBack);
    }
    if (isLast) {
      footer.querySelector('#wizard-finish').addEventListener('click', finishWizard);
    } else {
      footer.querySelector('#wizard-next').addEventListener('click', goNext);
    }
  }

  function goNext() {
    // Collect current step data
    if (STEPS[currentStep].id === 'welcome') {
      collectWelcome();
      if (!validateWelcome()) return;
    }

    if (currentStep < STEPS.length - 1) {
      currentStep++;
      updateStepper();
      renderStep();
      window.scrollTo(0, 0);
    }
  }

  function goBack() {
    if (currentStep > 0) {
      currentStep--;
      updateStepper();
      renderStep();
      window.scrollTo(0, 0);
    }
  }

  async function finishWizard() {
    const btn = document.getElementById('wizard-finish');
    btn.classList.add('btn-loading');
    btn.disabled = true;

    try {
      // Create trust via API
      const trust = await API.createTrust({
        name: wizardData.trust.name,
        type: wizardData.trust.type,
        state: wizardData.trust.state,
        county: wizardData.trust.county
      });

      App.state.trustId = trust.id;
      App.state.currentTrust = trust;
      localStorage.setItem('alivetrust_trust_id', trust.id);

      // Create assets
      for (let i = 0; i < wizardData.assets.length; i++) {
        await API.createAsset(trust.id, wizardData.assets[i]);
      }

      // Create documents
      const docKeys = Object.keys(wizardData.documents);
      for (let i = 0; i < docKeys.length; i++) {
        if (wizardData.documents[docKeys[i]]) {
          await API.createDocument(trust.id, {
            type: docKeys[i],
            label: (ESSENTIAL_DOCUMENTS.find(function(d) { return d.key === docKeys[i]; }) || {}).label || docKeys[i],
            status: 'complete'
          });
        }
      }

      // Run initial computation
      try {
        const result = await API.compute(trust.id);
        App.state.computeResults = result;
      } catch (e) {
        // Non-critical
      }

      // Clean up saved progress
      localStorage.removeItem('alivetrust_onboarding');

      App.toast('Trust Profile Created', 'Your trust health dashboard is ready.', 'success');
      App.navigate('/dashboard');
    } catch (err) {
      App.toast('Error', err.message || 'Failed to create trust profile.', 'error');
      btn.classList.remove('btn-loading');
      btn.disabled = false;
    }
  }

  /* ─── Register Route ─── */
  App.registerPage('/onboarding', render);

})();
