
function toggleAvatarPicker() {
    var picker = document.getElementById('avatarPicker');
    if (!picker) return;

    isAvatarPickerOpen = !isAvatarPickerOpen;

    if (isAvatarPickerOpen) {
        picker.classList.add('open');
        // Highlight current avatar
        var stored = localStorage.getItem('codelens-user');
        if (stored) {
            var user = JSON.parse(stored);
            highlightSelectedAvatar(user.avatar || '');
        }
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

    document.querySelectorAll('.avatar-option[data-avatar]').forEach(function(option) {
        var val = option.getAttribute('data-avatar');
        if (/^[1-5]$/.test(val)) {
            var img = option.querySelector('img');
            if (img) img.src = AVATAR_BASE_URL + val + '.png';
        }
    });

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
            // Don't open viewer if clicking the edit button
            if (e.target.closest('.avatar-edit-btn')) return;

            var stored = localStorage.getItem('codelens-user');
            if (stored) {
                var user = JSON.parse(stored);
                if (user.avatar) {
                    openAvatarViewer();
                }
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
            if (e.target === avatarViewerOverlay) {
                closeAvatarViewer();
            }
        });
    }

    var avatarOptions = document.querySelectorAll('.avatar-option[data-avatar]');
    avatarOptions.forEach(function(opt) {
        opt.addEventListener('click', function() {
            var avatarValue = opt.dataset.avatar;
            saveAvatarSelection(avatarValue);
        });
    });

    var uploadOption = document.getElementById('avatarUploadOption');
    var fileInput = document.getElementById('avatarFileInput');
    if (uploadOption && fileInput) {
        uploadOption.addEventListener('click', function() {
            fileInput.click();
        });

        fileInput.addEventListener('change', function() {
            if (fileInput.files && fileInput.files[0]) {
                handleAvatarUpload(fileInput.files[0]);
                fileInput.value = ''; // Reset so same file can be selected again
            }
        });
    }
});
