/* ═══════════════════════════════════════════════════════════════
   AliveTrust — My Next 3 Moves (Next Best Actions)
   Priority action cards with steps, evidence, owners, escalation
   ═══════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  let allActions = [];
  let actionStates = {}; // local tracking: { actionId: 'started' | 'done' }

  // Load saved action states from localStorage
  const savedStates = localStorage.getItem('alivetrust_action_states');
  if (savedStates) {
    try { actionStates = JSON.parse(savedStates); } catch (e) { /* ignore */ }
  }

  function saveActionStates() {
    localStorage.setItem('alivetrust_action_states', JSON.stringify(actionStates));
  }

  /* ─── Main Render ─── */
  async function render(container) {
    container.innerHTML =
      '<div class="page-container">' +
        '<div class="page-header">' +
          '<h1 class="page-title">My Next 3 Moves</h1>' +
          '<p class="page-subtitle">Focus on what matters most. These are your highest-impact actions right now.</p>' +
        '</div>' +
        '<div id="nba-top3"></div>' +
        '<div id="nba-backlog" class="mt-3"></div>' +
      '</div>';

    await loadActions();
  }

  /* ─── Load Actions ─── */
  async function loadActions() {
    const trustId = App.state.trustId;
    if (!trustId) {
      App.navigate('/onboarding');
      return;
    }

    const topEl = document.getElementById('nba-top3');
    if (topEl) topEl.innerHTML = App.renderLoading();

    try {
      const data = await API.getNBA(trustId);
      allActions = data.actions || data || [];
      App.state.nbaActions = allActions;
      renderTop3();
      renderBacklog();
    } catch (err) {
      if (topEl) topEl.innerHTML = App.renderError(err.message);
    }
  }

  /* ─── Top 3 Cards ─── */
  function renderTop3() {
    const el = document.getElementById('nba-top3');
    if (!el) return;

    // Filter out done actions for top 3
    const active = allActions.filter(function(a) { return actionStates[a.id] !== 'done'; });
    const top3 = active.slice(0, 3);

    if (top3.length === 0) {
      el.innerHTML =
        '<div class="card">' +
          '<div class="empty-state">' +
            '<div class="empty-state-icon">\u2713</div>' +
            '<h3>All caught up</h3>' +
            '<p>You\'ve addressed all your current action items. Great work protecting your family\'s future.</p>' +
          '</div>' +
        '</div>';
      return;
    }

    let html = '<div class="grid-cards">';

    top3.forEach(function(action, index) {
      const state = actionStates[action.id] || 'pending';
      const priorityBadge = getPriorityBadge(action.priority || action.priority_score);
      const categoryBadge = action.category
        ? '<span class="badge badge-category">' + App.escapeHtml(action.category) + '</span>'
        : '';

      html += '<div class="action-card" data-action-id="' + (action.id || index) + '">' +
        '<div class="action-card-rank">' + (index + 1) + '</div>' +
        '<div class="action-card-title">' + App.escapeHtml(action.name || action.title || 'Action') + '</div>' +
        '<div class="action-card-meta">' +
          priorityBadge +
          categoryBadge +
          (state === 'started' ? '<span class="badge badge-partial">In Progress</span>' : '') +
        '</div>';

      // Steps
      if (action.steps && action.steps.length > 0) {
        html += '<ul class="action-card-steps">';
        action.steps.forEach(function(step) {
          html += '<li>' + App.escapeHtml(step) + '</li>';
        });
        html += '</ul>';
      }

      // Evidence required
      if (action.evidence_required) {
        html += '<div class="text-xs text-dim mb-1" style="padding: 0.5rem 0.75rem; background: var(--accent-soft); border-radius: var(--radius-xs);">' +
          '<strong>Evidence needed:</strong> ' + App.escapeHtml(action.evidence_required) +
        '</div>';
      }

      // What "done" looks like
      if (action.done_description || action.what_done_looks_like) {
        html += '<div class="action-card-done-desc">' +
          '<strong>Done looks like:</strong> ' + App.escapeHtml(action.done_description || action.what_done_looks_like) +
        '</div>';
      }

      // Escalation note
      if (action.escalation) {
        html += '<div class="action-card-escalation">' +
          '<strong>Note:</strong> ' + App.escapeHtml(action.escalation) +
        '</div>';
      }

      // Footer with owner + action buttons
      html += '<div class="action-card-footer">' +
        '<div class="action-card-owner">' +
          (action.owner ? 'Suggested: <strong>' + App.escapeHtml(action.owner) + '</strong>' : '') +
        '</div>' +
        '<div class="flex gap-1">';

      if (state === 'pending') {
        html += '<button class="btn btn-secondary btn-sm" data-start="' + (action.id || index) + '">Start</button>';
      }
      if (state !== 'done') {
        html += '<button class="btn btn-success btn-sm" data-complete="' + (action.id || index) + '">Mark Done</button>';
      }

      html += '</div></div></div>';
    });

    html += '</div>';
    el.innerHTML = html;

    // Event listeners
    el.querySelectorAll('[data-start]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const id = btn.getAttribute('data-start');
        actionStates[id] = 'started';
        saveActionStates();
        renderTop3();
        renderBacklog();
        App.toast('Action Started', 'Good luck! You can mark it done when complete.', 'info');
      });
    });

    el.querySelectorAll('[data-complete]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const id = btn.getAttribute('data-complete');
        actionStates[id] = 'done';
        saveActionStates();
        renderTop3();
        renderBacklog();
        App.toast('Action Complete', 'Well done! One step closer to a healthy trust.', 'success');
      });
    });
  }

  /* ─── Full Backlog ─── */
  function renderBacklog() {
    const el = document.getElementById('nba-backlog');
    if (!el) return;

    // All actions beyond top 3 (or done ones)
    const active = allActions.filter(function(a) { return actionStates[a.id] !== 'done'; });
    const remaining = active.slice(3);
    const completed = allActions.filter(function(a) { return actionStates[a.id] === 'done'; });

    if (remaining.length === 0 && completed.length === 0) {
      el.innerHTML = '';
      return;
    }

    let html = '<div class="card">' +
      '<div class="card-header">' +
        '<h3>Full Backlog</h3>' +
        '<button class="btn btn-ghost btn-sm" id="toggle-backlog">Show</button>' +
      '</div>' +
      '<div class="card-body hidden" id="backlog-body">';

    if (remaining.length > 0) {
      html += '<h4 class="mb-1">Upcoming (' + remaining.length + ')</h4>';
      html += '<div class="table-container mb-2"><table>' +
        '<thead><tr><th>#</th><th>Action</th><th>Priority</th><th>Category</th><th></th></tr></thead><tbody>';

      remaining.forEach(function(action, i) {
        html += '<tr>' +
          '<td class="text-dim">' + (i + 4) + '</td>' +
          '<td><strong class="text-sm">' + App.escapeHtml(action.name || action.title || 'Action') + '</strong></td>' +
          '<td>' + getPriorityBadge(action.priority || action.priority_score) + '</td>' +
          '<td class="text-dim text-sm">' + App.escapeHtml(action.category || '') + '</td>' +
          '<td><button class="btn btn-ghost btn-sm" data-start-bl="' + (action.id || '') + '">Start</button></td>' +
        '</tr>';
      });
      html += '</tbody></table></div>';
    }

    if (completed.length > 0) {
      html += '<h4 class="mb-1 mt-2 text-dim">Completed (' + completed.length + ')</h4>';
      completed.forEach(function(action) {
        html += '<div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.375rem 0; opacity: 0.6;">' +
          '<span style="color: var(--success);">\u2713</span>' +
          '<span class="text-sm" style="text-decoration: line-through;">' + App.escapeHtml(action.name || action.title || '') + '</span>' +
        '</div>';
      });
    }

    html += '</div></div>';
    el.innerHTML = html;

    // Toggle
    const toggleBtn = document.getElementById('toggle-backlog');
    const backlogBody = document.getElementById('backlog-body');
    if (toggleBtn && backlogBody) {
      toggleBtn.addEventListener('click', function() {
        backlogBody.classList.toggle('hidden');
        toggleBtn.textContent = backlogBody.classList.contains('hidden') ? 'Show' : 'Hide';
      });
    }

    // Backlog start buttons
    el.querySelectorAll('[data-start-bl]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const id = btn.getAttribute('data-start-bl');
        actionStates[id] = 'started';
        saveActionStates();
        renderTop3();
        renderBacklog();
      });
    });
  }

  /* ─── Priority Badge ─── */
  function getPriorityBadge(priority) {
    if (!priority && priority !== 0) return '';
    const numPriority = typeof priority === 'string' ? priority : Number(priority);

    if (typeof numPriority === 'string') {
      const map = {
        high: '<span class="badge badge-priority-high">High</span>',
        medium: '<span class="badge badge-priority-medium">Medium</span>',
        low: '<span class="badge badge-priority-low">Low</span>'
      };
      return map[numPriority.toLowerCase()] || '<span class="badge badge-category">' + App.escapeHtml(String(priority)) + '</span>';
    }

    if (numPriority >= 80) return '<span class="badge badge-priority-high">High Priority</span>';
    if (numPriority >= 50) return '<span class="badge badge-priority-medium">Medium</span>';
    return '<span class="badge badge-priority-low">Low</span>';
  }

  /* ─── Register Route ─── */
  App.registerPage('/nba', render);

})();
