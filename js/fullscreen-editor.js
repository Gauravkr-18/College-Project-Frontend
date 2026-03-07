/* ============================================
   Full-Screen Editor — Controller
   Opens as a modal popup with code viewer,
   terminal, and execution controls.

   Features:
     - Sync code from main editor on open
     - Simulated compile + run terminal output
     - Copy code to clipboard
     - Browse examples integration

   Dependencies: config.js (escapeHtml)
   ============================================ */
window.FullScreenEditor = (function () {
    'use strict';

    function $(sel) { return document.querySelector(sel); }

    var overlay       = null;
    var codeArea      = null;
    var fileBadgeText = null;
    var terminalEl    = null;
    var terminalBody  = null;
    var runBtn        = null;
    var statusLang    = null;
    var statusLines   = null;
    var isRunning     = false;
    var isOpen        = false;
    var terminalState = 'minimized'; // minimized | open | expanded

    // Uses global escapeHtml() from config.js

    /* ---- open / close ---- */
    function open() {
        if (isOpen) return;
        overlay = document.getElementById('fseOverlay');
        if (!overlay) return;

        syncFromEditor();
        isOpen = true;
        document.body.style.overflow = 'hidden';
        document.body.classList.add('fse-open');
        overlay.classList.add('open');
        cacheEls();
        resetTerminal();
        if (window.lucide) lucide.createIcons({ rootElement: overlay });
    }

    function close() {
        if (!isOpen) return;
        isOpen = false;
        document.body.style.overflow = '';
        document.body.classList.remove('fse-open');
        if (overlay) overlay.classList.remove('open');
    }

    function cacheEls() {
        codeArea      = $('#fseCodeArea');
        fileBadgeText = $('#fseFileBadgeText');
        terminalEl    = $('#fseTerminal');
        terminalBody  = $('#fseTerminalBody');
        runBtn        = $('#fseBtnRun');
        statusLang    = $('#fseStatusLang');
        statusLines   = $('#fseStatusLines');
    }

    /* ---- Sync code from main editor into FSE ---- */
    function syncFromEditor() {
        var mainCode = document.querySelector('.code-content');
        codeArea = document.getElementById('fseCodeArea');
        if (!codeArea || !mainCode) return;
        codeArea.innerHTML = mainCode.innerHTML;
        // Strip animation-controller active-line highlights — FSE shows static code only
        codeArea.querySelectorAll('.code-line.active').forEach(function (l) {
            l.classList.remove('active');
        });

        // Sync file badge
        var mainBadge = document.querySelector('.file-badge span');
        var fseBadge  = document.getElementById('fseFileBadgeText');
        if (mainBadge && fseBadge) {
            fseBadge.innerHTML = mainBadge.innerHTML;
        }

        // Sync status bar
        var mainInfo = document.querySelector('.code-container-header .info');
        var lang = 'C';
        var lines = '0';
        if (mainInfo) {
            var parts = mainInfo.textContent.split('·');
            if (parts.length >= 2) {
                lang  = parts[0].trim();
                lines = parts[1].trim();
            }
        }
        var sl = document.getElementById('fseStatusLang');
        var sli = document.getElementById('fseStatusLines');
        if (sl)  sl.textContent = lang.toUpperCase();
        if (sli) sli.textContent = lines;
    }

    /* ---- Copy code ---- */
    function handleCopy() {
        var spans = codeArea ? codeArea.querySelectorAll('.code-text') : [];
        var text = Array.prototype.map.call(spans, function (s) { return s.textContent; }).join('\n');

        var btn = document.getElementById('fseBtnCopy');
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(function () { showCopied(btn); });
        } else {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;opacity:0;left:-9999px;';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showCopied(btn);
        }
    }

    function showCopied(btn) {
        if (!btn) return;
        btn.classList.add('copied');
        var span = btn.querySelector('span');
        var old = span ? span.textContent : '';
        if (span) span.textContent = 'Copied!';
        setTimeout(function () {
            btn.classList.remove('copied');
            if (span) span.textContent = old;
        }, 1500);
    }

    /* ---- Terminal ---- */
    function resetTerminal() {
        terminalState = 'minimized';
        if (terminalEl) {
            terminalEl.classList.remove('open', 'expanded');
        }
        if (terminalBody) terminalBody.innerHTML = '<span class="fse-terminal-empty">Click "Run" to execute code</span>';
        var indicator = document.getElementById('fseTerminalRunning');
        if (indicator) indicator.classList.remove('active');
    }

    function toggleTerminal() {
        if (!terminalEl) return;
        if (terminalState === 'minimized') {
            terminalState = 'open';
            terminalEl.classList.add('open');
            terminalEl.classList.remove('expanded');
        } else {
            terminalState = 'minimized';
            terminalEl.classList.remove('open', 'expanded');
        }
    }

    function toggleExpand() {
        if (!terminalEl) return;
        if (terminalState === 'minimized') {
            terminalState = 'expanded';
            terminalEl.classList.add('open', 'expanded');
        } else if (terminalState === 'open') {
            terminalState = 'expanded';
            terminalEl.classList.add('expanded');
        } else {
            terminalState = 'open';
            terminalEl.classList.remove('expanded');
        }
    }

    function clearTerminal() {
        if (terminalBody) terminalBody.innerHTML = '<span class="fse-terminal-empty">Click "Run" to execute code</span>';
    }

    function appendTerminalLine(type, text) {
        if (!terminalBody) return;
        // Clear empty message if present
        var empty = terminalBody.querySelector('.fse-terminal-empty');
        if (empty) empty.remove();

        var div = document.createElement('div');
        div.className = 'fse-terminal-line fse-terminal-line--' + type;
        div.textContent = text;
        terminalBody.appendChild(div);
        terminalBody.scrollTop = terminalBody.scrollHeight;
    }

    /* ---- Run ---- */
    function handleRun() {
        if (isRunning) return;
        isRunning = true;

        if (runBtn) runBtn.classList.add('running');
        var indicator = document.getElementById('fseTerminalRunning');
        if (indicator) indicator.classList.add('active');

        // Auto-open terminal
        if (terminalState === 'minimized' && terminalEl) {
            terminalState = 'open';
            terminalEl.classList.add('open');
        }

        // Clear previous output
        if (terminalBody) terminalBody.innerHTML = '';

        var fileName = 'main.c';
        var badge = document.getElementById('fseFileBadgeText');
        if (badge) fileName = badge.textContent || 'main.c';

        var ts = new Date().toLocaleTimeString();

        // Phase 1: Compiling
        setTimeout(function () {
            appendTerminalLine('compile', '[' + ts + '] Compiling ' + fileName + '...');
        }, 300);

        // Phase 2: Build success
        setTimeout(function () {
            var t = new Date().toLocaleTimeString();
            appendTerminalLine('compile', '[' + t + '] Build successful!');
            appendTerminalLine('info', '');
        }, 700);

        // Phase 3: Running
        setTimeout(function () {
            appendTerminalLine('run', '> Running program...');
            appendTerminalLine('info', '');
        }, 1000);

        // Phase 4: Output
        setTimeout(function () {
            var t = new Date().toLocaleTimeString();
            var output = 'Hello, Welcome to Code Lens!';

            // Get actual output from loaded example
            var ex = window.__currentExample;
            if (ex) {
                if (ex.meta && ex.meta.final_output) {
                    output = ex.meta.final_output;
                } else if (ex.finalOutput) {
                    output = ex.finalOutput;
                }
            }

            appendTerminalLine('output', output);
            appendTerminalLine('info', '');
            appendTerminalLine('success', '[' + t + '] Process exited with code 0');

            isRunning = false;
            if (runBtn) runBtn.classList.remove('running');
            if (indicator) indicator.classList.remove('active');
        }, 1500);
    }

    /* ---- Visualize (close FSE, let main editor take over) ---- */
    function handleVisualize() {
        close();
    }

    /* ---- Examples ---- */
    function handleExamples() {
        // Open browse examples popup; FSE stays open behind it
        if (window._P && typeof window._P.openBrowseExamples === 'function') {
            window._P.openBrowseExamples();
        } else {
            var popup = document.getElementById('browseExamplesPopup');
            if (popup) popup.classList.add('active');
        }
    }

    /* ---- Re-sync when example loaded while FSE is open ---- */
    function refresh() {
        if (!isOpen) return;
        syncFromEditor();
        resetTerminal();
        if (window.lucide) lucide.createIcons({ rootElement: overlay });
    }

    /* ---- Init: bind events ---- */
    function init() {
        overlay = document.getElementById('fseOverlay');
        if (!overlay) return;

        cacheEls();

        // Close button & red dot
        var closeBtn = document.getElementById('fseCloseBtn');
        var redDot   = document.getElementById('fseDotRed');
        if (closeBtn) closeBtn.addEventListener('click', close);
        if (redDot)   redDot.addEventListener('click', close);

        // Overlay click to close
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) close();
        });

        // Escape key
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && isOpen) {
                // Don't close if browse examples is open
                var browsePopup = document.getElementById('browseExamplesPopup');
                if (browsePopup && browsePopup.classList.contains('active')) return;
                close();
            }
        });

        // Tool buttons
        var copyBtn = document.getElementById('fseBtnCopy');
        if (copyBtn) copyBtn.addEventListener('click', handleCopy);

        var examplesBtn = document.getElementById('fseBtnExamples');
        if (examplesBtn) examplesBtn.addEventListener('click', handleExamples);

        var visualizeBtn = document.getElementById('fseBtnVisualize');
        if (visualizeBtn) visualizeBtn.addEventListener('click', handleVisualize);

        var runBtnEl = document.getElementById('fseBtnRun');
        if (runBtnEl) runBtnEl.addEventListener('click', handleRun);

        // Terminal controls
        var termHeader = document.getElementById('fseTerminalHeader');
        if (termHeader) termHeader.addEventListener('click', toggleTerminal);

        var termClear = document.getElementById('fseTerminalClear');
        if (termClear) termClear.addEventListener('click', function (e) {
            e.stopPropagation();
            clearTerminal();
        });

        var termExpand = document.getElementById('fseTerminalExpand');
        if (termExpand) termExpand.addEventListener('click', function (e) {
            e.stopPropagation();
            toggleExpand();
        });

        // Expand button in main editor header
        var expandBtn = document.querySelector('.code-viewer-header-right .action-btn[title="Expand"]');
        if (expandBtn) {
            expandBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                open();
            });
        }
    }

    /* ---- Boot ---- */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return {
        open: open,
        close: close,
        refresh: refresh
    };
})();
