/* ============================================
   Global Search Dropdown
   Debounced search across all languages.
   Depends on: popup-core.js (_P namespace)

   Features:
     - 200ms debounced search across all 5 languages
     - Keyboard navigation (↑/↓/Enter)
     - Ctrl+K shortcut to focus
     - Max 8 results with language badges
   ============================================ */

(function (P) {
    'use strict';

    var $ = P.$, $$ = P.$$;

    // ---- State ----
    var searchHighlightIdx = -1;
    var searchDebounce = null;

    // ============================================
    // GLOBAL SEARCH DROPDOWN
    // ============================================

    function initGlobalSearch() {
        var input = $('#globalSearchInput');
        var dropdown = $('#searchDropdown');
        var wrapper = $('#globalSearchWrapper');
        var shortcut = $('#searchShortcut');
        var clearBtn = $('#searchClearBtn');

        input.addEventListener('focus', function () {
            if (input.value.trim()) performSearch(input.value.trim());
        });

        input.addEventListener('input', function () {
            var val = input.value.trim();
            clearBtn.style.display = val ? 'block' : 'none';
            shortcut.style.display = val ? 'none' : 'flex';
            if (searchDebounce) clearTimeout(searchDebounce);
            if (!val) { closeSearchDropdown(); return; }
            searchDebounce = setTimeout(function () {
                performSearch(val);
            }, 200);
        });

        clearBtn.addEventListener('click', function () {
            input.value = '';
            clearBtn.style.display = 'none';
            shortcut.style.display = 'flex';
            closeSearchDropdown();
            input.focus();
        });

        // Ctrl+K shortcut
        document.addEventListener('keydown', function (e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                input.focus();
                input.select();
            }
        });

        // Close when clicking outside
        document.addEventListener('click', function (e) {
            if (!e.target.closest('#globalSearchWrapper')) {
                closeSearchDropdown();
            }
        });

        // Keyboard navigation
        input.addEventListener('keydown', function (e) {
            var items = $$('.search-result-item', dropdown);
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                searchHighlightIdx = Math.min(searchHighlightIdx + 1, items.length - 1);
                updateSearchHighlight(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                searchHighlightIdx = Math.max(searchHighlightIdx - 1, 0);
                updateSearchHighlight(items);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (searchHighlightIdx >= 0 && items[searchHighlightIdx]) {
                    items[searchHighlightIdx].click();
                }
            }
        });

        // Browse all btn
        $('#searchBrowseAllBtn').addEventListener('click', function () {
            closeSearchDropdown();
            input.value = '';
            clearBtn.style.display = 'none';
            shortcut.style.display = 'flex';
            if (P.openBrowseExamples) P.openBrowseExamples();
        });
    }

    function performSearch(query) {
        var q = query.toLowerCase();
        var results = [];
        var langKeys = Object.keys(P.LANG_MAP);
        var pending = langKeys.length;

        langKeys.forEach(function (langKey) {
            P.loadExamples(P.currentType, langKey, function (data) {
                data.forEach(function (ex) {
                    var m = ex.meta;
                    if (m.title.toLowerCase().indexOf(q) !== -1 ||
                        (m.category && m.category.toLowerCase().indexOf(q) !== -1) ||
                        (m.description && m.description.toLowerCase().indexOf(q) !== -1)) {
                        results.push({ example: ex, lang: langKey });
                    }
                });
                pending--;
                if (pending === 0) {
                    renderSearchResults(results.slice(0, 8));
                }
            });
        });
    }

    function renderSearchResults(results) {
        var list = $('#searchResultsList');
        searchHighlightIdx = -1;

        if (results.length === 0) {
            list.innerHTML = '<div class="search-no-results">No results found</div>';
            openSearchDropdown();
            return;
        }

        var html = '';
        results.forEach(function (r, i) {
            var m = r.example.meta;
            var langInfo = P.LANG_MAP[r.lang];
            var levelClass = (m.level || 'easy').toLowerCase();
            var catColor = P.getCategoryColor(m.category);
            html += '<div class="search-result-item" data-search-idx="' + i + '" data-lang="' + r.lang + '">' +
                '<div class="search-result-lang-badge" data-lang="' + r.lang + '">' + langInfo.label.substring(0, 2).toUpperCase() + '</div>' +
                '<div class="search-result-info">' +
                '<div class="search-result-title-row">' +
                '<span class="search-result-title">' + escapeHtml(m.title) + '</span>' +
                '</div>' +
                '<div class="search-result-meta">' +
                '<span style="background:' + catColor.bg + ';color:' + catColor.color + ';padding:1px 5px;border-radius:3px;">' + escapeHtml(m.category || '') + '</span>' +
                '<span class="dot">&middot;</span>' +
                '<svg data-lucide="footprints"></svg> ' + (m.total_steps || 0) + ' steps' +
                '</div>' +
                '</div>' +
                '<button class="search-result-play-btn" title="Visualize"><svg data-lucide="play"></svg></button>' +
                '</div>';
        });
        list.innerHTML = html;
        P.refreshIcons(list);

        var searchClickHandler = function (e) {
            var item = e.target.closest('.search-result-item');
            if (!item) return;
            var idx = parseInt(item.getAttribute('data-search-idx'), 10);
            if (!isNaN(idx) && results[idx]) {
                var r = results[idx];
                P.fetchExampleItem(P.currentType, r.lang, r.example._idx, function (fullEx) {
                    if (!fullEx) return;
                    P.loadExampleIntoEditor(fullEx, r.lang, P.currentType);
                });
            }
            closeSearchDropdown();
            $('#globalSearchInput').value = '';
            $('#searchClearBtn').style.display = 'none';
            $('#searchShortcut').style.display = 'flex';
        };

        list.removeEventListener('click', list._searchHandler);
        list._searchHandler = searchClickHandler;
        list.addEventListener('click', searchClickHandler);

        openSearchDropdown();
    }

    function openSearchDropdown() {
        $('#searchDropdown').classList.add('open');
    }

    function closeSearchDropdown() {
        $('#searchDropdown').classList.remove('open');
        searchHighlightIdx = -1;
    }

    // Expose for ESC handler in popup-core
    P.closeSearchDropdown = closeSearchDropdown;

    function updateSearchHighlight(items) {
        items.forEach(function (item, i) {
            item.classList.toggle('highlighted', i === searchHighlightIdx);
        });
        if (items[searchHighlightIdx]) {
            items[searchHighlightIdx].scrollIntoView({ block: 'nearest' });
        }
    }

    // ============================================
    // INIT
    // ============================================

    document.addEventListener('DOMContentLoaded', function () {
        initGlobalSearch();
    });

})(window._P);
