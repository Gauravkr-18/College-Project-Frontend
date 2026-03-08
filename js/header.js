document.addEventListener('DOMContentLoaded', function() {

    var dropdownWrappers = document.querySelectorAll('.nav-dropdown-wrapper');

    dropdownWrappers.forEach(function(wrapper) {
        var button = wrapper.querySelector('.nav-button');
        var dropdownName = wrapper.getAttribute('data-dropdown');
        var dropdown = document.getElementById('dropdown-' + dropdownName);

        if (!button || !dropdown) return;

        // Toggle dropdown on button click
        button.addEventListener('click', function(e) {
            e.stopPropagation();

            var isOpen = wrapper.classList.contains('open');

            closeAllDropdowns();

            // If it was closed, open it
            if (!isOpen) {
                wrapper.classList.add('open');
                dropdown.classList.add('open');
                button.setAttribute('aria-expanded', 'true');
            }
        });
    });

    document.addEventListener('click', function(e) {
        if (!e.target.closest('.nav-dropdown-wrapper')) {
            closeAllDropdowns();
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAllDropdowns();
        }
    });

    function closeAllDropdowns() {
        var allWrappers = document.querySelectorAll('.nav-dropdown-wrapper');
        allWrappers.forEach(function(wrapper) {
            wrapper.classList.remove('open');
            var dropdown = wrapper.querySelector('.dropdown');
            if (dropdown) dropdown.classList.remove('open');
            var button = wrapper.querySelector('.nav-button');
            if (button) button.setAttribute('aria-expanded', 'false');
        });
    }
});

(function () {
    var OPEN_PATH   = 'M3 11C3 11 6 4 12 4C18 4 21 11 21 11';
    var CLOSED_PATH = 'M3 11C3 11 6 11 12 11C18 11 21 11 21 11';
    function lidPath(t) {
        var y = (4 + (11 - 4) * t).toFixed(2);
        return 'M3 11C3 11 6 ' + y + ' 12 ' + y + 'C18 ' + y + ' 21 11 21 11';
    }

    function ease(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

    function animateBlink(lidEls, lashEls) {
        var CLOSE_MS = 90, OPEN_MS = 110;
        var start = null, phase = 'close';

        function frame(now) {
            if (!start) start = now;
            var t = Math.min((now - start) / (phase === 'close' ? CLOSE_MS : OPEN_MS), 1);
            var et = ease(t);
            var lidT = phase === 'close' ? et : 1 - et;

            lidEls.forEach(function (el) { el.setAttribute('d', lidPath(lidT)); });
            lashEls.forEach(function (el) { el.style.opacity = 1 - lidT; });

            if (t < 1) {
                requestAnimationFrame(frame);
            } else if (phase === 'close') {
                phase = 'open';
                start = now;
                requestAnimationFrame(frame);
            }
            // else: done — restore full opacity on lashes just in case
        }

        lashEls.forEach(function (el) { el.style.opacity = '1'; });
        requestAnimationFrame(frame);
    }

    function initEyes() {
        var lidEls  = Array.prototype.slice.call(document.querySelectorAll('.eye-lid-top'));
        var lashEls = Array.prototype.slice.call(document.querySelectorAll('.eye-lashes'));
        if (!lidEls.length) return;

        function scheduleBlink() {
            animateBlink(lidEls, lashEls);
            setTimeout(scheduleBlink, 3200 + Math.random() * 3800);
        }
        setTimeout(scheduleBlink, 1800 + Math.random() * 1500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initEyes);
    } else {
        initEyes();
    }
}());
