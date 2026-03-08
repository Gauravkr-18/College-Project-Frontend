var BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : 'https://codelens-backend-b3fg.onrender.com';

var API_URL = BACKEND_URL + '/api';
var AVATAR_BASE_URL = BACKEND_URL + '/avatars/';

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
    if (/^[1-5]$/.test(avatar)) {
        return AVATAR_BASE_URL + avatar + '.png';
    }
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
                avatarEl.appendChild(img);
            }
            img.src = avatarUrl;
            img.alt = user.name;
            img.style.objectFit = 'contain';
            img.style.padding = '2px';
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
