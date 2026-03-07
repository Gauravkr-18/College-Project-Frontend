/* ============================================
   Admin Panel Logic
   Loads stats + users list for admin users
   ============================================ */

// API_URL is defined in config.js (loaded first)

// ---- State ----
var currentUser = null;
var pendingDeleteId = null;
var pendingDeleteName = null;

// ============================================
// AUTH CHECK + LOAD DATA
// ============================================

async function initAdmin() {
    var token = localStorage.getItem('codelens-token');

    // If no token, redirect to home immediately
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    // Always verify role server-side — never trust localStorage for access control
    try {
        var meResponse = await fetch(API_URL + '/auth/me', {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (!meResponse.ok) {
            // Token invalid or expired — clear stale data and redirect
            localStorage.removeItem('codelens-token');
            localStorage.removeItem('codelens-user');
            window.location.href = 'index.html';
            return;
        }

        var meData = await meResponse.json();
        if (!meData.success || !meData.user) {
            window.location.href = 'index.html';
            return;
        }

        // Use server-verified user data — not localStorage
        currentUser = meData.user;

        // Sync localStorage with fresh server data
        localStorage.setItem('codelens-user', JSON.stringify(currentUser));

    } catch (e) {
        // Network error — cannot verify role, block access
        window.location.href = 'index.html';
        return;
    }

    // Update header profile
    updateHeaderAvatars(currentUser);
    updateHeaderProfileInfo(currentUser);

    // Role check uses server-verified role
    if (currentUser.role !== 'admin' && currentUser.role !== 'tester') {
        // Show not authorized screen
        document.getElementById('notAuthorized').style.display = '';
        return;
    }

    // Show admin content
    document.getElementById('adminContent').style.display = '';

    // Show admin link in dropdown (for admin) or reports link (for tester)
    var adminLink = document.querySelector('.admin-only-link');
    if (adminLink) adminLink.style.display = currentUser.role === 'admin' ? '' : 'none';
    var testerLink = document.querySelector('.tester-only-link');
    if (testerLink) testerLink.style.display = currentUser.role === 'tester' ? '' : 'none';

    // If tester, hide dashboard tab and show only reports
    if (currentUser.role === 'tester') {
        var dashboardTab = document.querySelector('.admin-tab[data-admin-tab="dashboard"]');
        if (dashboardTab) dashboardTab.style.display = 'none';
        var reportsTab = document.querySelector('.admin-tab[data-admin-tab="reports"]');
        if (reportsTab) {
            reportsTab.classList.add('active');
        }
        var dashboardPane = document.querySelector('.admin-tab-pane[data-pane="dashboard"]');
        if (dashboardPane) dashboardPane.classList.remove('active');
        var reportsPane = document.querySelector('.admin-tab-pane[data-pane="reports"]');
        if (reportsPane) reportsPane.classList.add('active');

        // Load reports - admin-reports.js exposes these functions globally
        var tryLoadReports = function() {
            if (window.loadReportStats && typeof window.loadReportStats === 'function') {
                window.loadReportStats();
                window.loadReports(1);
            } else {
                // Retry if functions aren't ready yet
                setTimeout(tryLoadReports, 50);
            }
        };
        tryLoadReports();

        // Change nav bar text from "Admin Panel" to "Reports"
        var navBtns = document.querySelectorAll('.nav-button.active');
        navBtns.forEach(function(btn) {
            if (btn.textContent.trim().indexOf('Admin Panel') !== -1) {
                var icon = btn.querySelector('.nav-icon');
                btn.textContent = '';
                if (icon) {
                    icon.setAttribute('data-lucide', 'flag');
                    btn.appendChild(icon);
                }
                btn.appendChild(document.createTextNode('\n                Reports\n              '));
            }
        });

        // Update page title
        document.title = 'Reports - CodeLens';

        // Update title bar
        var titleText = document.querySelector('.admin-title-text');
        if (titleText) titleText.textContent = 'Reports Dashboard';
        var titleSub = document.querySelector('.admin-title-sub');
        if (titleSub) titleSub.textContent = 'View and manage reports';

        // Refresh icons for the changed nav button
        if (window.lucide) lucide.createIcons();
    }

    // Load admin data
    await loadAdminData(token);
}

// ============================================
// LOAD ADMIN DATA
// ============================================

async function loadAdminData(token) {
    try {
        // Fetch stats and users in parallel
        var statsPromise = fetch(API_URL + '/admin/stats', {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        var usersPromise = fetch(API_URL + '/admin/users', {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        var statsResponse = await statsPromise;
        var usersResponse = await usersPromise;

        var statsData = await statsResponse.json();
        var usersData = await usersResponse.json();

        // Fill stats
        if (statsData.success) {
            fillStats(statsData.stats);
        }

        // Fill users table
        if (usersData.success) {
            fillUsersTable(usersData.users);
        }

    } catch (err) {
        console.error('Failed to load admin data:', err);
        document.getElementById('usersTableBody').innerHTML = 
            '<tr><td colspan="5" class="table-empty">Failed to load data. Make sure the server is running.</td></tr>';
    }
}

// ============================================
// FILL STATS
// ============================================

function fillStats(stats) {
    var totalUsers = document.getElementById('statTotalUsers');
    var newToday = document.getElementById('statNewToday');
    var newWeek = document.getElementById('statNewWeek');
    var totalAdmins = document.getElementById('statTotalAdmins');
    var totalTesters = document.getElementById('statTotalTesters');
    var execToday = document.getElementById('statExecToday');
    var execMonth = document.getElementById('statExecMonth');

    if (totalUsers) totalUsers.textContent = stats.totalUsers;
    if (newToday) newToday.textContent = stats.newToday;
    if (newWeek) newWeek.textContent = stats.newThisWeek;
    if (totalAdmins) totalAdmins.textContent = stats.totalAdmins;
    if (totalTesters) totalTesters.textContent = stats.totalTesters || 0;
    if (execToday) execToday.textContent = stats.executionsToday;
    if (execMonth) execMonth.textContent = stats.executionsThisMonth;
}

// ============================================
// FILL USERS TABLE
// ============================================

function fillUsersTable(users) {
    var tbody = document.getElementById('usersTableBody');
    var countEl = document.getElementById('tableCount');

    if (!tbody) return;

    // Update count
    if (countEl) {
        countEl.textContent = users.length + ' user' + (users.length !== 1 ? 's' : '');
    }

    // Empty state
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No users found</td></tr>';
        return;
    }

    // Build rows
    var html = '';

    users.forEach(function(user) {
        var initials = getInitials(user.name);
        var isAdmin = user.role === 'admin';
        var isTester = user.role === 'tester';
        var roleClass = isAdmin ? 'admin' : (isTester ? 'tester' : 'user');
        var roleText = isAdmin ? 'Admin' : (isTester ? 'Tester' : 'User');
        var dateText = formatDate(user.createdAt);

        // Build avatar content - image or initials
        var avatarContent = '';
        if (user.avatar) {
            var avatarUrl = getAvatarUrl(user.avatar);
            avatarContent = '<img src="' + avatarUrl + '" alt="' + escapeHtml(user.name) + '" style="width:100%;height:100%;object-fit:contain;border-radius:inherit;padding:3px;">';
        } else {
            avatarContent = initials;
        }

        var isSelf = currentUser && (user.id === currentUser._id || user.id === currentUser.id);

        html += '<tr>';
        html += '  <td>';
        html += '    <div class="user-row-info">';
        html += '      <div class="user-row-avatar"' + (user.avatar ? ' style="background:transparent;"' : '') + '>' + avatarContent + '</div>';
        html += '      <div>';
        html += '        <div class="user-row-name">' + escapeHtml(user.name) + '</div>';
        html += '        <div class="user-row-email">' + escapeHtml(user.email) + '</div>';
        html += '      </div>';
        html += '    </div>';
        html += '  </td>';
        html += '  <td>' + escapeHtml(user.email) + '</td>';
        html += '  <td>';
        if (!isSelf) {
            html += '    <div class="role-dropdown-wrapper" data-id="' + escapeHtml(user.id) + '">';
            html += '      <button class="role-pill role-pill-btn ' + roleClass + '" data-current="' + escapeHtml(user.role) + '">';
            html += '        ' + roleText + ' <svg data-lucide="chevron-down" width="12" height="12" style="margin-left: 4px;"></svg>';
            html += '      </button>';
            html += '      <div class="role-dropdown">';
            html += '        <button class="role-dropdown-item ' + (user.role === 'user' ? 'active' : '') + '" data-role="user">User</button>';
            html += '        <button class="role-dropdown-item ' + (user.role === 'tester' ? 'active' : '') + '" data-role="tester">Tester</button>';
            html += '        <button class="role-dropdown-item ' + (user.role === 'admin' ? 'active' : '') + '" data-role="admin">Admin</button>';
            html += '      </div>';
            html += '    </div>';
        } else {
            html += '    <span class="role-pill ' + roleClass + '">' + roleText + '</span>';
        }
        html += '  </td>';
        html += '  <td><span class="views-badge">' + (user.examplesViewed || 0) + '</span></td>';
        html += '  <td><span class="date-cell">' + dateText + '</span></td>';
        html += '  <td class="action-cell">';
        if (!isSelf) {
            html += '    <button class="user-delete-btn" data-id="' + escapeHtml(user.id) + '" data-name="' + escapeHtml(user.name) + '" title="Delete user">';
            html += '      <svg data-lucide="trash-2"></svg>';
            html += '    </button>';
        }
        html += '  </td>';
        html += '</tr>';
    });

    tbody.innerHTML = html;

    // Re-create lucide icons for the new rows
    if (window.lucide) lucide.createIcons({ rootElement: tbody });

    // Wire delete buttons
    tbody.querySelectorAll('.user-delete-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            openDeleteConfirm(btn.getAttribute('data-id'), btn.getAttribute('data-name'));
        });
    });

    // Wire role change dropdown buttons
    tbody.querySelectorAll('.role-dropdown-wrapper').forEach(function(wrapper) {
        var btn = wrapper.querySelector('.role-pill-btn');
        var dropdown = wrapper.querySelector('.role-dropdown');
        var userId = wrapper.getAttribute('data-id');

        // Toggle dropdown
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var isOpen = dropdown.classList.contains('open');
            
            // Close all other dropdowns
            tbody.querySelectorAll('.role-dropdown.open').forEach(function(d) {
                d.classList.remove('open');
            });
            
            // Toggle this dropdown
            if (!isOpen) {
                dropdown.classList.add('open');
            }
        });

        // Role selection
        dropdown.querySelectorAll('.role-dropdown-item').forEach(function(item) {
            item.addEventListener('click', function(e) {
                e.stopPropagation();
                var newRole = item.getAttribute('data-role');
                changeUserRole(userId, newRole, wrapper);
                dropdown.classList.remove('open');
            });
        });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', function() {
        tbody.querySelectorAll('.role-dropdown.open').forEach(function(d) {
            d.classList.remove('open');
        });
    });
}

// ============================================
// CHANGE USER ROLE
// ============================================

async function changeUserRole(userId, newRole, wrapperEl) {
    var token = localStorage.getItem('codelens-token');
    if (!token) return;

    var btn = wrapperEl.querySelector('.role-pill-btn');
    var previousRole = btn.getAttribute('data-current');
    btn.disabled = true;

    try {
        var res = await fetch(API_URL + '/admin/users/' + userId + '/role', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ role: newRole })
        });
        var data = await res.json();
        if (data.success) {
            // Refresh the table to show updated role
            await loadAdminData(token);
        } else {
            alert(data.message || 'Failed to change role');
        }
    } catch (err) {
        alert('Network error — please try again');
    } finally {
        btn.disabled = false;
    }
}

// ============================================
// DELETE USER
// ============================================

function openDeleteConfirm(userId, userName) {
    pendingDeleteId = userId;
    pendingDeleteName = userName;
    var nameEl = document.getElementById('deleteConfirmName');
    if (nameEl) nameEl.textContent = userName;
    var overlay = document.getElementById('deleteConfirmOverlay');
    if (overlay) {
        overlay.classList.add('open');
        if (window.lucide) lucide.createIcons({ rootElement: overlay });
    }
}

function closeDeleteConfirm() {
    pendingDeleteId = null;
    pendingDeleteName = null;
    var overlay = document.getElementById('deleteConfirmOverlay');
    if (overlay) overlay.classList.remove('open');
}

async function confirmDeleteUser() {
    if (!pendingDeleteId) return;
    var token = localStorage.getItem('codelens-token');
    var btn = document.getElementById('deleteConfirmOk');
    if (btn) { btn.disabled = true; btn.textContent = 'Deleting...'; }

    try {
        var res = await fetch(API_URL + '/admin/users/' + pendingDeleteId, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        });
        var data = await res.json();
        if (data.success) {
            closeDeleteConfirm();
            await loadAdminData(token);
        } else {
            alert(data.message || 'Failed to delete user');
        }
    } catch (err) {
        alert('Network error — please try again');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<svg data-lucide="trash-2"></svg> Delete'; if (window.lucide) lucide.createIcons({ rootElement: btn }); }
    }
}

// ============================================
// HELPERS (getInitials, formatDate, escapeHtml,
// toggleProfileDropdown, closeProfileDropdown,
// handleLogout are defined in config.js)
// ============================================

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', function() {

    // ---- Profile dropdown ----
    var profileBtns = document.querySelectorAll('.profile-btn');
    profileBtns.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleProfileDropdown();
        });
    });

    document.addEventListener('click', function(e) {
        if (!e.target.closest('.profile-dropdown-wrapper')) {
            closeProfileDropdown();
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeProfileDropdown();
        }
    });

    // ---- Logout ----
    var logoutBtns = document.querySelectorAll('.logout-btn');
    logoutBtns.forEach(function(btn) {
        btn.addEventListener('click', handleLogout);
    });

    // ---- Delete confirm modal ----
    var deleteCancel = document.getElementById('deleteConfirmCancel');
    var deleteOk = document.getElementById('deleteConfirmOk');
    var deleteOverlay = document.getElementById('deleteConfirmOverlay');
    if (deleteCancel) deleteCancel.addEventListener('click', closeDeleteConfirm);
    if (deleteOk) deleteOk.addEventListener('click', confirmDeleteUser);
    if (deleteOverlay) {
        deleteOverlay.addEventListener('click', function(e) {
            if (e.target === deleteOverlay) closeDeleteConfirm();
        });
    }

    // ---- Dashboard refresh button ----
    var dashboardRefreshBtn = document.getElementById('dashboardRefreshBtn');
    if (dashboardRefreshBtn) {
        dashboardRefreshBtn.addEventListener('click', function () {
            var token = localStorage.getItem('codelens-token');
            if (!token) return;
            dashboardRefreshBtn.classList.add('spinning');
            loadAdminData(token).finally(function () {
                dashboardRefreshBtn.classList.remove('spinning');
            });
        });
    }

    // ---- Init admin page ----
    initAdmin();
});
