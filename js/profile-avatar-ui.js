
// Cache for avatar list fetched from backend
var _presetAvatarCache = null;

async function fetchPresetAvatars() {
    if (_presetAvatarCache) return _presetAvatarCache;
    try {
        var res = await fetch(API_URL + '/auth/preset-avatars');
        var data = await res.json();
        if (data.success) {
            _presetAvatarCache = data;
            return data;
        }
    } catch (e) {}
    return { male: [], female: [] };
}

function buildAvatarPickerGrid(data) {
    var grid = document.querySelector('.avatar-picker-grid');
    if (!grid) return;

    // Save the upload option before clearing
    var uploadOption = document.getElementById('avatarUploadOption');
    grid.innerHTML = '';

    function addSection(label, list) {
        if (!list || !list.length) return;

        var sectionLabel = document.createElement('div');
        sectionLabel.className = 'avatar-section-label';
        sectionLabel.textContent = label;
        grid.appendChild(sectionLabel);

        list.forEach(function(avatarPath) {
            var div = document.createElement('div');
            div.className = 'avatar-option';
            div.dataset.avatar = avatarPath;
            var img = document.createElement('img');
            img.src = AVATAR_BASE_URL + avatarPath;
            img.alt = label + ' avatar';
            div.appendChild(img);
            div.addEventListener('click', function() {
                saveAvatarSelection(avatarPath);
            });
            grid.appendChild(div);
        });
    }

    addSection('Male', data.male);
    addSection('Female', data.female);

    // Re-add upload option at the end
    if (uploadOption) grid.appendChild(uploadOption);

    // Re-highlight selected avatar
    var stored = localStorage.getItem('codelens-user');
    if (stored) {
        try {
            var user = JSON.parse(stored);
            highlightSelectedAvatar(user.avatar || '');
        } catch (e) {}
    }
}

function toggleAvatarPicker() {
    var picker = document.getElementById('avatarPicker');
    if (!picker) return;

    isAvatarPickerOpen = !isAvatarPickerOpen;

    if (isAvatarPickerOpen) {
        picker.classList.add('open');

        // Build grid dynamically on first open
        fetchPresetAvatars().then(function(data) {
            buildAvatarPickerGrid(data);
        });
    } else {
        picker.classList.remove('open');
    }
}

// AVATAR VIEWER (Click to enlarge)

function openAvatarViewer() {
    var stored = localStorage.getItem('codelens-user');
    if (!stored) return;

    var user = JSON.parse(stored);
    if (!user.avatar) return;

    var overlay = document.getElementById('avatarViewerOverlay');
    var viewerImage = document.getElementById('avatarViewerImage');

    if (!overlay || !viewerImage) return;

    viewerImage.src = getAvatarUrl(user.avatar);
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeAvatarViewer() {
    var overlay = document.getElementById('avatarViewerOverlay');
    if (!overlay) return;

    overlay.classList.remove('open');
    document.body.style.overflow = '';
}

async function saveAvatarSelection(avatarValue) {
    var token = localStorage.getItem('codelens-token');
    if (!token) return;

    try {
        var response = await fetch(API_URL + '/auth/me', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ avatar: avatarValue })
        });

        var data = await response.json();

        if (!data.success) {
            showProfileMsg(data.message || 'Failed to update avatar', 'error');
            return;
        }

        var user = data.user;
        localStorage.setItem('codelens-user', JSON.stringify(user));

        updateProfileAvatarDisplay(user.avatar);
        updateHeaderAvatars(user);
        highlightSelectedAvatar(user.avatar);

        showProfileMsg('Avatar updated!', 'success');

    } catch (err) {
        showProfileMsg('Failed to update avatar', 'error');
    }
}

document.addEventListener('DOMContentLoaded', function() {

    var avatarEditBtn = document.getElementById('avatarEditBtn');
    if (avatarEditBtn) {
        avatarEditBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleAvatarPicker();
        });
    }

    var profileAvatar = document.getElementById('profileAvatar');
    if (profileAvatar) {
        profileAvatar.addEventListener('click', function(e) {
            if (e.target.closest('.avatar-edit-btn')) return;

            var stored = localStorage.getItem('codelens-user');
            if (stored) {
                try {
                    var user = JSON.parse(stored);
                    if (user.avatar) openAvatarViewer();
                } catch (e) {}
            }
        });
    }

    var avatarViewerClose = document.getElementById('avatarViewerClose');
    if (avatarViewerClose) {
        avatarViewerClose.addEventListener('click', function(e) {
            e.stopPropagation();
            closeAvatarViewer();
        });
    }

    var avatarViewerOverlay = document.getElementById('avatarViewerOverlay');
    if (avatarViewerOverlay) {
        avatarViewerOverlay.addEventListener('click', function(e) {
            if (e.target === avatarViewerOverlay) closeAvatarViewer();
        });
    }

    var uploadOption = document.getElementById('avatarUploadOption');
    var fileInput = document.getElementById('avatarFileInput');
    if (uploadOption && fileInput) {
        uploadOption.addEventListener('click', function() {
            fileInput.click();
        });

        fileInput.addEventListener('change', function() {
            if (fileInput.files && fileInput.files[0]) {
                handleAvatarUpload(fileInput.files[0]);
                fileInput.value = '';
            }
        });
    }
});

