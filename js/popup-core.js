(function () {
    'use strict';

    var EXAMPLES_BASE = (typeof API_URL !== 'undefined' ? API_URL.replace('/api', '') : 'http://localhost:5000');
    var LANG_MAP = {
        c: { file: 'C.json', label: 'C', ext: '.c' },
        cpp: { file: 'CPP.json', label: 'C++', ext: '.cpp' },
        java: { file: 'Java.json', label: 'Java', ext: '.java' },
        python: { file: 'Python.json', label: 'Python', ext: '.py' },
        javascript: { file: 'JavaScript.json', label: 'JavaScript', ext: '.js' }
    };
    var HISTORY_KEY = 'codelens-history';
    var MAX_HISTORY = 50;

    var examplesCache = {};
    var itemCache = {};
    var SVG_FOOTPRINTS = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16v-2.38C4 11.5 2.97 10.12 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.5-2 8.5v2"/><path d="M20 20v-2.38c0-2.12 1.03-3.5 1-5.62-.03-2.72-1.49-6-4.5-6-1.87 0-2.5 1.8-2.5 3.5 0 3.11 2 5.5 2 8.5v2"/><path d="M2 21h6"/><path d="M16 21h6"/></svg>';
    var SVG_CHEVRON_RIGHT = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
    var SVG_PLAY_SM = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
    var SVG_TAG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>';
    var SVG_LAYERS = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m6.08 9.5-3.5 1.6a1 1 0 0 0 0 1.81l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9a1 1 0 0 0 0-1.83l-3.5-1.59"/><path d="m6.08 14.5-3.5 1.6a1 1 0 0 0 0 1.81l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9a1 1 0 0 0 0-1.83l-3.5-1.59"/></svg>';
    var SVG_REPEAT = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>';
    var SVG_BRACKETS = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M21 16v5h-5"/><path d="M3 16v5h5"/></svg>';
    var SVG_ROUTE = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a2.5 2.5 0 0 0 0-5H5.5a2.5 2.5 0 0 1 0-5H14"/><circle cx="18" cy="5" r="3"/></svg>';
    var SVG_BOX = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.73Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>';
    var SVG_SIGMA = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 7V4H6l6 8-6 8h12v-3"/></svg>';
    var SVG_LINK = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07L12 5"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07L12 19"/></svg>';
    var SVG_EYE = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
    var SVG_EYE_OFF = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>';

    function $(sel, ctx) { return (ctx || document).querySelector(sel); }
    function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

    function refreshIcons(rootEl) {
        if (!window.lucide) return;
        if (rootEl) {
            lucide.createIcons({ rootElement: rootEl });
        } else {
            lucide.createIcons();
        }
    }

    function formatRelativeTime(date) {
        var now = Date.now();
        var diff = now - new Date(date).getTime();
        var s = Math.floor(diff / 1000);
        if (s < 60) return s + 's ago';
        var m = Math.floor(s / 60);
        if (m < 60) return m + 'm ago';
        var h = Math.floor(m / 60);
        if (h < 24) return h + 'h ago';
        var d = Math.floor(h / 24);
        return d + 'd ago';
    }

    function getCategoryColor(cat) {
        return CategoryColors.catColor(cat);
    }

    function getCategoryIcon(cat) {
        var c = (cat || '').toLowerCase();
        if (c.includes('loop') || c.includes('recursion')) return SVG_REPEAT;
        if (c.includes('array') || c.includes('list') || c.includes('dict') || c.includes('map') || c.includes('collection') || c.includes('stl')) return SVG_BRACKETS;
        if (c.includes('condition') || c.includes('logic') || c.includes('search') || c.includes('graph') || c.includes('tree')) return SVG_ROUTE;
        if (c.includes('class') || c.includes('object') || c.includes('oop') || c.includes('struct') || c.includes('interface')) return SVG_BOX;
        if (c.includes('math') || c.includes('arithmetic') || c.includes('algorithm') || c.includes('dp')) return SVG_SIGMA;
        if (c.includes('pointer') || c.includes('memory') || c.includes('linked') || c.includes('singly') || c.includes('doubly')) return SVG_LINK;
        return SVG_TAG;
    }

    function isCurrentUserAdmin() {
        try {
            var user = JSON.parse(localStorage.getItem('codelens-user'));
            return !!(user && user.role === 'admin');
        } catch (e) { return false; }
    }

    function isCurrentUserTester() {
        try {
            var user = JSON.parse(localStorage.getItem('codelens-user'));
            return !!(user && user.role === 'tester');
        } catch (e) { return false; }
    }

    function getAuthToken() {
        return localStorage.getItem('codelens-token') || null;
    }

    function openPopup(id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closePopup(id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.classList.remove('open');
        document.body.style.overflow = '';
    }

    document.addEventListener('click', function (e) {
        if (e.target.classList.contains('popup-overlay')) {
            closePopup(e.target.id);
        }
        var closeBtn = e.target.closest('[data-close-popup]');
        if (closeBtn) {
            closePopup(closeBtn.getAttribute('data-close-popup'));
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            $$('.popup-overlay.open').forEach(function (p) { closePopup(p.id); });
            if (P.closeSearchDropdown) P.closeSearchDropdown();
        }
    });

    function loadExamples(type, langKey, cb) {
        var admin    = isCurrentUserAdmin();
        var tester   = isCurrentUserTester();
        var elevated = admin || tester;
        var token    = getAuthToken();
        var cacheKey = type + '_' + langKey + (elevated ? '_admin' : '');

        if (examplesCache[cacheKey]) {
            cb(examplesCache[cacheKey]);
            return;
        }

        var url  = elevated
            ? EXAMPLES_BASE + '/api/examples/admin-list/' + type + '/' + langKey
            : EXAMPLES_BASE + '/api/examples/list/'       + type + '/' + langKey;
        var opts = { cache: 'no-store' };
        if (elevated && token) opts.headers = { 'Authorization': 'Bearer ' + token };

        fetch(url, opts)
            .then(function (r) {
                if (!r.ok) return { data: [] };
                return r.json();
            })
            .then(function (res) {
                var data = (res && res.data) ? res.data : [];
                examplesCache[cacheKey] = data;
                cb(data);
            })
            .catch(function () { cb([]); });
    }

    function invalidateExamplesCache(type, langKey) {
        delete examplesCache[type + '_' + langKey];
        delete examplesCache[type + '_' + langKey + '_admin'];
    }

    function fetchExampleItem(type, langKey, rawIdx, cb) {
        var cacheKey = type + '_' + langKey + '_' + rawIdx;
        if (itemCache[cacheKey]) { cb(itemCache[cacheKey]); return; }
        var opts = {};
        var token = getAuthToken();
        if (token) opts.headers = { 'Authorization': 'Bearer ' + token };
        fetch(EXAMPLES_BASE + '/api/examples/item/' + type + '/' + langKey + '/' + rawIdx, opts)
            .then(function (r) {
                if (r.status === 429) {
                    var titleEl = document.getElementById('authTitle');
                    var subtitleEl = document.getElementById('authSubtitle');
                    if (titleEl) titleEl.textContent = 'Unlock Unlimited Access';
                    if (subtitleEl) subtitleEl.textContent =
                        'You\'ve used your free visualizations. Login or sign up to continue.';
                    if (typeof openAuthModal === 'function') openAuthModal();
                    return null;
                }
                return r.ok ? r.json() : null;
            })
            .then(function (res) {
                if (res && res.success && res.data) {
                    itemCache[cacheKey] = res.data;
                    cb(res.data);
                } else {
                    cb(null);
                }
            })
            .catch(function () { cb(null); });
    }

    function getHistory() {
        try {
            return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
        } catch (e) { return []; }
    }

    function saveHistory(list) {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)));
    }

    function addToHistory(example, lang, type) {
        var list = getHistory();
        list = list.filter(function (h) {
            return !(h.title === example.meta.title && h.lang === lang);
        });
        list.unshift({
            title: example.meta.title,
            lang: lang,
            category: example.meta.category,
            level: example.meta.level,
            steps: example.meta.total_steps,
            type: type || 'stack',
            timestamp: new Date().toISOString(),
            code: example.meta.code
        });
        saveHistory(list);
    }

    function trackExampleView(title, lang, type) {
        try {
            var token = localStorage.getItem('codelens-token');
            var endpoint = token
                ? EXAMPLES_BASE + '/api/examples/track-view'
                : EXAMPLES_BASE + '/api/examples/track-view-guest';

            var headers = {
                'Content-Type': 'application/json'
            };
            if (token) {
                headers['Authorization'] = 'Bearer ' + token;
            }

            fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ title: title, lang: lang, type: type })
            }).catch(function() {});
        } catch (e) {}
    }

    var GUEST_RUN_LIMIT = 5;
    var GUEST_RUN_KEY   = 'codelens-guest-runs';

    function getGuestRuns() {
        try { return parseInt(sessionStorage.getItem(GUEST_RUN_KEY), 10) || 0; } catch (e) { return 0; }
    }
    function incrementGuestRuns() {
        try { sessionStorage.setItem(GUEST_RUN_KEY, getGuestRuns() + 1); } catch (e) {}
        updateGuestRunBadge();
    }
    function isLoggedIn() {
        try { return !!(localStorage.getItem('codelens-token') && localStorage.getItem('codelens-user')); } catch (e) { return false; }
    }
    function updateGuestRunBadge() {
        var badge  = document.getElementById('guestRunBadge');
        var textEl = document.getElementById('guestRunText');
        if (!badge) return;
        if (isLoggedIn()) { badge.style.display = 'none'; return; }
        var used      = getGuestRuns();
        var remaining = Math.max(0, GUEST_RUN_LIMIT - used);
        badge.style.display = 'flex';
        if (remaining === 0) {
            textEl.textContent = 'Login to continue';
            badge.classList.add('guest-run-badge--empty');
        } else {
            textEl.textContent = remaining + ' free run' + (remaining === 1 ? '' : 's') + ' left';
            badge.classList.remove('guest-run-badge--empty');
        }
    }

    function loadExampleIntoEditor(example, lang, type) {
        var exampleType = type || (example && example.meta && example.meta.type) || 'stack';

        if (!isLoggedIn()) {
            if (getGuestRuns() >= GUEST_RUN_LIMIT) {
                // Customise modal message before opening
                var titleEl    = document.getElementById('authTitle');
                var subtitleEl = document.getElementById('authSubtitle');
                if (titleEl)    titleEl.textContent = 'Unlock Unlimited Access';
                if (subtitleEl) subtitleEl.textContent =
                    'You\'ve used your 5 free visualizations. Login or sign up to continue.';
                if (typeof openAuthModal === 'function') openAuthModal();
                return; // abort load
            }
            incrementGuestRuns();
        }

        addToHistory(example, lang, exampleType);
        trackExampleView(example.meta.title, lang, exampleType);
        var m = example.meta;
        var langInfo = LANG_MAP[lang] || { ext: '.c', label: 'C' };

        var fileBadge = $('.file-badge span');
        if (fileBadge) {
            var nameSlug  = m.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 20);
            var truncated = (typeof truncateFileName === 'function') ? truncateFileName(nameSlug) : nameSlug;
            fileBadge.innerHTML = escapeHtml(truncated) + '<span class="ext">' + escapeHtml(langInfo.ext) + '</span>';
        }

        var codeContent = $('.code-content');
        if (codeContent) {
            SyntaxHighlighter.applyToViewer(m.code, lang, codeContent);
        }

        var codeInfo = $('.code-container-header .info');
        if (codeInfo) {
            var lineCount = (m.code || '').split('\n').length;
            codeInfo.textContent = langInfo.label + ' · ' + lineCount + ' lines';
        }

        window.__currentExample = example;
        window.__currentLang = lang;
        window.__currentType = exampleType;

        if (window.VisualizerPanel && typeof window.VisualizerPanel.setActiveTab === 'function') {
            window.VisualizerPanel.setActiveTab(exampleType, false);
        }

        if (window.AnimationController) {
            window.AnimationController.load(example);
        }

        // Refresh fullscreen editor if open
        if (window.FullScreenEditor && typeof window.FullScreenEditor.refresh === 'function') {
            window.FullScreenEditor.refresh();
        }
    }

    function loadHistoryItemIntoEditor(historyItem) {
        var example = {
            meta: {
                title: historyItem.title,
                code: historyItem.code || '',
                category: historyItem.category,
                level: historyItem.level,
                total_steps: historyItem.steps
            }
        };
        loadExampleIntoEditor(example, historyItem.lang, historyItem.type || 'stack');
    }

    var P = window._P = {
        EXAMPLES_BASE: EXAMPLES_BASE,
        LANG_MAP: LANG_MAP,
        HISTORY_KEY: HISTORY_KEY,
        MAX_HISTORY: MAX_HISTORY,
        SVG_FOOTPRINTS: SVG_FOOTPRINTS,
        SVG_CHEVRON_RIGHT: SVG_CHEVRON_RIGHT,
        SVG_PLAY_SM: SVG_PLAY_SM,
        SVG_TAG: SVG_TAG,
        SVG_LAYERS: SVG_LAYERS,
        SVG_REPEAT: SVG_REPEAT,
        SVG_BRACKETS: SVG_BRACKETS,
        SVG_ROUTE: SVG_ROUTE,
        SVG_BOX: SVG_BOX,
        SVG_SIGMA: SVG_SIGMA,
        SVG_LINK: SVG_LINK,
        SVG_EYE: SVG_EYE,
        SVG_EYE_OFF: SVG_EYE_OFF,
        $: $,
        $$: $$,
        refreshIcons: refreshIcons,
        formatRelativeTime: formatRelativeTime,
        getCategoryColor: getCategoryColor,
        getCategoryIcon: getCategoryIcon,
        openPopup: openPopup,
        closePopup: closePopup,
        examplesCache: examplesCache,
        itemCache: itemCache,
        currentType: 'stack',
        currentLang: 'c',
        isCurrentUserAdmin: isCurrentUserAdmin,
        isCurrentUserTester: isCurrentUserTester,
        getAuthToken: getAuthToken,
        loadExamples: loadExamples,
        invalidateExamplesCache: invalidateExamplesCache,
        fetchExampleItem: fetchExampleItem,
        getHistory: getHistory,
        saveHistory: saveHistory,
        addToHistory: addToHistory,
        loadExampleIntoEditor: loadExampleIntoEditor,
        loadHistoryItemIntoEditor: loadHistoryItemIntoEditor,
        updateGuestRunBadge: updateGuestRunBadge,
        currentExampleList: [],
        currentExampleListIndex: -1,
        closeSearchDropdown: null,
        openBrowseExamples: null
    };

    // Init badge on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateGuestRunBadge);
    } else {
        updateGuestRunBadge();
    }

})();
