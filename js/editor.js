/* ============================================
   Editor Page — Code Viewer Interactions
   Copy code | Reset | Resizer drag (20-30%)

   Responsibilities:
     - Toolbar buttons: copy, reset, fullscreen, expand
     - Resizer drag between code panel & visualizer
     - Visualizer tab switching (Stack / DS)
     - Initializes AnimationController on page load
   ============================================ */

(function () {
    'use strict';

    var codePanel    = null;
    var resizer      = null;
    var container    = null;
    var isDragging   = false;
    var startX       = 0;
    var startWidth   = 0;
    var containerW   = 0;

    var MIN_PCT = 20;
    var MAX_PCT = 30;

    // Saved on first load so Reset can restore them
    var defaultCodeHTML  = '';
    var defaultInfoText  = '';
    var defaultBadgeHTML = '';
    var activeVisType    = 'stack';

    // AnimationController is now in animation-controller.js
    var AnimCtrl = window.AnimationController;

    /* ---- Bootstrap ---- */
    function init() {
        codePanel = document.querySelector('.code-panel');
        resizer   = document.querySelector('.resizer');
        container = document.querySelector('.editor-container');

        var codeContent = document.querySelector('.code-content');
        var infoEl      = document.querySelector('.code-container-header .info');
        var badgeSpan   = document.querySelector('.file-badge span');

        if (codeContent) defaultCodeHTML = codeContent.innerHTML;
        if (infoEl)      defaultInfoText = infoEl.textContent;

        // Apply truncation to the initial file badge and save it for Reset
        if (badgeSpan) {
            var extEl  = badgeSpan.querySelector('.ext');
            var ext    = extEl ? extEl.textContent : '';
            var base   = badgeSpan.firstChild ? (badgeSpan.firstChild.textContent || '') : '';
            badgeSpan.innerHTML = truncateFileName(base.trim()) + '<span class="ext">' + escapeHtml(ext) + '</span>';
            defaultBadgeHTML = badgeSpan.innerHTML;
        }

        // Bind action buttons by title
        document.querySelectorAll('.action-btn').forEach(function (btn) {
            var t = btn.getAttribute('title') || '';
            if (t === 'Copy code') btn.addEventListener('click', handleCopy);
            if (t === 'Reset')     btn.addEventListener('click', handleReset);
        });

        // Fullscreen button
        var fsBtn = document.querySelector('.icon-btn[title="Fullscreen"]');
        if (fsBtn) {
            fsBtn.addEventListener('click', handleFullscreen);
            document.addEventListener('fullscreenchange', syncFullscreenIcon);
        }

        // Resizer drag
        if (resizer) resizer.addEventListener('mousedown', onResizerDown);

        // Visualizer tabs + placeholder actions
        initVisualizerTabs();

        // Animation controller buttons
        AnimCtrl.init();
    }

    /* ====================================================
       VISUALIZER TABS
       Enables Stack / Data Structure tab switching and
       keeps popup example type in sync.
    ==================================================== */
    function initVisualizerTabs() {
        var tabs = document.querySelectorAll('.vis-tab[data-vis-type]');
        var panes = document.querySelectorAll('.vis-pane[data-vis-pane]');

        if (!tabs.length || !panes.length) return;

        function applyTab(type, syncPopupType) {
            var nextType = (type === 'ds') ? 'ds' : 'stack';
            activeVisType = nextType;

            tabs.forEach(function (tab) {
                tab.classList.toggle('active', tab.getAttribute('data-vis-type') === nextType);
            });

            panes.forEach(function (pane) {
                pane.classList.toggle('active', pane.getAttribute('data-vis-pane') === nextType);
            });

            if (syncPopupType && window._P) {
                window._P.currentType = nextType;
                document.querySelectorAll('.example-type-btn').forEach(function (btn) {
                    btn.classList.toggle('active', btn.getAttribute('data-type') === nextType);
                });
            }
        }

        tabs.forEach(function (tab) {
            tab.addEventListener('click', function () {
                applyTab(tab.getAttribute('data-vis-type'), true);
            });
        });

        document.querySelectorAll('.vis-open-examples-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var type = btn.getAttribute('data-open-type') || 'stack';
                applyTab(type, true);
                if (window._P && typeof window._P.openBrowseExamples === 'function') {
                    window._P.openBrowseExamples(null, type);
                }
            });
        });

        window.VisualizerPanel = {
            getActiveTab: function () { return activeVisType; },
            setActiveTab: function (type, syncPopupType) {
                applyTab(type, syncPopupType !== false);
            }
        };

        applyTab(activeVisType, false);
    }

    /* ====================================================
       COPY CODE
       Reads text from every .code-text span and joins
       with newlines, then writes to clipboard.
    ==================================================== */
    function handleCopy() {
        var spans = document.querySelectorAll('.code-content .code-text');
        var text  = Array.prototype.map.call(spans, function (s) {
            return s.textContent;
        }).join('\n');

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(showCopied, function () {
                legacyCopy(text);
            });
        } else {
            legacyCopy(text);
        }
    }

    function legacyCopy(text) {
        var ta        = document.createElement('textarea');
        ta.value      = text;
        ta.style.cssText = 'position:fixed;opacity:0;left:-9999px;top:0;';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showCopied();
    }

    function showCopied() {
        var btn = document.querySelector('.action-btn[title="Copy code"]');
        if (!btn) return;
        var svg = btn.querySelector('svg');
        if (svg) svg.style.color = 'var(--accent-green, #22c55e)';
        btn.setAttribute('title', 'Copied!');
        setTimeout(function () {
            if (svg) svg.style.color = '';
            btn.setAttribute('title', 'Copy code');
        }, 1500);
    }

    /* ====================================================
       RESET CODE
       Restores the code-content innerHTML that was saved
       on page load, so any loaded example is cleared.
    ==================================================== */
    function handleReset() {
        var codeContent = document.querySelector('.code-content');
        var infoEl      = document.querySelector('.code-container-header .info');
        var badgeSpan   = document.querySelector('.file-badge span');
        if (codeContent)  codeContent.innerHTML = defaultCodeHTML;
        if (infoEl)       infoEl.textContent    = defaultInfoText;
        if (badgeSpan)    badgeSpan.innerHTML   = defaultBadgeHTML;
        AnimCtrl.hide();
        if (window.lucide) lucide.createIcons();
    }

    /* ====================================================
       FULLSCREEN
       Toggles browser fullscreen; icon swaps between
       maximize (enter) and minimize (exit).
    ==================================================== */
    function handleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(function () {});
        } else {
            document.exitFullscreen();
        }
    }

    function syncFullscreenIcon() {
        var btn = document.querySelector(
            '.icon-btn[title="Fullscreen"], .icon-btn[title="Exit Fullscreen"]'
        );
        if (!btn) return;
        if (document.fullscreenElement) {
            btn.setAttribute('title', 'Exit Fullscreen');
            btn.innerHTML = '<svg data-lucide="minimize"></svg>';
        } else {
            btn.setAttribute('title', 'Fullscreen');
            btn.innerHTML = '<svg data-lucide="maximize"></svg>';
        }
        if (window.lucide) lucide.createIcons();
    }

    /* ====================================================
       RESIZER DRAG  (20% – 30% of editor-container)
       Text selection is disabled for the entire drag.
    ==================================================== */
    function onResizerDown(e) {
        e.preventDefault();
        isDragging  = true;
        startX      = e.clientX;
        startWidth  = codePanel.getBoundingClientRect().width;
        containerW  = container.getBoundingClientRect().width;

        resizer.classList.add('dragging');
        document.documentElement.style.userSelect    = 'none';
        document.documentElement.style.cursor        = 'col-resize';

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup',   onMouseUp);
    }

    function onMouseMove(e) {
        if (!isDragging) return;
        var newPx  = startWidth + (e.clientX - startX);
        var newPct = (newPx / containerW) * 100;
        newPct = Math.max(MIN_PCT, Math.min(MAX_PCT, newPct));
        codePanel.style.width = newPct + '%';
    }

    function onMouseUp() {
        if (!isDragging) return;
        isDragging = false;

        resizer.classList.remove('dragging');
        document.documentElement.style.userSelect = '';
        document.documentElement.style.cursor     = '';

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup',   onMouseUp);
    }

    /* ---- Init ---- */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
