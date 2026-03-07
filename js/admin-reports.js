/* ============================================
   Admin Reports Tab — Load, filter, manage reports
   Dependencies: config.js, admin.js (loaded first)
   ============================================ */

(function () {
    'use strict';

    // ---- State ----
    var currentPage = 1;
    var totalPages = 1;
    var debounceTimer = null;

    // ---- Category labels ----
    var CATEGORY_LABELS = {
        'incorrect_visualization': 'Incorrect Visualization',
        'wrong_variable_value': 'Wrong Variable Value',
        'missing_step': 'Missing Step',
        'wrong_line_highlight': 'Wrong Line Highlight',
        'ui_glitch': 'UI Glitch',
        'other': 'Other'
    };

    // ============================================
    // TAB SWITCHING
    // ============================================

    function initTabs() {
        var tabs = document.querySelectorAll('.admin-tab');
        tabs.forEach(function (tab) {
            tab.addEventListener('click', function () {
                var target = tab.getAttribute('data-admin-tab');
                tabs.forEach(function (t) { t.classList.remove('active'); });
                tab.classList.add('active');

                document.querySelectorAll('.admin-tab-pane').forEach(function (pane) {
                    pane.classList.remove('active');
                });

                var targetPane = document.querySelector('.admin-tab-pane[data-pane="' + target + '"]');
                if (targetPane) targetPane.classList.add('active');

                if (target === 'reports') {
                    loadReportStats();
                    loadReports(1);
                }
            });
        });
    }

    // ============================================
    // CUSTOM DROPDOWNS
    // ============================================

    function closeAllDropdowns() {
        document.querySelectorAll('.rf-dropdown.open').forEach(function (d) { d.classList.remove('open'); });
        document.querySelectorAll('.rf-select-btn.open').forEach(function (b) { b.classList.remove('open'); });
    }

    function initCustomDropdowns() {
        document.querySelectorAll('.rf-select-wrap').forEach(function (wrap) {
            var btn = wrap.querySelector('.rf-select-btn');
            var dropdown = wrap.querySelector('.rf-dropdown');
            var hiddenInput = wrap.querySelector('input[type="hidden"]');
            if (!btn || !dropdown) return;

            // Toggle open/close
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var isOpen = dropdown.classList.contains('open');
                closeAllDropdowns();
                if (!isOpen) {
                    dropdown.classList.add('open');
                    btn.classList.add('open');
                }
            });

            // Stop propagation so document handler doesn't immediately close
            dropdown.addEventListener('click', function (e) {
                e.stopPropagation();
                var item = e.target.closest('.rf-dropdown-item');
                if (!item) return;

                var value = item.getAttribute('data-value');
                // Prefer data-label (set on items with count badges) over raw textContent
                var label = item.getAttribute('data-label') || item.textContent.trim();

                // Mark active
                dropdown.querySelectorAll('.rf-dropdown-item').forEach(function (i) { i.classList.remove('active'); });
                item.classList.add('active');

                // Update button label (keep any inline svg children like rf-dot / rf-sort-icon)
                var labelSpan = btn.querySelector('.rf-select-label');
                if (labelSpan) labelSpan.textContent = label;

                // Write value + fire change so existing filter wiring triggers reload
                if (hiddenInput) {
                    hiddenInput.value = value;
                    hiddenInput.dispatchEvent(new Event('change'));
                }

                closeAllDropdowns();
            });
        });

        // Close all when clicking anywhere outside a dropdown
        document.addEventListener('click', function () { closeAllDropdowns(); });

        // Refresh lucide icons for the static dropdown SVGs
        refreshIcons();
    }

    // ============================================
    // LOAD REPORT STATS
    // ============================================

    async function loadReportStats() {
        var token = localStorage.getItem('codelens-token');
        if (!token) return;

        try {
            var res = await fetch(API_URL + '/reports/stats', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            var data = await res.json();
            if (!data.success) return;

            var stats = data.stats;
            setText('rStatOpen', stats.open);
            setText('rStatProgress', stats.inProgress);
            setText('rStatResolved', stats.resolved);
            setText('rStatTotal', stats.total);

            // Badge on tab
            var badge = document.getElementById('reportsTabBadge');
            if (badge) {
                if (stats.open > 0) {
                    badge.textContent = stats.open;
                    badge.style.display = '';
                } else {
                    badge.style.display = 'none';
                }
            }

            // Populate example dropdown with most-reported examples
            var exampleDropdown = document.getElementById('reportExampleDropdown');
            var exampleInput = document.getElementById('reportExampleFilter');
            if (exampleDropdown) {
                var currentVal = exampleInput ? exampleInput.value : 'all';
                var html = '<div class="rf-dropdown-header">Most Reported</div>'
                    + '<div class="rf-dropdown-item' + (currentVal === 'all' ? ' active' : '') + '" data-value="all">All Examples</div>';
                if (stats.byExample && stats.byExample.length) {
                    html += '<div class="rf-dropdown-divider"></div>';
                    stats.byExample.forEach(function (item) {
                        if (!item._id) return;
                        var isActive = currentVal === item._id;
                        html += '<div class="rf-dropdown-item' + (isActive ? ' active' : '') + '" data-value="'
                            + escapeHtml(item._id) + '" data-label="' + escapeHtml(item._id) + '">'
                            + escapeHtml(item._id) + '<span class="rf-dropdown-count">' + item.count + '</span></div>';
                    });
                }
                exampleDropdown.innerHTML = html;

                // Sync button label if a specific example is selected
                if (currentVal !== 'all') {
                    var exWrap = exampleDropdown.closest('.rf-select-wrap');
                    if (exWrap) {
                        var activeItem = exampleDropdown.querySelector('.rf-dropdown-item.active');
                        var exBtn = exWrap.querySelector('.rf-select-label');
                        if (exBtn && activeItem) exBtn.textContent = activeItem.getAttribute('data-label') || activeItem.textContent.trim();
                    }
                }
            }

        } catch (err) {
            console.error('Report stats error:', err);
        }
    }

    // ============================================
    // LOAD REPORTS
    // ============================================

    async function loadReports(page) {
        var token = localStorage.getItem('codelens-token');
        if (!token) return;

        currentPage = page || 1;

        var status = document.getElementById('reportStatusFilter');
        var category = document.getElementById('reportCategoryFilter');
        var language = document.getElementById('reportLanguageFilter');
        var example = document.getElementById('reportExampleFilter');
        var sort = document.getElementById('reportSortFilter');
        var search = document.getElementById('reportSearchInput');

        var params = new URLSearchParams();
        params.set('page', currentPage);
        params.set('limit', 20);
        if (status && status.value !== 'all') params.set('status', status.value);
        if (category && category.value !== 'all') params.set('category', category.value);
        if (language && language.value !== 'all') params.set('language', language.value);
        if (example && example.value !== 'all') params.set('exampleTitle', example.value);
        if (sort) params.set('sort', sort.value || 'newest');
        if (search && search.value.trim()) params.set('search', search.value.trim());

        var listEl = document.getElementById('reportsList');
        if (listEl) listEl.innerHTML = '<div class="reports-loading">Loading reports...</div>';

        try {
            var res = await fetch(API_URL + '/reports?' + params.toString(), {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            var data = await res.json();

            if (!data.success) {
                if (listEl) listEl.innerHTML = '<div class="reports-empty"><svg data-lucide="alert-triangle"></svg><h3>Error loading reports</h3></div>';
                refreshIcons();
                return;
            }

            totalPages = data.totalPages || 1;
            var countEl = document.getElementById('reportsCount');
            if (countEl) countEl.textContent = data.count + ' report' + (data.count !== 1 ? 's' : '');

            renderReports(data.reports);
            renderPagination();
        } catch (err) {
            console.error('Load reports error:', err);
            if (listEl) listEl.innerHTML = '<div class="reports-empty"><svg data-lucide="wifi-off"></svg><h3>Network error</h3><p>Check server connection</p></div>';
            refreshIcons();
        }
    }

    // ============================================
    // RENDER REPORTS
    // ============================================

    function renderReports(reports) {
        var listEl = document.getElementById('reportsList');
        if (!listEl) return;

        if (!reports || !reports.length) {
            listEl.innerHTML = '<div class="reports-empty">'
                + '<svg data-lucide="flag-off"></svg>'
                + '<h3>No reports found</h3>'
                + '<p>No reports match the current filters</p>'
                + '</div>';
            refreshIcons();
            return;
        }

        var html = '';
        reports.forEach(function (r) {
            var statusCls = 'report-status-badge--' + r.status;
            var statusLabel = r.status.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
            var catLabel = CATEGORY_LABELS[r.category] || r.category;
            var dateStr = formatDate(r.createdAt);
            var userName = r.user ? r.user.name : 'Guest';

            html += '<div class="report-card" data-report-id="' + escapeHtml(r.id) + '">';
            html += '  <div class="report-card-left">';
            html += '    <div class="report-card-top">';
            html += '      <span class="report-status-badge ' + statusCls + '">' + statusLabel + '</span>';
            html += '      <span class="report-category-badge">' + escapeHtml(catLabel) + '</span>';
            html += '    </div>';
            html += '    <div class="report-card-title">' + escapeHtml(r.exampleTitle || 'Untitled Example') + '</div>';
            html += '    <div class="report-card-desc">' + escapeHtml(r.description) + '</div>';
            html += '    <div class="report-card-meta">';
            html += '      <span class="report-meta-item"><svg data-lucide="code-2"></svg>' + escapeHtml(r.language || '—') + '</span>';
            html += '      <span class="report-meta-dot">&middot;</span>';
            html += '      <span class="report-meta-item"><svg data-lucide="footprints"></svg>Step ' + escapeHtml(r.step || '—') + '</span>';
            html += '      <span class="report-meta-dot">&middot;</span>';
            html += '      <span class="report-meta-item"><svg data-lucide="text-cursor-input"></svg>Line ' + escapeHtml(r.line || '—') + '</span>';
            html += '      <span class="report-meta-dot">&middot;</span>';
            html += '      <span class="report-meta-item"><svg data-lucide="layers"></svg>' + escapeHtml(r.visType || '—') + '</span>';
            if (r.dataSegment && r.dataSegment !== 'None') {
                html += '      <span class="report-meta-dot">&middot;</span>';
                html += '      <span class="report-meta-item"><svg data-lucide="database"></svg>DS: ' + escapeHtml(r.dataSegment) + '</span>';
            }
            html += '    </div>';
            html += '  </div>';
            html += '  <div class="report-card-right">';
            html += '    <span class="report-card-date">' + dateStr + '</span>';
            html += '    <span class="report-card-user"><svg data-lucide="user"></svg>' + escapeHtml(userName) + '</span>';
            html += '    <div class="report-card-actions">';
            if (r.status !== 'resolved') {
                html += '      <button class="report-action-btn report-action-btn--resolve" data-action="resolved" data-id="' + escapeHtml(r.id) + '" title="Mark Resolved"><svg data-lucide="check"></svg></button>';
            }
            if (r.status === 'open') {
                html += '      <button class="report-action-btn" data-action="in_progress" data-id="' + escapeHtml(r.id) + '" title="Mark In Progress"><svg data-lucide="loader"></svg></button>';
            }
            if (r.status !== 'dismissed') {
                html += '      <button class="report-action-btn report-action-btn--dismiss" data-action="dismissed" data-id="' + escapeHtml(r.id) + '" title="Dismiss"><svg data-lucide="x"></svg></button>';
            }
            html += '      <button class="report-action-btn report-action-btn--delete" data-delete="' + escapeHtml(r.id) + '" title="Delete"><svg data-lucide="trash-2"></svg></button>';
            html += '    </div>';
            html += '  </div>';
            html += '</div>';
        });

        listEl.innerHTML = html;
        refreshIcons();
    }

    // ============================================
    // PAGINATION
    // ============================================

    function renderPagination() {
        var container = document.getElementById('reportsPagination');
        if (!container || totalPages <= 1) {
            if (container) container.innerHTML = '';
            return;
        }

        var html = '';
        html += '<button class="reports-page-btn" data-page="' + (currentPage - 1) + '"' + (currentPage <= 1 ? ' disabled' : '') + '>&laquo; Prev</button>';

        for (var i = 1; i <= totalPages; i++) {
            if (totalPages > 7) {
                // Show first, last, and surrounding pages
                if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                    html += '<button class="reports-page-btn' + (i === currentPage ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
                } else if (i === currentPage - 2 || i === currentPage + 2) {
                    html += '<span style="color:var(--text-muted);padding:0 4px;">&hellip;</span>';
                }
            } else {
                html += '<button class="reports-page-btn' + (i === currentPage ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
            }
        }

        html += '<button class="reports-page-btn" data-page="' + (currentPage + 1) + '"' + (currentPage >= totalPages ? ' disabled' : '') + '>Next &raquo;</button>';
        container.innerHTML = html;

        container.querySelectorAll('.reports-page-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var pg = parseInt(btn.getAttribute('data-page'), 10);
                if (pg >= 1 && pg <= totalPages) {
                    loadReports(pg);
                }
            });
        });
    }

    // ============================================
    // UPDATE STATUS
    // ============================================

    async function updateReportStatus(id, status) {
        var token = localStorage.getItem('codelens-token');
        if (!token) return;

        try {
            var res = await fetch(API_URL + '/reports/' + id, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({ status: status })
            });
            var data = await res.json();
            if (data.success) {
                loadReportStats();
                loadReports(currentPage);
            }
        } catch (err) {
            console.error('Update report error:', err);
        }
    }

    // ============================================
    // DELETE REPORT
    // ============================================

    async function deleteReport(id) {
        if (!confirm('Delete this report permanently?')) return;

        var token = localStorage.getItem('codelens-token');
        if (!token) return;

        try {
            var res = await fetch(API_URL + '/reports/' + id, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + token }
            });
            var data = await res.json();
            if (data.success) {
                loadReportStats();
                loadReports(currentPage);
            }
        } catch (err) {
            console.error('Delete report error:', err);
        }
    }

    // ============================================
    // HELPERS
    // ============================================

    function setText(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function refreshIcons() {
        if (window.lucide) lucide.createIcons();
    }

    // ============================================
    // INIT
    // ============================================

    function init() {
        initTabs();

        // Init custom filter dropdowns
        initCustomDropdowns();

        // Filters
        var filterIds = ['reportStatusFilter', 'reportCategoryFilter', 'reportLanguageFilter', 'reportExampleFilter', 'reportSortFilter'];
        filterIds.forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('change', function () { loadReports(1); });
        });
        var searchInput = document.getElementById('reportSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(function () { loadReports(1); }, 400);
            });
        }

        // Refresh button — reports
        var reportsRefreshBtn = document.getElementById('reportsRefreshBtn');
        if (reportsRefreshBtn) {
            reportsRefreshBtn.addEventListener('click', function () {
                reportsRefreshBtn.classList.add('spinning');
                Promise.all([loadReportStats(), loadReports(currentPage)]).finally(function () {
                    reportsRefreshBtn.classList.remove('spinning');
                });
            });
        }

        // Delegated click handler for report action buttons.
        // Using delegation + closest() so clicks on SVG children inside buttons
        // are correctly routed regardless of how Lucide replaces icon elements.
        var listEl = document.getElementById('reportsList');
        if (listEl) {
            listEl.addEventListener('click', function (e) {
                var actionBtn = e.target.closest('[data-action]');
                if (actionBtn) {
                    updateReportStatus(actionBtn.getAttribute('data-id'), actionBtn.getAttribute('data-action'));
                    return;
                }
                var deleteBtn = e.target.closest('[data-delete]');
                if (deleteBtn) {
                    deleteReport(deleteBtn.getAttribute('data-delete'));
                }
            });
        }

        // Load open report count badge on init (even before tab switch)
        loadReportStats();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose functions globally for test user auto-load
    window.loadReportStats = loadReportStats;
    window.loadReports = loadReports;
})();
