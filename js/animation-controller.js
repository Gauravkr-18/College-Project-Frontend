/* ============================================
   Animation Controller — Step-through player
   Exposed globally as window.AnimationController
   Called by popup-core.js after any example loads.

   Responsibilities:
     - Play / pause / step-forward / step-backward
     - Speed control (0.5× – 2.0×)
     - Progress slider with step-bar markers
     - Code line highlighting synced to current step
     - Delegates rendering to VisualizationEngine/DSEngine
   ============================================ */
window.AnimationController = (function () {
    'use strict';

    var steps       = [];
    var totalSteps  = 0;
    var currentStep = 0;
    var isPlaying   = false;
    var playTimer   = null;
    var SPEEDS      = [0.5, 1.0, 1.5, 2.0];
    var speedIdx    = 1;
    var markers     = [];
    var hasDataSegment = false;  // tracks if any step has data_segment_update
    var isDSExample    = false;  // tracks if loaded example is DS type

    function $id(id) { return document.getElementById(id); }

    /* Show / hide the controller bar */
    function show() {
        var el = document.querySelector('.animation-controller');
        if (el) {
            el.classList.add('active');
            if (window.lucide) lucide.createIcons({ rootElement: el });
        }
        var capsule = $id('stepInfoCapsule');
        if (capsule) capsule.classList.add('active');
        /* visArea visibility is controlled by renderStep, not show() */
        // Hide placeholder when visualizing
        if (isDSExample) {
            var phDS = document.querySelector('.vis-placeholder--ds');
            if (phDS) phDS.style.display = 'none';
            // Auto-switch to DS tab
            if (window.VisualizerPanel) window.VisualizerPanel.setActiveTab('ds');
        } else {
            var phStack = document.querySelector('.vis-placeholder--stack');
            if (phStack) phStack.style.display = 'none';
        }
    }

    function hide() {
        clearTimer();
        isPlaying = false;
        closeSpeedDropdown();
        var el = document.querySelector('.animation-controller');
        if (el) el.classList.remove('active');
        document.querySelectorAll('.code-content .code-line')
            .forEach(function (l) { l.classList.remove('active'); });
        var capsule = $id('stepInfoCapsule');
        if (capsule) capsule.classList.remove('active');
        var visArea = $id('visArea');
        if (visArea) visArea.classList.remove('active');
        var dsVisArea = $id('dsVisArea');
        if (dsVisArea) dsVisArea.classList.remove('active');
        var dsTermWin = $id('dsTerminalWindow');
        if (dsTermWin) dsTermWin.classList.remove('active');
        var dsCol = $id('visDataSegment');
        if (dsCol) dsCol.classList.remove('active');
        var endOverlay = $id('visEndOverlay');
        if (endOverlay) endOverlay.classList.remove('active');
        hasDataSegment = false;
        // Restore placeholders
        var phStack = document.querySelector('.vis-placeholder--stack');
        if (phStack) phStack.style.display = '';
        var phDS = document.querySelector('.vis-placeholder--ds');
        if (phDS) phDS.style.display = '';
        /* Clear visualization */
        if (isDSExample) {
            if (window.DSEngine) window.DSEngine.reset();
            if (window.DSRenderer) window.DSRenderer.clear();
        } else {
            if (window.VisualizationEngine) window.VisualizationEngine.reset();
            if (window.VisualizationRenderer) window.VisualizationRenderer.clear();
        }
        isDSExample = false;
    }

    /* Synthetic steps when execution_steps absent */
    function makeSyntheticSteps(code, total) {
        var lines  = (code || '').split('\n');
        var lc     = lines.length;
        var result = [];
        for (var i = 0; i < total; i++) {
            var li = Math.round((i / Math.max(total - 1, 1)) * (lc - 1));
            result.push({
                step: i + 1,
                line: li + 1,
                description: 'Step ' + (i + 1) + ' of ' + total
            });
        }
        return result;
    }

    /* Load an example object */
    function load(example) {
        var m        = example.meta || {};
        var rawSteps = example.execution_steps;
        steps        = (rawSteps && rawSteps.length) ? rawSteps
                     : makeSyntheticSteps(m.code || '', m.total_steps || 1);
        totalSteps   = steps.length;
        currentStep  = 0;
        isPlaying    = false;
        hasDataSegment = false;
        isDSExample    = false;
        clearTimer();
        // Pre-scan: check if any step has data_segment_update or ds_update
        steps.forEach(function (s) {
            if (s.data_segment_update) hasDataSegment = true;
            if (s.ds_update) isDSExample = true;
        });
        // Extract step_bar_markers
        markers = [];
        steps.forEach(function (s, i) {
            var m = s.step_bar_marker;
            if (!m || !m.show_on_step_bar) return;
            var dup = markers.some(function (x) { return x.stepIdx === i; });
            if (!dup) markers.push({ stepIdx: i, label: m.label || '', type: m.type || '' });
        });
        markers.sort(function (a, b) { return a.stepIdx - b.stepIdx; });
        updatePlayIcon(false);
        updateSpeedLabel();
        /* Initialize visualization engine */
        if (isDSExample) {
            if (window.DSEngine) window.DSEngine.reset();
            if (window.DSRenderer) window.DSRenderer.init();
        } else {
            if (window.VisualizationEngine) window.VisualizationEngine.reset();
            if (window.VisualizationRenderer) window.VisualizationRenderer.init();
        }
        renderStep(0);
        show();
        renderMarkers();
    }

    /* Slider position helpers */
    function sliderPercent(idx) {
        if (totalSteps <= 0) return 0;
        return (idx / totalSteps) * 100;
    }

    function updateSlider(idx) {
        var pct    = sliderPercent(idx);
        var fill   = $id('sliderFill');
        var thumb  = $id('sliderThumb');
        var slider = $id('stepSlider');
        if (fill)   fill.style.width = pct + '%';
        if (thumb)  thumb.style.left  = pct + '%';
        if (slider) {
            slider.max   = totalSteps;
            slider.value = idx;
        }
    }

    /* Update the description capsule */
    function updateCapsule(step, total, desc) {
        var stepEl = $id('capsuleStep');
        var totEl  = $id('capsuleTotal');
        var descEl = $id('capsuleDesc');
        if (stepEl) stepEl.textContent = step;
        if (totEl)  totEl.textContent  = total;
        if (descEl) descEl.textContent = desc || 'Ready to start';
    }

    /* Render step idx (0 = ready-to-start, 1..N = actual steps) */
    function renderStep(idx) {
        if (idx < 0)            idx = 0;
        if (idx > totalSteps)   idx = totalSteps;
        currentStep = idx;

        var lines   = document.querySelectorAll('.code-content .code-line');
        var cur      = $id('stepCurrent');
        var tot      = $id('stepTotal');
        var prevBtn  = $id('ctrlPrev');
        var nextBtn  = $id('ctrlNext');
        var dsCol    = $id('visDataSegment');
        var visArea  = $id('visArea');
        var dsVisEl  = $id('dsVisArea');
        var dsTermEl = $id('dsTerminalWindow');

        /* Toggle visualization area: show from step 1 onwards (including last step) */
        if (isDSExample) {
            if (dsVisEl) {
                if (idx >= 1) { dsVisEl.classList.add('active'); }
                else          { dsVisEl.classList.remove('active'); }
            }
        } else {
            if (visArea) {
                if (idx >= 1) { visArea.classList.add('active'); }
                else          { visArea.classList.remove('active'); }
            }
        }

        /* Toggle data segment column visibility */
        if (dsCol) {
            if (hasDataSegment) {
                dsCol.classList.add('active');
            } else {
                dsCol.classList.remove('active');
            }
        }

        /* End overlay: show only when all steps complete */
        var endOverlay = $id('visEndOverlay');
        if (endOverlay) {
            if (idx === totalSteps && totalSteps > 0) {
                endOverlay.classList.add('active');
                var countEl = $id('visEndStepsCount');
                if (countEl) countEl.textContent = totalSteps;
                if (window.lucide) lucide.createIcons({ rootElement: endOverlay });
            } else {
                endOverlay.classList.remove('active');
            }
        }

        if (idx === 0) {
            /* Step 0: clear all highlights, show ready state */
            lines.forEach(function (l) { l.classList.remove('active'); });
            if (cur) cur.textContent = 0;
            if (tot) tot.textContent = totalSteps;
            updateCapsule(0, totalSteps, 'Ready to start');
            updateSlider(0);
            updateMarkers(0);
            if (prevBtn) prevBtn.disabled = true;
            if (nextBtn) nextBtn.disabled = (totalSteps === 0);
            /* Clear visualization */
            if (isDSExample) {
                if (window.DSRenderer) window.DSRenderer.clear();
            } else {
                if (window.VisualizationRenderer) window.VisualizationRenderer.clear();
            }
            return;
        }

        /* Step 1..N: render steps[idx - 1] */
        var s       = steps[idx - 1] || {};
        var lineNum = s.line || 1;

        /* Highlight target line */
        lines.forEach(function (l) { l.classList.remove('active'); });
        var target = lines[lineNum - 1];
        if (target) {
            target.classList.add('active');
            target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }

        /* Update counter */
        if (cur) cur.textContent = idx;
        if (tot) tot.textContent = totalSteps;

        /* Update capsule */
        updateCapsule(idx, totalSteps, s.description || '');

        /* Update slider */
        updateSlider(idx);

        /* Update markers */
        updateMarkers(idx);

        /* Button disabled states */
        if (prevBtn) prevBtn.disabled = false;
        if (nextBtn) nextBtn.disabled = (idx >= totalSteps);

        /* ---- Run Visualization Engine & Render ---- */
        if (isDSExample) {
            if (window.DSEngine && window.DSRenderer) {
                var dsState = window.DSEngine.executeUpTo(steps, idx);
                window.DSRenderer.render(dsState);
                /* Show/hide DS terminal window */
                if (dsTermEl) {
                    if (dsState.terminalOutput && dsState.terminalOutput.length) {
                        dsTermEl.classList.add('active');
                    } else {
                        dsTermEl.classList.remove('active');
                    }
                }
            }
        } else if (window.VisualizationEngine && window.VisualizationRenderer) {
            var visState = window.VisualizationEngine.executeUpTo(steps, idx);
            window.VisualizationRenderer.render(visState);
        }
    }

    /* Timer helpers */
    function intervalMs() { return Math.round(1000 / SPEEDS[speedIdx]); }

    function clearTimer() {
        if (playTimer) { clearInterval(playTimer); playTimer = null; }
    }

    function timerTick() {
        if (currentStep < totalSteps) {
            renderStep(currentStep + 1);
        } else {
            stopPlay();
        }
    }

    function startPlay() {
        if (currentStep >= totalSteps) renderStep(0);
        isPlaying = true;
        updatePlayIcon(true);
        clearTimer();
        playTimer = setInterval(timerTick, intervalMs());
    }

    function stopPlay() {
        clearTimer();
        isPlaying = false;
        updatePlayIcon(false);
    }

    function togglePlay() {
        if (isPlaying) { stopPlay(); } else { startPlay(); }
    }

    function resetAnim() {
        stopPlay();
        renderStep(0);
    }

    /* Step bar markers */
    function renderMarkers() {
        var wrapper = document.querySelector('.step-slider-wrapper');
        if (!wrapper) return;
        wrapper.querySelectorAll('.slider-marker').forEach(function (el) { el.remove(); });
        markers.forEach(function (m) {
            /* stepIdx is 0-based in steps[]; maps to currentStep = stepIdx + 1 */
            var leftPct = totalSteps > 0 ? ((m.stepIdx + 1) / totalSteps) * 100 : 0;
            var btn = document.createElement('button');
            btn.type = 'button';
            var typeClass = m.type === 'section_start' ? 'marker-section' : 'marker-checkpoint';
            btn.className = 'slider-marker ' + typeClass;
            btn.title = m.label + ' (Step ' + (m.stepIdx + 1) + ')';
            btn.setAttribute('aria-label', m.label + ' step ' + (m.stepIdx + 1));
            btn.setAttribute('data-marker-idx', m.stepIdx + 1);
            btn.style.left = leftPct + '%';
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                renderStep(parseInt(btn.getAttribute('data-marker-idx'), 10));
            });
            wrapper.appendChild(btn);
        });
    }

    function updateMarkers(idx) {
        document.querySelectorAll('.slider-marker').forEach(function (btn) {
            var anchor = parseInt(btn.getAttribute('data-marker-idx'), 10);
            btn.classList.toggle('active', anchor === idx);
            btn.classList.toggle('passed', anchor < idx);
        });
    }

    /* Speed dropdown */
    function toggleSpeedDropdown() {
        var dd = $id('speedDropdown');
        if (!dd) return;
        if (dd.classList.contains('open')) {
            dd.classList.remove('open');
        } else {
            dd.classList.add('open');
        }
    }

    function closeSpeedDropdown() {
        var dd = $id('speedDropdown');
        if (dd) dd.classList.remove('open');
    }

    function selectSpeed(val) {
        var v = parseFloat(val);
        var idx = SPEEDS.indexOf(v);
        if (idx !== -1) speedIdx = idx;
        updateSpeedLabel();
        closeSpeedDropdown();
        if (isPlaying) {
            clearTimer();
            playTimer = setInterval(timerTick, intervalMs());
        }
    }

    /* Icon + label helpers */
    function updatePlayIcon(playing) {
        var btn = $id('ctrlPlay');
        if (!btn) return;
        btn.innerHTML = playing
            ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>';
    }

    function updateSpeedLabel() {
        var lbl = $id('speedLabel');
        if (lbl) lbl.textContent = SPEEDS[speedIdx].toFixed(1) + 'x';
        document.querySelectorAll('.speed-option').forEach(function (btn) {
            var v = parseFloat(btn.getAttribute('data-speed'));
            btn.classList.toggle('active', v === SPEEDS[speedIdx]);
        });
    }

    /* Bind controller buttons */
    function init() {
        var prevBtn  = $id('ctrlPrev');
        var nextBtn  = $id('ctrlNext');
        var playBtn  = $id('ctrlPlay');
        var resetBtn = $id('ctrlAnimReset');
        var speedBtn = $id('ctrlSpeed');
        var slider   = $id('stepSlider');

        if (prevBtn)  prevBtn.addEventListener('click',  function () { renderStep(currentStep - 1); });
        if (nextBtn)  nextBtn.addEventListener('click',  function () { renderStep(currentStep + 1); });
        if (playBtn)  playBtn.addEventListener('click',  togglePlay);
        if (resetBtn) resetBtn.addEventListener('click', resetAnim);
        if (speedBtn) speedBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            toggleSpeedDropdown();
        });

        if (slider) {
            slider.addEventListener('input', function () {
                renderStep(parseInt(this.value, 10));
            });
            slider.addEventListener('mousedown', function () {
                if (isPlaying) { clearTimer(); }
            });
            slider.addEventListener('mouseup', function () {
                if (isPlaying) {
                    clearTimer();
                    playTimer = setInterval(timerTick, intervalMs());
                }
            });
        }

        document.querySelectorAll('.speed-option').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                selectSpeed(btn.getAttribute('data-speed'));
            });
        });

        document.addEventListener('click', function () {
            closeSpeedDropdown();
        });

        /* Wire end overlay buttons */
        var nextExBtn = $id('visNextExampleBtn');
        var browseBtn = $id('visBrowseBtn');
        if (nextExBtn) {
            nextExBtn.addEventListener('click', function () {
                if (window._P && typeof window._P.loadNextExample === 'function') {
                    window._P.loadNextExample();
                } else if (window._P && typeof window._P.openBrowseExamples === 'function') {
                    window._P.openBrowseExamples();
                }
            });
        }
        if (browseBtn) {
            browseBtn.addEventListener('click', function () {
                if (window._P && typeof window._P.openBrowseExamples === 'function') {
                    window._P.openBrowseExamples();
                }
            });
        }
    }

    return { init: init, load: load, hide: hide };
})();
