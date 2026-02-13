/* ═══════════════════════════════════════════════════════════════
   AliveTrust — My Proof Pack
   Two tabs: Documents | Evidence
   Upload, link evidence, filter by status/type
   ═══════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  let documents = [];
  let evidenceItems = [];
  let assets = [];
  let activeTab = 'documents';
  let filterStatus = '';
  let filterDocType = '';

  const DOC_STATUSES = [
    { value: 'complete', label: 'Complete', badge: 'badge-funded' },
    { value: 'missing', label: 'Missing', badge: 'badge-unfunded' },
    { value: 'expired', label: 'Expired', badge: 'badge-partial' },
    { value: 'draft', label: 'Draft', badge: 'badge-unknown' }
  ];

  const EVIDENCE_TYPES = [
    { value: 'title_deed', label: 'Title / Deed' },
    { value: 'account_statement', label: 'Account Statement' },
    { value: 'registration', label: 'Registration Document' },
    { value: 'beneficiary_form', label: 'Beneficiary Designation' },
    { value: 'transfer_letter', label: 'Transfer Letter' },
    { value: 'screenshot', label: 'Screenshot / Photo' },
    { value: 'notarized_doc', label: 'Notarized Document' },
    { value: 'other', label: 'Other' }
  ];

  const VERIFICATION_STATUSES = [
    { value: 'verified', label: 'Verified', badge: 'badge-funded' },
    { value: 'pending', label: 'Pending Review', badge: 'badge-partial' },
    { value: 'unverified', label: 'Unverified', badge: 'badge-unknown' },
    { value: 'rejected', label: 'Rejected', badge: 'badge-unfunded' }
  ];

  /* ─── Main Render ─── */
  async function render(container) {
    container.innerHTML =
      '<div class="page-container">' +
        '<div class="page-header">' +
          '<div class="flex items-center justify-between">' +
            '<div>' +
              '<h1 class="page-title">My Proof Pack</h1>' +
              '<p class="page-subtitle">Your documents and evidence, organized and ready when you need them.</p>' +
            '</div>' +
            '<div class="flex gap-1">' +
              '<button class="btn btn-secondary" id="add-document-btn">+ Document</button>' +
              '<button class="btn btn-primary" id="add-evidence-btn">+ Evidence</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div id="proof-tabs"></div>' +
        '<div id="proof-filters"></div>' +
        '<div id="proof-content"></div>' +
      '</div>';

    document.getElementById('add-document-btn').addEventListener('click', showAddDocumentModal);
    document.getElementById('add-evidence-btn').addEventListener('click', showAddEvidenceModal);

    await loadData();
  }

  /* ─── Load Data ─── */
  async function loadData() {
    const trustId = App.state.trustId;
    if (!trustId) {
      App.navigate('/onboarding');
      return;
    }

    const contentEl = document.getElementById('proof-content');
    if (contentEl) contentEl.innerHTML = App.renderLoading();

    try {
      const results = await Promise.all([
        API.getDocuments(trustId),
        API.getEvidence(trustId),
        API.getAssets(trustId)
      ]);
      documents = results[0] || [];
      evidenceItems = results[1] || [];
      assets = results[2] || [];
      renderTabs();
      renderFilters();
      renderContent();
    } catch (err) {
      if (contentEl) contentEl.innerHTML = App.renderError(err.message);
    }
  }

  /* ─── Tabs ─── */
  function renderTabs() {
    const el = document.getElementById('proof-tabs');
    if (!el) return;

    el.innerHTML =
      '<div class="tabs">' +
        '<button class="tab-btn' + (activeTab === 'documents' ? ' active' : '') + '" data-tab="documents">' +
          'Documents (' + documents.length + ')' +
        '</button>' +
        '<button class="tab-btn' + (activeTab === 'evidence' ? ' active' : '') + '" data-tab="evidence">' +
          'Evidence (' + evidenceItems.length + ')' +
        '</button>' +
      '</div>';

    el.querySelectorAll('.tab-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        activeTab = btn.getAttribute('data-tab');
        filterStatus = '';
        filterDocType = '';
        renderTabs();
        renderFilters();
        renderContent();
      });
    });
  }

  /* ─── Filters ─── */
  function renderFilters() {
    const el = document.getElementById('proof-filters');
    if (!el) return;

    if (activeTab === 'documents') {
      el.innerHTML =
        '<div class="filter-bar">' +
          '<select class="form-select" id="filter-doc-status">' +
            '<option value="">All Statuses</option>' +
            DOC_STATUSES.map(function(s) {
              return '<option value="' + s.value + '"' + (filterStatus === s.value ? ' selected' : '') + '>' + s.label + '</option>';
            }).join('') +
          '</select>' +
        '</div>';

      el.querySelector('#filter-doc-status').addEventListener('change', function(e) {
        filterStatus = e.target.value;
        renderContent();
      });
    } else {
      el.innerHTML =
        '<div class="filter-bar">' +
          '<select class="form-select" id="filter-ev-type">' +
            '<option value="">All Types</option>' +
            EVIDENCE_TYPES.map(function(t) {
              return '<option value="' + t.value + '"' + (filterDocType === t.value ? ' selected' : '') + '>' + t.label + '</option>';
            }).join('') +
          '</select>' +
          '<select class="form-select" id="filter-ev-status">' +
            '<option value="">All Statuses</option>' +
            VERIFICATION_STATUSES.map(function(s) {
              return '<option value="' + s.value + '"' + (filterStatus === s.value ? ' selected' : '') + '>' + s.label + '</option>';
            }).join('') +
          '</select>' +
        '</div>';

      el.querySelector('#filter-ev-type').addEventListener('change', function(e) {
        filterDocType = e.target.value;
        renderContent();
      });
      el.querySelector('#filter-ev-status').addEventListener('change', function(e) {
        filterStatus = e.target.value;
        renderContent();
      });
    }
  }

  /* ─── Content ─── */
  function renderContent() {
    const el = document.getElementById('proof-content');
    if (!el) return;

    if (activeTab === 'documents') {
      renderDocumentsTable(el);
    } else {
      renderEvidenceTable(el);
    }
  }

  /* ─── Documents Table ─── */
  function renderDocumentsTable(el) {
    let filtered = documents;
    if (filterStatus) {
      filtered = filtered.filter(function(d) { return d.status === filterStatus; });
    }

    if (filtered.length === 0) {
      el.innerHTML =
        '<div class="card">' +
          '<div class="empty-state">' +
            '<div class="empty-state-icon">\uD83D\uDCC4</div>' +
            '<h3>No documents yet</h3>' +
            '<p>Track your trust documents here to keep everything organized and know what\'s missing.</p>' +
            '<button class="btn btn-primary" id="empty-doc-btn">+ Add Document</button>' +
          '</div>' +
        '</div>';
      const emptyBtn = document.getElementById('empty-doc-btn');
      if (emptyBtn) emptyBtn.addEventListener('click', showAddDocumentModal);
      return;
    }

    let html = '<div class="table-container"><table>' +
      '<thead><tr>' +
        '<th>Document</th>' +
        '<th>Status</th>' +
        '<th>Linked Evidence</th>' +
        '<th>Last Updated</th>' +
        '<th>Actions</th>' +
      '</tr></thead><tbody>';

    filtered.forEach(function(doc) {
      const statusDef = DOC_STATUSES.find(function(s) { return s.value === doc.status; }) || DOC_STATUSES[1];
      const linkedEvidence = evidenceItems.filter(function(e) { return e.document_id === doc.id; });

      html += '<tr>' +
        '<td>' +
          '<strong class="text-sm">' + App.escapeHtml(doc.label || doc.type || 'Document') + '</strong>' +
          (doc.notes ? '<br><span class="text-xs text-dim">' + App.escapeHtml(doc.notes) + '</span>' : '') +
        '</td>' +
        '<td><span class="badge ' + statusDef.badge + '">' + statusDef.label + '</span></td>' +
        '<td>' +
          (linkedEvidence.length > 0
            ? '<span class="badge badge-info">' + linkedEvidence.length + ' item' + (linkedEvidence.length !== 1 ? 's' : '') + '</span>'
            : '<span class="text-light text-xs">None</span>') +
        '</td>' +
        '<td class="text-dim text-sm">' + App.formatDate(doc.updated_at) + '</td>' +
        '<td class="td-actions">' +
          '<button class="btn btn-ghost btn-sm" data-edit-doc="' + doc.id + '">Edit</button>' +
        '</td>' +
      '</tr>';
    });

    html += '</tbody></table></div>';
    el.innerHTML = html;

    el.querySelectorAll('[data-edit-doc]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const docId = btn.getAttribute('data-edit-doc');
        const doc = documents.find(function(d) { return d.id === docId; });
        if (doc) showEditDocumentModal(doc);
      });
    });
  }

  /* ─── Evidence Table ─── */
  function renderEvidenceTable(el) {
    let filtered = evidenceItems;
    if (filterDocType) {
      filtered = filtered.filter(function(e) { return e.type === filterDocType; });
    }
    if (filterStatus) {
      filtered = filtered.filter(function(e) { return e.verification_status === filterStatus; });
    }

    if (filtered.length === 0) {
      el.innerHTML =
        '<div class="card">' +
          '<div class="empty-state">' +
            '<div class="empty-state-icon">\uD83D\uDD0D</div>' +
            '<h3>No evidence yet</h3>' +
            '<p>Evidence links your assets and documents to proof of ownership, funding, or transfer. Add your first piece of evidence to strengthen your trust health.</p>' +
            '<button class="btn btn-primary" id="empty-ev-btn">+ Add Evidence</button>' +
          '</div>' +
        '</div>';
      const emptyBtn = document.getElementById('empty-ev-btn');
      if (emptyBtn) emptyBtn.addEventListener('click', showAddEvidenceModal);
      return;
    }

    let html = '<div class="table-container"><table>' +
      '<thead><tr>' +
        '<th>Evidence</th>' +
        '<th>Type</th>' +
        '<th>Linked To</th>' +
        '<th>Verification</th>' +
        '<th>Date</th>' +
      '</tr></thead><tbody>';

    filtered.forEach(function(ev) {
      const typeDef = EVIDENCE_TYPES.find(function(t) { return t.value === ev.type; }) || {};
      const verDef = VERIFICATION_STATUSES.find(function(v) { return v.value === ev.verification_status; }) || VERIFICATION_STATUSES[2];
      const linkedAsset = ev.asset_id ? assets.find(function(a) { return a.id === ev.asset_id; }) : null;
      const linkedDoc = ev.document_id ? documents.find(function(d) { return d.id === ev.document_id; }) : null;

      let linkedTo = [];
      if (linkedAsset) linkedTo.push('Asset: ' + linkedAsset.name);
      if (linkedDoc) linkedTo.push('Doc: ' + (linkedDoc.label || linkedDoc.type));

      html += '<tr>' +
        '<td>' +
          '<strong class="text-sm">' + App.escapeHtml(ev.label || ev.description || 'Evidence') + '</strong>' +
          (ev.filename ? '<br><span class="text-xs text-dim">' + App.escapeHtml(ev.filename) + '</span>' : '') +
        '</td>' +
        '<td class="text-sm">' + App.escapeHtml(typeDef.label || ev.type || '') + '</td>' +
        '<td class="text-sm">' +
          (linkedTo.length > 0 ? linkedTo.map(function(l) { return App.escapeHtml(l); }).join('<br>') : '<span class="text-light">Unlinked</span>') +
        '</td>' +
        '<td><span class="badge ' + verDef.badge + '">' + verDef.label + '</span></td>' +
        '<td class="text-dim text-sm">' + App.formatDate(ev.created_at) + '</td>' +
      '</tr>';
    });

    html += '</tbody></table></div>';
    el.innerHTML = html;
  }

  /* ─── Add Document Modal ─── */
  function showAddDocumentModal() {
    const body =
      '<div class="form-group">' +
        '<label class="form-label">Document Name</label>' +
        '<input type="text" class="form-input" id="m-doc-label" placeholder="e.g., Trust Agreement (Original)">' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label class="form-label">Document Type</label>' +
          '<input type="text" class="form-input" id="m-doc-type" placeholder="e.g., trust_agreement">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Status</label>' +
          '<select class="form-select" id="m-doc-status">' +
            DOC_STATUSES.map(function(s) {
              return '<option value="' + s.value + '">' + s.label + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Notes <span class="form-label-hint">(optional)</span></label>' +
        '<textarea class="form-textarea" id="m-doc-notes" placeholder="Any details about this document..."></textarea>' +
      '</div>';

    const modal = App.showModal({
      title: 'Add Document',
      body: body,
      footer:
        '<button class="btn btn-secondary" id="m-cancel">Cancel</button>' +
        '<button class="btn btn-primary" id="m-save">Add Document</button>'
    });

    modal.querySelector('#m-cancel').addEventListener('click', function() {
      App.closeModal(modal);
    });

    modal.querySelector('#m-save').addEventListener('click', async function() {
      const label = modal.querySelector('#m-doc-label').value.trim();
      const type = modal.querySelector('#m-doc-type').value.trim();
      const status = modal.querySelector('#m-doc-status').value;
      const notes = modal.querySelector('#m-doc-notes').value.trim();

      if (!label) {
        App.toast('Missing Name', 'Please enter a name for this document.', 'warning');
        return;
      }

      const btn = modal.querySelector('#m-save');
      btn.classList.add('btn-loading');
      btn.disabled = true;

      try {
        await API.createDocument(App.state.trustId, {
          label: label,
          type: type || label.toLowerCase().replace(/\s+/g, '_'),
          status: status,
          notes: notes
        });
        App.toast('Document Added', label + ' has been added to your proof pack.', 'success');
        App.closeModal(modal);
        await loadData();
      } catch (err) {
        App.toast('Error', err.message, 'error');
        btn.classList.remove('btn-loading');
        btn.disabled = false;
      }
    });
  }

  /* ─── Edit Document Modal ─── */
  function showEditDocumentModal(doc) {
    const body =
      '<div class="form-group">' +
        '<label class="form-label">Document Name</label>' +
        '<input type="text" class="form-input" id="m-doc-label" value="' + App.escapeHtml(doc.label || '') + '">' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Status</label>' +
        '<select class="form-select" id="m-doc-status">' +
          DOC_STATUSES.map(function(s) {
            return '<option value="' + s.value + '"' + (doc.status === s.value ? ' selected' : '') + '>' + s.label + '</option>';
          }).join('') +
        '</select>' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Notes</label>' +
        '<textarea class="form-textarea" id="m-doc-notes">' + App.escapeHtml(doc.notes || '') + '</textarea>' +
      '</div>';

    const modal = App.showModal({
      title: 'Edit Document',
      body: body,
      footer:
        '<button class="btn btn-secondary" id="m-cancel">Cancel</button>' +
        '<button class="btn btn-primary" id="m-save">Save Changes</button>'
    });

    modal.querySelector('#m-cancel').addEventListener('click', function() {
      App.closeModal(modal);
    });

    modal.querySelector('#m-save').addEventListener('click', async function() {
      const label = modal.querySelector('#m-doc-label').value.trim();
      const status = modal.querySelector('#m-doc-status').value;
      const notes = modal.querySelector('#m-doc-notes').value.trim();

      if (!label) {
        App.toast('Missing Name', 'Please enter a name.', 'warning');
        return;
      }

      const btn = modal.querySelector('#m-save');
      btn.classList.add('btn-loading');
      btn.disabled = true;

      try {
        await API.updateDocument(App.state.trustId, doc.id, {
          label: label,
          status: status,
          notes: notes
        });
        App.toast('Document Updated', label + ' has been updated.', 'success');
        App.closeModal(modal);
        await loadData();
      } catch (err) {
        App.toast('Error', err.message, 'error');
        btn.classList.remove('btn-loading');
        btn.disabled = false;
      }
    });
  }

  /* ─── Add Evidence Modal ─── */
  function showAddEvidenceModal() {
    const body =
      '<div class="form-group">' +
        '<label class="form-label">Description</label>' +
        '<input type="text" class="form-input" id="m-ev-label" placeholder="e.g., Grant Deed for 123 Main St">' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label class="form-label">Evidence Type</label>' +
          '<select class="form-select" id="m-ev-type">' +
            EVIDENCE_TYPES.map(function(t) {
              return '<option value="' + t.value + '">' + t.label + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Filename <span class="form-label-hint">(optional)</span></label>' +
          '<input type="text" class="form-input" id="m-ev-filename" placeholder="e.g., deed-123-main.pdf">' +
        '</div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label class="form-label">Link to Asset <span class="form-label-hint">(optional)</span></label>' +
          '<select class="form-select" id="m-ev-asset">' +
            '<option value="">-- No Asset --</option>' +
            assets.map(function(a) {
              return '<option value="' + a.id + '">' + App.escapeHtml(a.name) + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Link to Document <span class="form-label-hint">(optional)</span></label>' +
          '<select class="form-select" id="m-ev-doc">' +
            '<option value="">-- No Document --</option>' +
            documents.map(function(d) {
              return '<option value="' + d.id + '">' + App.escapeHtml(d.label || d.type) + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
      '</div>' +
      '<div class="form-group">' +
        '<p class="text-xs text-dim" style="padding: 0.75rem; background: var(--surface-alt); border-radius: var(--radius-xs);">' +
          'File upload coming soon. For now, record the metadata about your evidence here and we\'ll track it for you.' +
        '</p>' +
      '</div>';

    const modal = App.showModal({
      title: 'Add Evidence',
      body: body,
      large: true,
      footer:
        '<button class="btn btn-secondary" id="m-cancel">Cancel</button>' +
        '<button class="btn btn-primary" id="m-save">Add Evidence</button>'
    });

    modal.querySelector('#m-cancel').addEventListener('click', function() {
      App.closeModal(modal);
    });

    modal.querySelector('#m-save').addEventListener('click', async function() {
      const label = modal.querySelector('#m-ev-label').value.trim();
      const type = modal.querySelector('#m-ev-type').value;
      const filename = modal.querySelector('#m-ev-filename').value.trim();
      const assetId = modal.querySelector('#m-ev-asset').value;
      const docId = modal.querySelector('#m-ev-doc').value;

      if (!label) {
        App.toast('Missing Description', 'Please describe this evidence.', 'warning');
        return;
      }

      const btn = modal.querySelector('#m-save');
      btn.classList.add('btn-loading');
      btn.disabled = true;

      try {
        await API.createEvidence(App.state.trustId, {
          label: label,
          description: label,
          type: type,
          filename: filename || undefined,
          asset_id: assetId || undefined,
          document_id: docId || undefined,
          verification_status: 'unverified'
        });
        App.toast('Evidence Added', 'Your evidence has been recorded.', 'success');
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
  App.registerPage('/proof-pack', render);

})();
