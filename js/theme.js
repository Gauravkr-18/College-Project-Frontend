function getTheme() {
    return localStorage.getItem('codelens-theme') || 'dark';
}

// Apply theme to document
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);

    var toggleBtn = document.getElementById('themeToggle');
    if (toggleBtn) {
        var svg = toggleBtn.querySelector('svg');
        if (svg) {
            // Change the lucide icon attribute
            if (theme === 'dark') {
                svg.setAttribute('data-lucide', 'moon');
            } else {
                svg.setAttribute('data-lucide', 'sun');
            }
            if (window.lucide) {
                lucide.createIcons();
            }
        }
    }
}

// Toggle between dark and light
function toggleTheme() {
    var current = getTheme();
    var next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('codelens-theme', next);
    applyTheme(next);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    var savedTheme = getTheme();
    applyTheme(savedTheme);

    var toggleBtn = document.getElementById('themeToggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleTheme);
    }

    setTimeout(function() {
        if (window.lucide) {
            lucide.createIcons();
        }
    }, 100);
});
