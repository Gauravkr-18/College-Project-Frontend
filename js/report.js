/* ============================================
   Report Issue — Auto-detect visualization state
   and submit report to backend.
   Dependencies: config.js, popup-core.js, animation-controller.js
   ============================================ */

(function () {
    'use strict';

    var overlay      = null;
    var modal        = null;
    var closeBtn     = null;
    var cancelBtn    = null;
    var submitBtn    = null;
    var textarea     = null;
    var charCount    = null;
    var categorySel  = null;

    // Auto-detect field elements
    var fieldLang    = null;
    var fieldExample = null;
    var fieldStep    = null;
    var fieldLine    = null;
    var fieldDS      = null;
    var fieldVisType = null;

    function init() {
        overlay      = document.getElementById('reportOverlay');
        closeBtn     = document.getElementById('reportCloseBtn');
        cancelBtn    = document.getElementById('reportCancelBtn');
        submitBtn    = document.getElementById('reportSubmitBtn');
        textarea     = document.getElementById('reportDescription');
        charCount    = document.getElementById('reportCharCount');
        categorySel  = document.getElementById('reportCategory');

        fieldLang    = document.getElementById('reportLang');
        fieldExample = document.getElementById('reportExample');
        fieldStep    = document.getElementById('reportStep');
        fieldLine    = document.getElementById('reportLine');
        fieldDS      = document.getElementById('reportDataSegment');
        fieldVisType = document.getElementById('reportVisType');

        if (!overlay) return;
        modal = overlay.querySelector('.report-modal');

        // Open button
        var openBtn = document.getElementById('ctrlReport');
        if (openBtn) {
            openBtn.addEventListener('click', openReport);
        }

        // Close handlers
        if (closeBtn) closeBtn.addEventListener('click', closeReport);
        if (cancelBtn) cancelBtn.addEventListener('click', closeReport);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeReport();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && overlay.classList.contains('open')) {
                closeReport();
            }
        });

        // Submit
        if (submitBtn) submitBtn.addEventListener('click', submitReport);

        // Char count
        if (textarea) {
            textarea.addEventListener('input', function () {
                if (charCount) charCount.textContent = textarea.value.length;
            });
        }
    }

    /* ---- Auto-detect current state ---- */
    function detectState() {
        var lang = window.__currentLang || '';
        var langLabel = '';
        if (window._P && window._P.LANG_MAP && window._P.LANG_MAP[lang]) {
            langLabel = window._P.LANG_MAP[lang].label;
        } else {
            langLabel = lang ? lang.toUpperCase() : '—';
        }

        var exampleTitle = '—';
        if (window.__currentExample && window.__currentExample.meta) {
            exampleTitle = window.__currentExample.meta.title || '—';
        }

        var currentStep = '—';
        var totalSteps  = '—';
        var currentLine = '—';
        var stepEl = document.getElementById('capsuleStep');
        var totalEl = document.getElementById('capsuleTotal');
        if (stepEl) currentStep = stepEl.textContent || '0';
        if (totalEl) totalSteps = totalEl.textContent || '0';

        // Get highlighted line number
        var activeLine = document.querySelector('.code-content .code-line.active');
        if (activeLine) {
            var allLines = document.querySelectorAll('.code-content .code-line');
            for (var i = 0; i < allLines.length; i++) {
                if (allLines[i] === activeLine) {
                    currentLine = String(i + 1);
                    break;
                }
            }
        }

        // Data segment status
        var dsColumn = document.getElementById('visDataSegment');
        var hasDS = dsColumn && dsColumn.classList.contains('active');
        var dsStatus = hasDS ? 'Active' : 'None';

        // Visualization type
        var visType = window.__currentType || 'stack';
        var visLabel = visType === 'ds' ? 'Data Structure' : 'Stack Memory';

        // Populate fields
        if (fieldLang) fieldLang.textContent = langLabel || '—';
        if (fieldExample) fieldExample.textContent = exampleTitle;
        if (fieldStep) fieldStep.textContent = currentStep + ' / ' + totalSteps;
        if (fieldLine) fieldLine.textContent = currentLine;
        if (fieldDS) fieldDS.textContent = dsStatus;
        if (fieldVisType) fieldVisType.textContent = visLabel;
    }

    /* ---- Open / Close ---- */
    function openReport() {
        if (!overlay) return;
        resetForm();
        detectState();
        overlay.classList.add('open');
        if (window.lucide) lucide.createIcons({ rootElement: overlay });
    }

    function closeReport() {
        if (!overlay) return;
        overlay.classList.remove('open');
    }

    function resetForm() {
        // Restore form body if it was replaced by success message
        var body = overlay.querySelector('.report-body');
        var footer = overlay.querySelector('.report-footer');
        if (body) body.style.display = '';
        if (footer) footer.style.display = '';

        var successMsg = overlay.querySelector('.report-success-msg');
        if (successMsg) successMsg.remove();

        if (textarea) { textarea.value = ''; }
        if (charCount) charCount.textContent = '0';
        if (categorySel) categorySel.selectedIndex = 0;
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<svg data-lucide="send"></svg> Submit Report'; }
    }

    /* ---- Submit ---- */
    async function submitReport() {
        if (!submitBtn || submitBtn.disabled) return;

        var description = textarea ? textarea.value.trim() : '';
        if (!description) {
            textarea.focus();
            textarea.style.borderColor = 'var(--accent-red)';
            setTimeout(function () { textarea.style.borderColor = ''; }, 2000);
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        var payload = {
            language: fieldLang ? fieldLang.textContent : '',
            exampleTitle: fieldExample ? fieldExample.textContent : '',
            step: fieldStep ? fieldStep.textContent : '',
            line: fieldLine ? fieldLine.textContent : '',
            dataSegment: fieldDS ? fieldDS.textContent : '',
            visType: fieldVisType ? fieldVisType.textContent : '',
            category: categorySel ? categorySel.value : 'other',
            description: description
        };

        try {
            var token = localStorage.getItem('codelens-token');
            var headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = 'Bearer ' + token;

            var res = await fetch(API_URL + '/reports', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload)
            });

            var data = await res.json();

            if (data.success) {
                showSuccess();
            } else {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<svg data-lucide="send"></svg> Submit Report';
                if (window.lucide) lucide.createIcons({ rootElement: submitBtn });
            }
        } catch (err) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<svg data-lucide="send"></svg> Submit Report';
            if (window.lucide) lucide.createIcons({ rootElement: submitBtn });
        }
    }

    function showSuccess() {
        var body = overlay.querySelector('.report-body');
        var footer = overlay.querySelector('.report-footer');
        if (body) body.style.display = 'none';
        if (footer) footer.style.display = 'none';

        var msg = document.createElement('div');
        msg.className = 'report-success-msg';
        msg.innerHTML = '<div class="report-success-icon"><svg data-lucide="check-circle-2"></svg></div>'
            + '<h3>Report Submitted</h3>'
            + '<p>Thank you! We\'ll review your report and fix the issue.</p>';

        modal.insertBefore(msg, footer);
        if (window.lucide) lucide.createIcons({ rootElement: msg });

        setTimeout(closeReport, 2500);
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
