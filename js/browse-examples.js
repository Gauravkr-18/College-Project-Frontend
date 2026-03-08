/* ============================================
   Browse Examples Popup
   Type/lang tabs, category filter, list + preview.
   Depends on: popup-core.js (_P namespace)

   Features:
     - Type toggle (Stack / Data Structures)
     - Language tabs (C, C++, Java, Python, JS)
     - Category filter dropdown with color badges
     - Split view: scrollable list + code preview
     - Session persistence (restores scroll + selection)
     - Admin: toggle example visibility
   ============================================ */

(function (P) {
    'use strict';

    var $ = P.$, $$ = P.$$;

    // ---- State ----
    var currentCategory = 'all';
    var currentExampleIndex = -1;
    var filteredExamples = [];
    var listClickAttached = false;
    var catClickAttached = false;
    var isAdmin = false; // set during init
    var isTester = false; // set during init

    // ---- Session Storage ----
    var STORAGE_KEY = 'browseExamples_state';
    var pendingRestore = null;

    function saveBrowseState() {
        try {
            var searchInput = $('#examplePopupSearch');
            var listContainer = $('#examplesList');
            var selectedTitle = (currentExampleIndex >= 0 && filteredExamples[currentExampleIndex])
                ? filteredExamples[currentExampleIndex].meta.title : null;
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
                type: P.currentType,
                lang: P.currentLang,
                category: currentCategory,
                search: searchInput ? searchInput.value : '',
                selectedTitle: selectedTitle,
                scrollTop: listContainer ? listContainer.scrollTop : 0
            }));
        } catch (e) {}
    }

    function loadBrowseState() {
        try {
            var raw = sessionStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }

    // ============================================
    // BROWSE EXAMPLES POPUP
    // ============================================

    function initBrowseExamples() {
        // Detect if current user is admin or tester
        isAdmin = P.isCurrentUserAdmin();
        isTester = P.isCurrentUserTester();

        // Show the admin visibility toggle button only for admins (not testers)
        var visBtn = $('#toggleVisibilityBtn');
        if (visBtn) visBtn.style.display = isAdmin ? 'flex' : 'none';

        // Eye toggle click
        if (isAdmin && visBtn) {
            visBtn.addEventListener('click', function () {
                if (currentExampleIndex < 0 || !filteredExamples[currentExampleIndex]) return;
                var metaItem = filteredExamples[currentExampleIndex];
                toggleExampleVisibility(metaItem._idx);
            });
        }

        // Type tabs
        $$('.example-type-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                $$('.example-type-btn').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                P.currentType = btn.getAttribute('data-type');
                if (window.VisualizerPanel && typeof window.VisualizerPanel.setActiveTab === 'function') {
                    window.VisualizerPanel.setActiveTab(P.currentType, false);
                }
                currentCategory = 'all';
                refreshExamplesList();
            });
        });

        // Lang tabs
        $('#exampleLangTabs').addEventListener('click', function (e) {
            var tab = e.target.closest('.lang-tab');
            if (!tab) return;
            $$('.lang-tab').forEach(function (t) { t.classList.remove('active'); });
            tab.classList.add('active');
            P.currentLang = tab.getAttribute('data-lang');
            currentCategory = 'all';
            updateCategorySelect('All Categories');
            refreshExamplesList();
        });

        // Search
        var searchInput = $('#examplePopupSearch');
        var clearBtn = $('#exampleSearchClear');
        searchInput.addEventListener('input', function () {
            clearBtn.style.display = searchInput.value ? 'flex' : 'none';
            refreshExamplesList();
        });
        clearBtn.addEventListener('click', function () {
            searchInput.value = '';
            clearBtn.style.display = 'none';
            refreshExamplesList();
        });

        // Persist scroll position on list scroll
        var listEl = $('#examplesList');
        if (listEl) {
            listEl.addEventListener('scroll', saveBrowseState);
        }

        // Category filter
        $('#categorySelectBtn').addEventListener('click', function () {
            var dd = $('#categoryDropdown');
            var btn = $('#categorySelectBtn');
            dd.classList.toggle('open');
            btn.classList.toggle('open');
        });

        document.addEventListener('click', function (e) {
            if (!e.target.closest('#categorySelectWrapper')) {
                $('#categoryDropdown').classList.remove('open');
                $('#categorySelectBtn').classList.remove('open');
            }
        });

        // Copy code button
        var SVG_CHECK = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
        var SVG_COPY = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
        $('#previewCopyBtn').addEventListener('click', function () {
            var codeEl = $('#previewCodeContent');
            if (!codeEl) return;
            navigator.clipboard.writeText(codeEl.textContent).then(function () {
                var btn = $('#previewCopyBtn');
                btn.classList.add('copied');
                btn.innerHTML = SVG_CHECK + ' Copied!';
                setTimeout(function () {
                    btn.classList.remove('copied');
                    btn.innerHTML = SVG_COPY + ' Copy';
                }, 2000);
            });
        });

        // Load example button
        $('#loadExampleBtn').addEventListener('click', function () {
            if (currentExampleIndex < 0 || !filteredExamples[currentExampleIndex]) return;
            var metaItem = filteredExamples[currentExampleIndex];
            P.fetchExampleItem(P.currentType, P.currentLang, metaItem._idx, function (fullEx) {
                if (!fullEx) return;
                P.currentExampleList = filteredExamples.slice();
                P.currentExampleListIndex = currentExampleIndex;
                P.loadExampleIntoEditor(fullEx, P.currentLang, P.currentType);
                P.closePopup('browseExamplesPopup');
            });
        });

        // Initial load
        refreshExamplesList();
    }

    function refreshExamplesList() {
        P.loadExamples(P.currentType, P.currentLang, function (data) {
            // Update count badge for the active lang tab (visible examples only)
            var visibleCount = (isAdmin || isTester)
                ? data.filter(function (ex) { return !ex.hidden; }).length
                : data.length;
            var _ce = document.getElementById('count' + P.currentLang.charAt(0).toUpperCase() + P.currentLang.slice(1));
            if (_ce) _ce.textContent = visibleCount;

            var searchVal = ($('#examplePopupSearch').value || '').toLowerCase().trim();

            // Get categories
            var categories = [];
            data.forEach(function (ex) {
                var cat = ex.meta.category;
                if (cat && categories.indexOf(cat) === -1) categories.push(cat);
            });
            buildCategoryDropdown(categories);

            // Filter
            filteredExamples = data.filter(function (ex) {
                var matchCat = currentCategory === 'all' || ex.meta.category === currentCategory;
                var matchSearch = !searchVal ||
                    ex.meta.title.toLowerCase().indexOf(searchVal) !== -1 ||
                    (ex.meta.category && ex.meta.category.toLowerCase().indexOf(searchVal) !== -1) ||
                    (ex.meta.description && ex.meta.description.toLowerCase().indexOf(searchVal) !== -1);
                return matchCat && matchSearch;
            });

            currentExampleIndex = filteredExamples.length > 0 ? 0 : -1;

            // Restore previously opened example on popup reopen
            if (pendingRestore && pendingRestore.selectedTitle && filteredExamples.length > 0) {
                for (var ri = 0; ri < filteredExamples.length; ri++) {
                    if (filteredExamples[ri].meta.title === pendingRestore.selectedTitle) {
                        currentExampleIndex = ri;
                        break;
                    }
                }
            }

            renderExampleList(filteredExamples);
            $('#examplesCountBadge').textContent = filteredExamples.length;

            if (filteredExamples.length > 0) {
                showPreview(filteredExamples[currentExampleIndex]);
            } else {
                showPreviewEmpty();
            }

            // Restore scroll position on popup reopen
            if (pendingRestore && pendingRestore.scrollTop) {
                var restoreScroll = pendingRestore.scrollTop;
                var restoreContainer = $('#examplesList');
                if (restoreContainer) {
                    requestAnimationFrame(function () {
                        restoreContainer.scrollTop = restoreScroll;
                    });
                }
            }
            pendingRestore = null;
            saveBrowseState();
        });
    }

    function buildCategoryDropdown(categories) {
        var container = $('#categoryDropdown');
        var html = '<button class="category-dropdown-item ' + (currentCategory === 'all' ? 'active' : '') + '" data-cat="all">' +
            P.SVG_LAYERS + ' All Categories</button>';
        categories.forEach(function (cat) {
            var categoryIcon = P.getCategoryIcon(cat);
            html += '<button class="category-dropdown-item ' + (currentCategory === cat ? 'active' : '') + '" data-cat="' + escapeHtml(cat) + '">' +
                categoryIcon +
                ' ' + escapeHtml(cat.charAt(0).toUpperCase() + cat.slice(1)) + '</button>';
        });
        container.innerHTML = html;

        if (!catClickAttached) {
            catClickAttached = true;
            container.addEventListener('click', function (e) {
                var item = e.target.closest('.category-dropdown-item');
                if (!item) return;
                currentCategory = item.getAttribute('data-cat');
                $$('.category-dropdown-item').forEach(function (i) { i.classList.remove('active'); });
                item.classList.add('active');
                updateCategorySelect(currentCategory === 'all' ? 'All Categories' : currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1));
                container.classList.remove('open');
                $('#categorySelectBtn').classList.remove('open');
                refreshExamplesList();
            });
        }
    }

    function updateCategorySelect(label) {
        var el = $('#categorySelectBtn .selected-label');
        if (el) el.textContent = label;
    }

    function renderExampleList(examples) {
        var container = $('#examplesList');
        if (examples.length === 0) {
            listClickAttached = false;
            container.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-muted); font-size:14px;">' +
                '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:10px;opacity:0.5;display:block;margin:0 auto 10px"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>' +
                'No examples found</div>';
            return;
        }

        var parts = [];
        for (var i = 0; i < examples.length; i++) {
            var m = examples[i].meta;
            var isHidden = !!examples[i].hidden;
            var catColor = P.getCategoryColor(m.category);
            var levelClass = (m.level || 'easy').toLowerCase();
            var isSelected = i === currentExampleIndex;
            parts.push(
                '<button class="example-list-item' + (isSelected ? ' selected' : '') + (isHidden ? ' hidden-example' : '') + '" data-idx="' + i + '">' +
                '<div class="example-item-content' + (isSelected ? ' has-indicator' : '') + '">' +
                '<div class="example-item-title-row">' +
                '<span class="example-item-index">' + (i + 1) + '</span>' +
                '<span class="example-item-title">' + escapeHtml(m.title) + '</span>' +
                (isHidden ? '<span class="hidden-example-badge">' + P.SVG_EYE_OFF + ' Hidden</span>' : '') +
                '</div>' +
                '<div class="example-item-meta">' +
                '<span class="level-dot ' + levelClass + '"></span>' +
                '<span class="example-category-badge" style="background:' + catColor.bg + ';color:' + catColor.color + ';">' + escapeHtml(m.category || '') + '</span>' +
                '<span class="example-steps-count">' + P.SVG_FOOTPRINTS + (m.total_steps || 0) + '</span>' +
                '</div>' +
                '</div>' +
                (isSelected ? P.SVG_CHEVRON_RIGHT : '<span style="width:16px;"></span>') +
                '</button>'
            );
        }
        container.innerHTML = parts.join('');

        if (!listClickAttached) {
            listClickAttached = true;
            container.addEventListener('click', function (e) {
                var item = e.target.closest('.example-list-item');
                if (!item) return;
                selectExample(parseInt(item.getAttribute('data-idx'), 10));
            });
        }
    }

    function selectExample(idx) {
        if (idx === currentExampleIndex) return;
        var container = $('#examplesList');
        var items = container.querySelectorAll('.example-list-item');

        if (currentExampleIndex >= 0 && items[currentExampleIndex]) {
            var prev = items[currentExampleIndex];
            prev.classList.remove('selected');
            var prevContent = prev.querySelector('.example-item-content');
            if (prevContent) prevContent.classList.remove('has-indicator');
            var prevArrow = prev.lastElementChild;
            if (prevArrow && !prevArrow.classList.contains('example-item-content')) {
                prevArrow.innerHTML = '';
                prevArrow.style.width = '16px';
                prevArrow.style.display = 'inline-block';
            }
        }

        currentExampleIndex = idx;

        if (items[idx]) {
            var cur = items[idx];
            cur.classList.add('selected');
            var curContent = cur.querySelector('.example-item-content');
            if (curContent) curContent.classList.add('has-indicator');
            var curArrow = cur.lastElementChild;
            if (curArrow && !curArrow.classList.contains('example-item-content')) {
                curArrow.outerHTML = P.SVG_CHEVRON_RIGHT;
            }
            cur.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }

        showPreview(filteredExamples[idx]);
        saveBrowseState();
    }

    function showPreviewEmpty() {
        $('#previewEmpty').style.display = 'flex';
        $('#previewContent').style.display = 'none';
        var loadBtn = $('#loadExampleBtn');
        if (loadBtn) { loadBtn.disabled = true; loadBtn.title = ''; }
        var noStepsNotice = $('#noStepsNotice');
        if (noStepsNotice) noStepsNotice.style.display = 'none';
    }

    function showPreview(ex) {
        if (!ex) { showPreviewEmpty(); return; }
        var m = ex.meta;
        $('#previewEmpty').style.display = 'none';
        $('#previewContent').style.display = 'flex';

        $('#previewTitle').textContent = m.title;

        var levelBadge = $('#previewLevel');
        var levelClass = (m.level || 'easy').toLowerCase();
        levelBadge.textContent = m.level || 'Easy';
        levelBadge.className = 'preview-level-badge ' + levelClass;

        var catBadge = $('#previewCategory');
        var catColor = P.getCategoryColor(m.category);
        catBadge.textContent = m.category || '';
        catBadge.style.background = catColor.bg;
        catBadge.style.color = catColor.color;

        $('#previewStepsNum').textContent = m.total_steps || 0;
        $('#previewDescription').textContent = m.description || '';
        $('#previewLangHint').textContent = P.LANG_MAP[P.currentLang].label;

        SyntaxHighlighter.applyToPreview(m.code, P.currentLang, $('#previewLineNums'), $('#previewCodeContent'));

        if (m.final_output) {
            $('#outputSection').style.display = 'flex';
            $('#previewOutputBlock').style.display = 'block';
            $('#previewOutputContent').textContent = m.final_output;
        } else {
            $('#outputSection').style.display = 'none';
            $('#previewOutputBlock').style.display = 'none';
        }

        // Update admin eye toggle button
        if (isAdmin) {
            var visBtn = $('#toggleVisibilityBtn');
            if (visBtn) {
                var isHidden = !!ex.hidden;
                visBtn.innerHTML = isHidden ? P.SVG_EYE_OFF : P.SVG_EYE;
                visBtn.title = isHidden ? 'Show to students' : 'Hide from students';
                visBtn.classList.toggle('is-hidden-example', isHidden);
            }
        }

        // Disable Load Example if no execution steps available
        var loadBtn = $('#loadExampleBtn');
        var noStepsNotice = $('#noStepsNotice');
        if (loadBtn) {
            var hasSteps = !!ex.has_steps;
            loadBtn.disabled = !hasSteps;
            loadBtn.title = '';
            if (noStepsNotice) noStepsNotice.style.display = hasSteps ? 'none' : 'flex';
        }
    }

    // ============================================
    // ADMIN: TOGGLE EXAMPLE VISIBILITY (optimistic)
    // ============================================

    function toggleExampleVisibility(rawIdx) {
        var token = P.getAuthToken();
        if (!token) return;

        var ex = filteredExamples[currentExampleIndex];
        if (!ex) return;

        // --- 1. Flip state immediately in memory ---
        var wasHidden = !!ex.hidden;
        var nowHidden = !wasHidden;
        ex.hidden = nowHidden;

        // Also patch the cache entry so other tabs/re-opens see the change
        var cacheKey = P.currentType + '_' + P.currentLang + '_admin';
        var cached   = P.examplesCache[cacheKey];
        if (cached) {
            var cacheEntry = cached.find(function (c) { return c._idx === rawIdx; });
            if (cacheEntry) cacheEntry.hidden = nowHidden;
        }

        // ⚠️ IMPORTANT: Also invalidate the regular (non-admin) cache so normal users
        // refetch the list and see the updated hidden state
        P.invalidateExamplesCache(P.currentType, P.currentLang);

        // --- 2. Update UI instantly (no flicker, no full reload) ---
        applyVisibilityToUI(nowHidden);

        // --- 3. Fire the backend request in background ---
        fetch(P.EXAMPLES_BASE + '/api/examples/toggle-visibility/' + P.currentType + '/' + P.currentLang + '/' + rawIdx, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(function (r) { return r.json(); })
        .then(function (res) {
            if (!res.success) {
                // Server rejected — roll back
                ex.hidden = wasHidden;
                if (cached) {
                    var ce = cached.find(function (c) { return c._idx === rawIdx; });
                    if (ce) ce.hidden = wasHidden;
                }
                applyVisibilityToUI(wasHidden);
            }
        })
        .catch(function () {
            // Network error — roll back
            ex.hidden = wasHidden;
            if (cached) {
                var ce = cached.find(function (c) { return c._idx === rawIdx; });
                if (ce) ce.hidden = wasHidden;
            }
            applyVisibilityToUI(wasHidden);
        });
    }

    // Apply hidden/visible state to the eye button + the current list item row
    function applyVisibilityToUI(isHidden) {
        // Update eye button
        var visBtn = $('#toggleVisibilityBtn');
        if (visBtn) {
            visBtn.innerHTML = isHidden ? P.SVG_EYE_OFF : P.SVG_EYE;
            visBtn.title     = isHidden ? 'Show to students' : 'Hide from students';
            visBtn.classList.toggle('is-hidden-example', isHidden);
        }

        // Update the list item row
        var container = $('#examplesList');
        var items     = container ? container.querySelectorAll('.example-list-item') : [];
        if (items[currentExampleIndex]) {
            var row       = items[currentExampleIndex];
            var titleRow  = row.querySelector('.example-item-title-row');
            var oldBadge  = titleRow ? titleRow.querySelector('.hidden-example-badge') : null;

            row.classList.toggle('hidden-example', isHidden);

            if (isHidden && titleRow && !oldBadge) {
                var badge = document.createElement('span');
                badge.className = 'hidden-example-badge';
                badge.innerHTML = P.SVG_EYE_OFF + ' Hidden';
                titleRow.appendChild(badge);
            } else if (!isHidden && oldBadge) {
                oldBadge.remove();
            }
        }

        // Update the visible-count badge on the lang tab
        var visibleCount = 0;
        filteredExamples.forEach(function (ex) { if (!ex.hidden) visibleCount++; });
        var _ce = document.getElementById('count' + P.currentLang.charAt(0).toUpperCase() + P.currentLang.slice(1));
        if (_ce) _ce.textContent = visibleCount;
    }

    // ============================================
    // LOAD NEXT EXAMPLE
    // ============================================

    P.loadNextExample = function () {
        var list = P.currentExampleList;
        if (!list || list.length === 0) {
            if (P.openBrowseExamples) P.openBrowseExamples();
            return;
        }
        var nextIdx = (P.currentExampleListIndex || 0) + 1;
        if (nextIdx >= list.length) {
            if (P.openBrowseExamples) P.openBrowseExamples();
            return;
        }
        var metaItem = list[nextIdx];
        P.fetchExampleItem(P.currentType, P.currentLang, metaItem._idx, function (fullEx) {
            if (!fullEx) { if (P.openBrowseExamples) P.openBrowseExamples(); return; }
            P.currentExampleListIndex = nextIdx;
            P.loadExampleIntoEditor(fullEx, P.currentLang, P.currentType);
        });
    };

    // ============================================
    // OPEN BROWSE EXAMPLES
    // ============================================

    function openBrowseExamples(lang, type) {
        // Restore saved state only when no explicit lang/type override
        var saved = (!lang && !type) ? loadBrowseState() : null;

        var resolvedType = type || (saved && saved.type) || P.currentType || 'stack';
        P.currentType = resolvedType;
        $$('.example-type-btn').forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-type') === resolvedType);
        });
        if (window.VisualizerPanel && typeof window.VisualizerPanel.setActiveTab === 'function') {
            window.VisualizerPanel.setActiveTab(resolvedType, false);
        }

        var resolvedLang = lang || (saved && saved.lang) || P.currentLang || 'c';
        P.currentLang = resolvedLang;
        $$('.lang-tab').forEach(function (t) {
            t.classList.toggle('active', t.getAttribute('data-lang') === resolvedLang);
        });

        if (saved) {
            // Restore category
            currentCategory = saved.category || 'all';
            var catLabel = currentCategory === 'all' ? 'All Categories'
                : currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1);
            updateCategorySelect(catLabel);

            // Restore search
            var searchInput = $('#examplePopupSearch');
            var clearBtn = $('#exampleSearchClear');
            if (searchInput) {
                searchInput.value = saved.search || '';
                if (clearBtn) clearBtn.style.display = saved.search ? 'flex' : 'none';
            }

            // Queue scroll + selection restore for after the list loads
            pendingRestore = saved;
        }

        P.openPopup('browseExamplesPopup');
        refreshExamplesList();
    }

    // Expose for search.js and triggers
    P.openBrowseExamples = openBrowseExamples;

    // ============================================
    // TRIGGERS
    // ============================================

    function setupTriggers() {
        var browseAllBtn = $('.dropdown-item.browse-all');
        if (browseAllBtn) {
            browseAllBtn.addEventListener('click', function () {
                openBrowseExamples();
            });
        }

        $$('.dropdown-item.lang-item').forEach(function (item) {
            item.addEventListener('click', function () {
                var langClass = ['c', 'cpp', 'java', 'python', 'javascript'].find(function (l) {
                    return item.classList.contains(l);
                });
                if (langClass) openBrowseExamples(langClass);
            });
        });

    }

    // ============================================
    // INIT
    // ============================================

    document.addEventListener('DOMContentLoaded', function () {
        initBrowseExamples();
        setupTriggers();
    });

})(window._P);
