// ─── BACKEND URLS ───────────────────────────────────────────────────────────
// Render  : primary backend — free tier goes to sleep after inactivity
// Railway : fast-wake fallback — used while Render is warming up
// NOTE: RAILWAY_URL must be the PUBLIC URL (e.g. https://xxxx.up.railway.app)
//       The .railway.internal address only works inside Railway's network.
var RENDER_URL  = 'https://codelens-backend-b3fg.onrender.com';
var RAILWAY_URL = 'https://college-project-backend.up.railway.app'; // ← replace with your Railway public URL
var IS_LOCAL    = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

var BACKEND_URL     = IS_LOCAL ? 'http://localhost:5000' : RENDER_URL;
var API_URL         = BACKEND_URL + '/api';
var AVATAR_BASE_URL = BACKEND_URL + '/avatars/';

// ─── DUAL-BACKEND STATE ──────────────────────────────────────────────────────
var _backend = {
    usingRailway: false,
    wakeInterval: null
};

function _setActiveBackend(url) {
    BACKEND_URL     = url;
    API_URL         = url + '/api';
    AVATAR_BASE_URL = url + '/avatars/';
    // Clear preset avatar cache so next open fetches from the newly active backend
    if (typeof _presetAvatarCache !== 'undefined') _presetAvatarCache = null;
}

function _switchToRailway() {
    if (_backend.usingRailway) return;
    _backend.usingRailway = true;
    _setActiveBackend(RAILWAY_URL);
    console.info('[CodeLens] Render sleeping — switched to Railway');
    // Poll Render every 30 s to detect when it wakes up, then switch back
    if (!_backend.wakeInterval) {
        _backend.wakeInterval = setInterval(function() {
            fetch(RENDER_URL + '/api/health')
                .then(function(r) { if (r.ok) _switchToRender(); })
                .catch(function() {});
        }, 30000);
    }
}

function _switchToRender() {
    if (!_backend.usingRailway) return;
    _backend.usingRailway = false;
    _setActiveBackend(RENDER_URL);
    console.info('[CodeLens] Render awake — switched back to Render');
    clearInterval(_backend.wakeInterval);
    _backend.wakeInterval = null;
}

// ─── SMART FETCH ─────────────────────────────────────────────────────────────
// Drop-in fetch() wrapper with automatic cross-backend retry on failure.
// Existing code keeps using fetch(API_URL + ...) and gets auto-routing via
// the global var updates. Use smartFetch() for extra mid-session resilience.
function smartFetch(url, options) {
    return fetch(url, options).catch(function() {
        var fallbackBase;
        var fallbackUrl;
        if (url.indexOf(RENDER_URL) !== -1) {
            fallbackBase = RAILWAY_URL;
            fallbackUrl  = url.replace(RENDER_URL, RAILWAY_URL);
            _switchToRailway();
        } else if (url.indexOf(RAILWAY_URL) !== -1) {
            fallbackBase = RENDER_URL;
            fallbackUrl  = url.replace(RAILWAY_URL, RENDER_URL);
            _switchToRender();
        } else {
            fallbackUrl = url; // local or unknown — retry as-is
        }
        console.info('[CodeLens] Request failed, retrying on fallback backend');
        return fetch(fallbackUrl, options);
    });
}

// ─── INIT: Probe Render on page load ─────────────────────────────────────────
// If Render responds within 4 s → use Render (normal path).
// If it times out → immediately switch to Railway, keep pinging Render until
// it wakes up, then switch back silently.
(function _initBackend() {
    if (IS_LOCAL) return;

    var TIMEOUT_MS = 4000;
    var controller = new AbortController();

    var timer = setTimeout(function() {
        controller.abort();
        _switchToRailway();
        // Fire-and-forget ping so Render starts its wake cycle
        fetch(RENDER_URL + '/api/health').catch(function() {});
    }, TIMEOUT_MS);

    fetch(RENDER_URL + '/api/health', { signal: controller.signal })
        .then(function(r) {
            clearTimeout(timer);
            if (r.ok) {
                console.info('[CodeLens] Render is awake — using Render');
            } else {
                _switchToRailway();
            }
        })
        .catch(function(err) {
            clearTimeout(timer);
            if (err.name !== 'AbortError') {
                // Hard failure (not our timeout) — Railway fallback
                _switchToRailway();
                fetch(RENDER_URL + '/api/health').catch(function() {});
            }
            // AbortError = already handled by the timer above
        });
}());

function getInitials(name) {
    if (!name) return '?';
    var parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
}

function getAvatarUrl(avatar) {
    if (!avatar) return '';
    // Legacy: numeric IDs "1"-"3" were Male, "4"-"5" were Female
    if (/^[1-3]$/.test(avatar)) return AVATAR_BASE_URL + 'Male/' + avatar + '.png';
    if (/^[4-5]$/.test(avatar)) return AVATAR_BASE_URL + 'Female/' + avatar + '.png';
    // New format: "Male/1.png", "Female/4.png", "uploads/xxx.png"
    return AVATAR_BASE_URL + avatar;
}

function formatDate(dateString) {
    if (!dateString) return '—';
    var date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

var _escapeEl = document.createElement('div');

function escapeHtml(text) {
    _escapeEl.textContent = text;
    return _escapeEl.innerHTML;
}

function truncateFileName(base) {
    if (!base) return base;
    return base.length <= 6 ? base : base.slice(0, 4) + '...';
}

// PROFILE DROPDOWN (shared across all pages)

function toggleProfileDropdown() {
    var dropdown = document.querySelector('.profile-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('open');
    }
}

function closeProfileDropdown() {
    var dropdown = document.querySelector('.profile-dropdown');
    if (dropdown) {
        dropdown.classList.remove('open');
    }
}

// LOGOUT (works on all pages)

function handleLogout() {
    localStorage.removeItem('codelens-token');
    localStorage.removeItem('codelens-user');

    // Admin page → redirect to home
    if (document.querySelector('.admin-page')) {
        window.location.href = 'index.html';
        return;
    }

    // Other pages → reset UI state
    if (typeof setLoggedOutState === 'function') {
        setLoggedOutState();
    }
    closeProfileDropdown();
}

// SHARED: Update header avatars (used by auth, admin, profile)

function updateHeaderAvatars(user) {
    var avatars = document.querySelectorAll('.profile-avatar');
    avatars.forEach(function(avatarEl) {
        if (user.avatar) {
            var avatarUrl = getAvatarUrl(user.avatar);
            var img = avatarEl.querySelector('img');
            if (!img) {
                img = document.createElement('img');
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                img.style.borderRadius = 'inherit';
            }
            img.src = avatarUrl;
            img.alt = user.name;
            avatarEl.textContent = '';
            avatarEl.appendChild(img);
            avatarEl.style.background = 'transparent';
        } else {
            var existingImg = avatarEl.querySelector('img');
            if (existingImg) existingImg.remove();
            avatarEl.textContent = getInitials(user.name);
            avatarEl.style.background = '';
        }
    });
}

function updateHeaderProfileInfo(user) {
    var names = document.querySelectorAll('.profile-name');
    names.forEach(function(el) { el.textContent = user.name; });

    var infoName = document.querySelectorAll('.profile-info-name');
    infoName.forEach(function(el) { el.textContent = user.name; });

    var infoEmail = document.querySelectorAll('.profile-info-email');
    infoEmail.forEach(function(el) { el.textContent = user.email; });
}

// MOBILE MENU TOGGLE (Editor page)

function toggleMobileMenu() {
    var navBar = document.querySelector('.nav-bar');
    var menuBtn = document.querySelector('.mobile-menu-btn');
    if (!navBar) return;

    var isOpen = navBar.classList.toggle('mobile-open');
    updateMobileMenuIcon(menuBtn, isOpen ? 'x' : 'menu');
}

function updateMobileMenuIcon(menuBtn, iconName) {
    if (!menuBtn) return;
    var svg = menuBtn.querySelector('svg');
    if (svg) {
        svg.setAttribute('data-lucide', iconName);
        if (window.lucide) lucide.createIcons();
    }
}
