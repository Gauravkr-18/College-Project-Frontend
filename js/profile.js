// API_URL, AVATAR_BASE_URL, getAvatarUrl, and getInitials

var isEditingName = false;
var originalName = '';
var isAvatarPickerOpen = false;

function updateProfileAvatarDisplay(avatar) {
    var img = document.getElementById('profileAvatarImg');
    var initials = document.getElementById('profileAvatarInitials');
    var bannerImg = document.getElementById('bannerAvatarImg');
    if (!img || !initials) return;

    if (avatar) {
        var url = getAvatarUrl(avatar);
        img.src = url;
        img.classList.add('show');
        initials.classList.add('hide');
        if (bannerImg) { bannerImg.src = url; bannerImg.classList.add('show'); }
    } else {
        img.classList.remove('show');
        initials.classList.remove('hide');
        if (bannerImg) { bannerImg.src = ''; bannerImg.classList.remove('show'); }
    }
}

function highlightSelectedAvatar(avatar) {
    var options = document.querySelectorAll('.avatar-option');
    options.forEach(function(opt) {
        opt.classList.remove('selected');
        if (opt.dataset.avatar === avatar) {
            opt.classList.add('selected');
        }
    });
}

function openProfileModal() {
    var overlay = document.getElementById('profileOverlay');
    if (!overlay) return;

    closeProfileDropdown();

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    isAvatarPickerOpen = false;
    var picker = document.getElementById('avatarPicker');
    if (picker) picker.classList.remove('open');

    loadProfileData();
}

function closeProfileModal() {
    var overlay = document.getElementById('profileOverlay');
    if (!overlay) return;

    overlay.classList.remove('open');
    document.body.style.overflow = '';

    // Cancel editing if in progress
    if (isEditingName) {
        cancelEditingName();
    }

    isAvatarPickerOpen = false;
    var picker = document.getElementById('avatarPicker');
    if (picker) picker.classList.remove('open');

    var msg = document.getElementById('profileMessage');
    if (msg) msg.className = 'profile-message';
}

async function loadProfileData() {
    var token = localStorage.getItem('codelens-token');
    if (!token) return;

    try {
        var response = await fetch(API_URL + '/auth/me', {
            method: 'GET',
            headers: { 'Authorization': 'Bearer ' + token }
        });

        var data = await response.json();

        if (!data.success) return;

        var user = data.user;

        localStorage.setItem('codelens-user', JSON.stringify(user));

        fillProfileModal(user);

        updateHeaderAvatars(user);
        updateHeaderProfileInfo(user);

    } catch (err) {
        showProfileMsg('Failed to load profile data', 'error');
    }
}

function fillProfileModal(user) {
    // Avatar - show image or initials
    updateProfileAvatarDisplay(user.avatar);

    // Set initials text (fallback)
    var initialsEl = document.getElementById('profileAvatarInitials');
    if (initialsEl) initialsEl.textContent = getInitials(user.name);

    // Role badge
    var badge = document.getElementById('profileRoleBadge');
    if (badge) {
        var isAdmin = user.role === 'admin';
        badge.className = 'profile-modal-role ' + (isAdmin ? 'admin' : 'user');
        badge.innerHTML = '<svg data-lucide="' + (isAdmin ? 'shield' : 'user') + '"></svg> ' +
                          (isAdmin ? 'Admin' : 'User');
    }

    // Name
    var nameInput = document.getElementById('nameInput');
    if (nameInput) nameInput.value = user.name;

    // Email
    var emailEl = document.getElementById('profileEmail');
    if (emailEl) emailEl.textContent = user.email;

    // Role text
    var roleEl = document.getElementById('profileRole');
    if (roleEl) roleEl.textContent = user.role === 'admin' ? 'Administrator' : 'User';

    // Date
    var dateEl = document.getElementById('profileDate');
    if (dateEl) dateEl.textContent = formatProfileDate(user.createdAt);

    if (window.lucide) lucide.createIcons();
}

function startEditingName() {
    isEditingName = true;
    originalName = document.getElementById('nameInput').value;

    var input = document.getElementById('nameInput');
    input.removeAttribute('readonly');
    input.focus();
    input.select();

    document.getElementById('nameEditActions').classList.add('show');
    document.getElementById('editNameBtn').style.display = 'none';
}

function cancelEditingName() {
    isEditingName = false;

    var input = document.getElementById('nameInput');
    input.value = originalName;
    input.setAttribute('readonly', true);

    document.getElementById('nameEditActions').classList.remove('show');
    document.getElementById('editNameBtn').style.display = '';
}

async function saveNameChange() {
    var newName = document.getElementById('nameInput').value.trim();

    if (!newName || newName.length < 2) {
        showProfileMsg('Name must be at least 2 characters', 'error');
        return;
    }

    if (newName === originalName) {
        cancelEditingName();
        return;
    }

    var token = localStorage.getItem('codelens-token');
    var saveBtn = document.getElementById('saveNameBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        var response = await fetch(API_URL + '/auth/me', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ name: newName })
        });

        var data = await response.json();

        if (!data.success) {
            showProfileMsg(data.message || 'Failed to update name', 'error');
            return;
        }

        var user = data.user;
        localStorage.setItem('codelens-user', JSON.stringify(user));
        fillProfileModal(user);

        updateHeaderAvatars(user);
        updateHeaderProfileInfo(user);

        // Exit edit mode
        isEditingName = false;
        document.getElementById('nameInput').setAttribute('readonly', true);
        document.getElementById('nameEditActions').classList.remove('show');
        document.getElementById('editNameBtn').style.display = '';

        showProfileMsg('Name updated successfully', 'success');

    } catch (err) {
        showProfileMsg('Something went wrong. Try again.', 'error');
    }

    saveBtn.disabled = false;
    saveBtn.textContent = 'Save';
}

function showProfileMsg(text, type) {
    var messageDiv = document.getElementById('profileMessage');
    var messageText = document.getElementById('profileMessageText');
    if (!messageDiv || !messageText) return;

    messageText.textContent = text;
    messageDiv.className = 'profile-message ' + type;

    var iconName = type === 'success' ? 'check-circle' : 'alert-circle';
    messageDiv.querySelector('svg').setAttribute('data-lucide', iconName);
    if (window.lucide) lucide.createIcons();

    setTimeout(function() {
        messageDiv.className = 'profile-message';
    }, 4000);
}

function formatProfileDate(dateString) {
    if (!dateString) return '—';
    var date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// INITIALIZATION (runs on every page that includes this script)

document.addEventListener('DOMContentLoaded', function() {

    var profileModalBtns = document.querySelectorAll('.profile-modal-btn');
    profileModalBtns.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            openProfileModal();
        });
    });

    var closeBtn = document.querySelector('.profile-modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeProfileModal);
    }

    var overlay = document.getElementById('profileOverlay');
    if (overlay) {
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) closeProfileModal();
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            var cropOv = document.getElementById('cropOverlay');
            if (cropOv && cropOv.classList.contains('open')) {
                closeCropModal();
                return;
            }
            var avOv = document.getElementById('avatarViewerOverlay');
            if (avOv && avOv.classList.contains('open')) {
                closeAvatarViewer();
                return;
            }
            var ov = document.getElementById('profileOverlay');
            if (ov && ov.classList.contains('open')) {
                closeProfileModal();
            }
        }
    });

    var editBtn = document.getElementById('editNameBtn');
    if (editBtn) editBtn.addEventListener('click', startEditingName);

    var saveBtn = document.getElementById('saveNameBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveNameChange);

    var cancelBtn = document.getElementById('cancelNameBtn');
    if (cancelBtn) cancelBtn.addEventListener('click', cancelEditingName);

    var nameInput = document.getElementById('nameInput');
    if (nameInput) {
        nameInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && isEditingName) {
                e.preventDefault();
                saveNameChange();
            }
        });
    }

});
