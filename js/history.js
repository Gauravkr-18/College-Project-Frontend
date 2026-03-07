/* ============================================
   History Popup
   localStorage-backed example history.
   Depends on: popup-core.js (_P namespace)

   Features:
     - Stores last 50 viewed examples in localStorage
     - Time-based filtering (hour/today/week/month/all)
     - Text search within history
     - Open or remove individual items
   ============================================ */

(function (P) {
    'use strict';

    var $ = P.$, $$ = P.$$;

    // ---- State ----
    var historyFilter = 'all';
    var historyClickAttached = false;
    var currentHistoryList = [];

    // ============================================
    // HISTORY POPUP
    // ============================================

    function initHistoryPopup() {
        // Filter button
        $('#historyFilterBtn').addEventListener('click', function (e) {
            e.stopPropagation();
            $('#historyFilterMenu').classList.toggle('open');
        });

        document.addEventListener('click', function (e) {
            if (!e.target.closest('#historyFilterWrapper')) {
                $('#historyFilterMenu').classList.remove('open');
            }
        });

        // Filter options
        $$('.history-filter-option').forEach(function (opt) {
            opt.addEventListener('click', function () {
                historyFilter = opt.getAttribute('data-filter');
                $$('.history-filter-option').forEach(function (o) { o.classList.remove('active'); });
                opt.classList.add('active');
                var labels = { hour: 'Last Hour', today: 'Today', week: 'This Week', month: 'This Month', all: 'All Time' };
                $('#historyFilterLabel').textContent = labels[historyFilter] || 'All Time';
                $('#historyFilterMenu').classList.remove('open');
                refreshHistory();
            });
        });

        // Search
        $('#historySearchInput').addEventListener('input', function () { refreshHistory(); });

        // Clear
        $('#historyClearBtn').addEventListener('click', function () {
            P.saveHistory([]);
            refreshHistory();
        });
    }

    function refreshHistory() {
        var list = P.getHistory();
        var search = ($('#historySearchInput').value || '').toLowerCase().trim();

        // Filter by time
        var now = Date.now();
        list = list.filter(function (h) {
            var t = new Date(h.timestamp).getTime();
            if (historyFilter === 'hour') return (now - t) < 3600000;
            if (historyFilter === 'today') return new Date(h.timestamp).toDateString() === new Date().toDateString();
            if (historyFilter === 'week') return (now - t) < 604800000;
            if (historyFilter === 'month') return (now - t) < 2592000000;
            return true;
        });

        // Filter by search
        if (search) {
            list = list.filter(function (h) {
                return h.title.toLowerCase().indexOf(search) !== -1 ||
                    (h.category && h.category.toLowerCase().indexOf(search) !== -1);
            });
        }

        renderHistoryList(list);
    }

    function renderHistoryList(list) {
        var container = $('#historyListInner');
        var emptyEl = $('#historyEmpty');
        currentHistoryList = list;

        if (list.length === 0) {
            emptyEl.style.display = 'flex';
            container.innerHTML = '';
            return;
        }

        emptyEl.style.display = 'none';
        var parts = [];
        for (var i = 0; i < list.length; i++) {
            var h = list[i];
            var langInfo = P.LANG_MAP[h.lang] || { label: h.lang, ext: '' };
            parts.push(
                '<div class="history-row">' +
                '<div class="history-row-info">' +
                '<div class="history-row-top">' +
                '<span class="history-row-name">' + escapeHtml(h.title) + '</span>' +
                '<span class="history-row-time">' + P.formatRelativeTime(h.timestamp) + '</span>' +
                '</div>' +
                '<div class="history-row-meta">' +
                '<span class="history-lang-badge">' + langInfo.label.substring(0, 2).toUpperCase() + '</span>' +
                '<span>' + escapeHtml(h.category || '') + '</span>' +
                '<span>&middot;</span>' +
                '<span>' + (h.steps || 0) + ' steps</span>' +
                '</div>' +
                '</div>' +
                '<div class="history-row-actions">' +
                '<button class="history-open-btn" data-hidx="' + i + '" title="Open"><svg data-lucide="file-up"></svg></button>' +
                '<button class="history-remove-btn" data-hidx="' + i + '" title="Remove"><svg data-lucide="trash-2"></svg></button>' +
                '</div>' +
                '</div>'
            );
        }
        container.innerHTML = parts.join('');
        P.refreshIcons(container);

        if (!historyClickAttached) {
            historyClickAttached = true;
            container.addEventListener('click', function (e) {
                var openBtn = e.target.closest('.history-open-btn');
                var removeBtn = e.target.closest('.history-remove-btn');
                var idx, h;
                if (openBtn) {
                    idx = parseInt(openBtn.getAttribute('data-hidx'), 10);
                    h = currentHistoryList[idx];
                    if (h) { P.loadHistoryItemIntoEditor(h); P.closePopup('historyPopup'); }
                } else if (removeBtn) {
                    idx = parseInt(removeBtn.getAttribute('data-hidx'), 10);
                    h = currentHistoryList[idx];
                    if (h) {
                        var all = P.getHistory().filter(function (item) {
                            return !(item.title === h.title && item.lang === h.lang && item.timestamp === h.timestamp);
                        });
                        P.saveHistory(all);
                        refreshHistory();
                    }
                }
            });
        }
    }

    // ============================================
    // INIT
    // ============================================

    document.addEventListener('DOMContentLoaded', function () {
        initHistoryPopup();

        // History button trigger
        var historyBtn = $('#historyBtn');
        if (historyBtn) {
            historyBtn.addEventListener('click', function () {
                P.openPopup('historyPopup');
                refreshHistory();
            });
        }
    });

})(window._P);
