/* ═══════════════════════════════════════════════════════════════
   AliveTrust — Trust Health Dashboard
   Six score cards, red flags, change tracking, recompute
   ═══════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  let computeData = null;
  let previousData = null;

  /* ─── Score Definitions ─── */
  const SCORE_DEFS = [
    {
      key: 'funding_coverage_value',
      label: 'Funding Coverage (Value)',
      unit: '%',
      formula: 'Sum of funded asset values / Total asset value',
      explanation: 'Shows what percentage of your estate\'s total dollar value is protected inside the trust. Higher is better.'
    },
    {
      key: 'funding_coverage_count',
      label: 'Funding Coverage (Count)',
      unit: '%',
      formula: 'Number of funded assets / Total number of assets',
      explanation: 'Shows what fraction of your individual assets have been titled into the trust, regardless of value.'
    },
    {
      key: 'probate_exposure',
      label: 'Probate Exposure',
      unit: '$',
      formula: 'Sum of unfunded + partially funded asset values',
      explanation: 'The dollar amount of assets that could go through probate if something happened today. Lower is better.',
      invertColor: true
    },
    {
      key: 'document_completeness',
      label: 'Document Completeness',
      unit: '%',
      formula: 'Essential documents on file / Total essential documents required',
      explanation: 'Tracks whether you have all the key legal documents your trust needs to function properly.'
    },
    {
      key: 'incapacity_readiness',
      label: 'Incapacity Readiness',
      unit: '%',
      formula: 'Incapacity documents on file / Required incapacity documents',
      explanation: 'Measures how prepared your trust is to handle a situation where you become unable to manage your own affairs.'
    },
    {
      key: 'evidence_completeness',
      label: 'Evidence Completeness',
      unit: '%',
      formula: 'Assets with linked evidence / Total assets',
      explanation: 'Shows how many of your assets have supporting documentation (title transfers, account statements, etc.).'
    }
  ];

  /* ─── Main Render ─── */
  async function render(container) {
    container.innerHTML =
      '<div class="page-container">' +
        '<div class="page-header">' +
          '<div class="flex items-center justify-between">' +
            '<div>' +
              '<h1 class="page-title">Trust Health Dashboard</h1>' +
              '<p class="page-subtitle" id="last-computed">Analyzing your trust...</p>' +
            '</div>' +
            '<button class="btn btn-primary" id="recompute-btn">Recompute</button>' +
          '</div>' +
        '</div>' +
        '<div id="score-grid" class="score-grid"></div>' +
        '<div id="red-flags-section" class="mb-3"></div>' +
        '<div id="changes-section" class="mb-3"></div>' +
        '<div class="disclaimer">' +
          '<strong>Important:</strong> AliveTrust provides educational tools for estate planning awareness. ' +
          'Health scores are based on the information you provide and may not reflect the complete legal status of your trust. ' +
          'This is not legal advice. Always consult a qualified estate planning attorney for your specific situation.' +
        '</div>' +
      '</div>';

    document.getElementById('recompute-btn').addEventListener('click', handleRecompute);

    await loadDashboard();
  }

  /* ─── Load Dashboard Data ─── */
  async function loadDashboard() {
    const trustId = App.state.trustId;
    if (!trustId) {
      App.navigate('/onboarding');
      return;
    }

    const scoreGrid = document.getElementById('score-grid');
    if (scoreGrid) {
      scoreGrid.innerHTML =
        '<div class="score-card"><div class="loading-skeleton skeleton-text" style="height: 80px;"></div></div>' +
        '<div class="score-card"><div class="loading-skeleton skeleton-text" style="height: 80px;"></div></div>' +
        '<div class="score-card"><div class="loading-skeleton skeleton-text" style="height: 80px;"></div></div>' +
        '<div class="score-card"><div class="loading-skeleton skeleton-text" style="height: 80px;"></div></div>' +
        '<div class="score-card"><div class="loading-skeleton skeleton-text" style="height: 80px;"></div></div>' +
        '<div class="score-card"><div class="loading-skeleton skeleton-text" style="height: 80px;"></div></div>';
    }

    try {
      // Store previous results for comparison
      previousData = App.state.previousCompute || null;

      const result = await API.compute(trustId);
      computeData = result;

      // Save for next comparison
      App.state.previousCompute = App.state.computeResults;
      App.state.computeResults = result;

      renderScoreCards();
      renderRedFlags();
      renderChanges();
      updateLastComputed();
    } catch (err) {
      if (scoreGrid) {
        scoreGrid.innerHTML = App.renderError(err.message);
      }
    }
  }

  /* ─── Recompute ─── */
  async function handleRecompute() {
    const btn = document.getElementById('recompute-btn');
    btn.classList.add('btn-loading');
    btn.disabled = true;

    try {
      previousData = computeData;
      App.state.previousCompute = computeData;

      const result = await API.compute(App.state.trustId);
      computeData = result;
      App.state.computeResults = result;

      renderScoreCards();
      renderRedFlags();
      renderChanges();
      updateLastComputed();
      App.toast('Scores Updated', 'Your trust health scores have been recalculated.', 'success');
    } catch (err) {
      App.toast('Error', 'Failed to recompute scores: ' + err.message, 'error');
    } finally {
      btn.classList.remove('btn-loading');
      btn.disabled = false;
    }
  }

  /* ─── Score Cards ─── */
  function renderScoreCards() {
    const el = document.getElementById('score-grid');
    if (!el || !computeData) return;

    const scores = computeData.scores || {};
    let html = '';

    SCORE_DEFS.forEach(function(def) {
      const value = scores[def.key];
      const displayValue = formatScoreValue(value, def);
      const colorClass = getScoreColorClass(value, def);

      // Contributing items and data gaps
      const details = computeData.details ? computeData.details[def.key] : null;
      const contributors = details ? details.contributors || [] : [];
      const gaps = details ? details.gaps || [] : [];

      html += '<div class="score-card ' + colorClass + '" data-score-key="' + def.key + '">' +
        '<div class="score-card-indicator"></div>' +
        '<div class="score-card-label">' + def.label + '</div>' +
        '<div class="score-card-value">' + displayValue + '</div>' +
        '<div class="score-card-detail">' + getScoreDetail(def, scores) + '</div>' +
        '<div class="score-card-expanded">' +
          '<p><strong>How this is calculated:</strong></p>' +
          '<p class="text-xs" style="font-family: monospace; margin-bottom: 0.75rem;">' + def.formula + '</p>' +
          '<p>' + def.explanation + '</p>' +
          (contributors.length > 0
            ? '<p class="mt-1"><strong>Contributing items:</strong></p><ul style="padding-left: 1.25rem; margin-top: 0.25rem;">' +
              contributors.map(function(c) { return '<li class="text-xs">' + App.escapeHtml(c) + '</li>'; }).join('') +
              '</ul>'
            : '') +
          (gaps.length > 0
            ? '<p class="mt-1" style="color: var(--warning);"><strong>Data gaps:</strong></p><ul style="padding-left: 1.25rem; margin-top: 0.25rem;">' +
              gaps.map(function(g) { return '<li class="text-xs">' + App.escapeHtml(g) + '</li>'; }).join('') +
              '</ul>'
            : '') +
        '</div>' +
      '</div>';
    });

    el.innerHTML = html;

    // Click to expand
    el.querySelectorAll('.score-card').forEach(function(card) {
      card.addEventListener('click', function() {
        card.classList.toggle('expanded');
      });
    });
  }

  function formatScoreValue(value, def) {
    if (value === null || value === undefined) return 'N/A';
    if (def.unit === '$') return App.formatCurrency(value);
    if (def.unit === '%') return Math.round(value) + '%';
    return value;
  }

  function getScoreColorClass(value, def) {
    if (value === null || value === undefined) return '';
    if (def.unit === '$') {
      // For dollar amounts (like probate exposure), lower is better
      if (def.invertColor) {
        if (value <= 0) return 'score-green';
        if (value < 100000) return 'score-amber';
        return 'score-red';
      }
    }
    return App.scoreColorClass(value);
  }

  function getScoreDetail(def, scores) {
    const s = scores || {};
    switch (def.key) {
      case 'funding_coverage_value':
        return App.formatCurrency(s.funded_value || 0) + ' of ' + App.formatCurrency(s.total_value || 0);
      case 'funding_coverage_count':
        return (s.funded_count || 0) + ' of ' + (s.total_count || 0) + ' assets';
      case 'probate_exposure':
        return (s.unfunded_count || 0) + ' unfunded asset' + ((s.unfunded_count || 0) !== 1 ? 's' : '');
      case 'document_completeness':
        return (s.docs_complete || 0) + ' of ' + (s.docs_required || 0) + ' documents';
      case 'incapacity_readiness':
        return (s.incapacity_docs || 0) + ' of ' + (s.incapacity_required || 0) + ' documents';
      case 'evidence_completeness':
        return (s.assets_with_evidence || 0) + ' of ' + (s.total_count || 0) + ' have evidence';
      default:
        return '';
    }
  }

  function updateLastComputed() {
    const el = document.getElementById('last-computed');
    if (el && computeData) {
      const ts = computeData.computed_at || new Date().toISOString();
      el.textContent = 'Last computed: ' + App.formatDateTime(ts);
    }
  }

  /* ─── Red Flags ─── */
  function renderRedFlags() {
    const el = document.getElementById('red-flags-section');
    if (!el || !computeData) return;

    const flags = computeData.red_flags || [];

    if (flags.length === 0) {
      el.innerHTML =
        '<div class="card">' +
          '<div class="card-header"><h3>Red Flags</h3></div>' +
          '<div class="card-body text-center" style="padding: 2rem;">' +
            '<span style="font-size: 2rem; opacity: 0.3;">\u2713</span>' +
            '<p class="text-dim mt-1">No critical issues found. Nice work keeping your trust healthy.</p>' +
          '</div>' +
        '</div>';
      return;
    }

    let html = '<div class="card">' +
      '<div class="card-header">' +
        '<h3>Red Flags</h3>' +
        '<span class="badge badge-unfunded">' + flags.length + ' issue' + (flags.length !== 1 ? 's' : '') + '</span>' +
      '</div>' +
      '<div class="card-body" style="padding: 0;">';

    flags.forEach(function(flag) {
      html += '<div class="red-flag-item">' +
        '<span class="red-flag-icon">\u26A0</span>' +
        '<div class="red-flag-text">' +
          '<strong>' + App.escapeHtml(flag.title || 'Issue') + '</strong>' +
          '<span>' + App.escapeHtml(flag.description || '') + '</span>' +
        '</div>' +
      '</div>';
    });

    html += '</div></div>';
    el.innerHTML = html;
  }

  /* ─── Changes Section ─── */
  function renderChanges() {
    const el = document.getElementById('changes-section');
    if (!el) return;

    if (!previousData || !computeData) {
      el.innerHTML =
        '<div class="card">' +
          '<div class="card-header"><h3>What Changed</h3></div>' +
          '<div class="card-body">' +
            '<p class="text-dim text-sm">This is your first health check. Come back after making changes to see how your scores evolve.</p>' +
          '</div>' +
        '</div>';
      return;
    }

    const prevScores = previousData.scores || {};
    const currScores = computeData.scores || {};
    let changes = [];

    SCORE_DEFS.forEach(function(def) {
      const prev = prevScores[def.key];
      const curr = currScores[def.key];
      if (prev !== undefined && curr !== undefined && prev !== curr) {
        const diff = curr - prev;
        const improved = def.invertColor ? diff < 0 : diff > 0;
        changes.push({
          label: def.label,
          prev: formatScoreValue(prev, def),
          curr: formatScoreValue(curr, def),
          direction: improved ? 'up' : (diff === 0 ? 'same' : 'down'),
          arrow: improved ? '\u2191' : (diff === 0 ? '\u2192' : '\u2193')
        });
      }
    });

    if (changes.length === 0) {
      el.innerHTML =
        '<div class="card">' +
          '<div class="card-header"><h3>What Changed</h3></div>' +
          '<div class="card-body">' +
            '<p class="text-dim text-sm">No changes since your last computation.</p>' +
          '</div>' +
        '</div>';
      return;
    }

    let html = '<div class="card">' +
      '<div class="card-header"><h3>What Changed Since Last Time</h3></div>' +
      '<div class="card-body" style="padding: 0.75rem 1.5rem;">';

    changes.forEach(function(c) {
      html += '<div class="changes-item">' +
        '<span class="changes-arrow ' + c.direction + '">' + c.arrow + '</span>' +
        '<span class="flex-1">' + c.label + '</span>' +
        '<span class="text-dim text-sm">' + c.prev + '</span>' +
        '<span class="text-sm">&rarr;</span>' +
        '<span class="font-bold text-sm">' + c.curr + '</span>' +
      '</div>';
    });

    html += '</div></div>';
    el.innerHTML = html;
  }

  /* ─── Register Route ─── */
  App.registerPage('/dashboard', render);

})();
