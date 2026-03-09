var cropState = {
    file: null,
    imageUrl: '',
    imgWidth: 0,
    imgHeight: 0,
    scale: 1,
    baseScale: 1,
    offsetX: 0,
    offsetY: 0,
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
    CANVAS_SIZE: 320,
    CIRCLE_RADIUS: 140
};

function openCropModal(file) {
    cropState.file = file;

    if (cropState.imageUrl) URL.revokeObjectURL(cropState.imageUrl);
    cropState.imageUrl = URL.createObjectURL(file);

    var overlay = document.getElementById('cropOverlay');
    var cropImg = document.getElementById('cropImage');
    var zoomSlider = document.getElementById('cropZoomSlider');

    if (!overlay || !cropImg) return;

    cropImg.onload = function() {
        cropState.imgWidth = cropImg.naturalWidth;
        cropState.imgHeight = cropImg.naturalHeight;

        var fitW = cropState.CANVAS_SIZE / cropState.imgWidth;
        var fitH = cropState.CANVAS_SIZE / cropState.imgHeight;
        cropState.baseScale = Math.max(fitW, fitH);
        cropState.scale = 1;

        var scaledW = cropState.imgWidth * cropState.baseScale;
        var scaledH = cropState.imgHeight * cropState.baseScale;
        cropState.offsetX = (cropState.CANVAS_SIZE - scaledW) / 2;
        cropState.offsetY = (cropState.CANVAS_SIZE - scaledH) / 2;

        if (zoomSlider) zoomSlider.value = 100;

        updateCropPreview();
    };

    cropImg.src = cropState.imageUrl;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    if (window.lucide) lucide.createIcons();
}

function closeCropModal() {
    var overlay = document.getElementById('cropOverlay');
    if (!overlay) return;

    overlay.classList.remove('open');
    document.body.style.overflow = '';

    if (cropState.imageUrl) {
        URL.revokeObjectURL(cropState.imageUrl);
        cropState.imageUrl = '';
    }
    cropState.file = null;
    cropState.dragging = false;
}

function updateCropPreview() {
    var cropImg = document.getElementById('cropImage');
    if (!cropImg) return;

    var totalScale = cropState.baseScale * cropState.scale;
    cropImg.style.transform = 'translate(' + cropState.offsetX + 'px, ' + cropState.offsetY + 'px) scale(' + totalScale + ')';
}

// Clamp offset so circle area always has image behind it
function clampOffset() {
    var totalScale = cropState.baseScale * cropState.scale;
    var scaledW = cropState.imgWidth * totalScale;
    var scaledH = cropState.imgHeight * totalScale;

    var cx = cropState.CANVAS_SIZE / 2;
    var cy = cropState.CANVAS_SIZE / 2;
    var r = cropState.CIRCLE_RADIUS;

    var maxX = cx - r;
    var minX = (cx + r) - scaledW;
    var maxY = cy - r;
    var minY = (cy + r) - scaledH;

    if (cropState.offsetX > maxX) cropState.offsetX = maxX;
    if (cropState.offsetX < minX) cropState.offsetX = minX;
    if (cropState.offsetY > maxY) cropState.offsetY = maxY;
    if (cropState.offsetY < minY) cropState.offsetY = minY;
}

// Handle zoom slider change
function handleCropZoom(value) {
    var oldScale = cropState.scale;
    cropState.scale = value / 100;

    var cx = cropState.CANVAS_SIZE / 2;
    var cy = cropState.CANVAS_SIZE / 2;
    var ratio = cropState.scale / oldScale;
    cropState.offsetX = cx - ratio * (cx - cropState.offsetX);
    cropState.offsetY = cy - ratio * (cy - cropState.offsetY);

    clampOffset();
    updateCropPreview();
}

// Crop the image using a canvas and return a Blob
function cropImageToBlob(callback) {
    var outputSize = 400;
    var canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    var ctx = canvas.getContext('2d');

    ctx.beginPath();
    ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    var totalScale = cropState.baseScale * cropState.scale;
    var mapRatio = outputSize / cropState.CANVAS_SIZE;

    var drawX = cropState.offsetX * mapRatio;
    var drawY = cropState.offsetY * mapRatio;
    var drawW = cropState.imgWidth * totalScale * mapRatio;
    var drawH = cropState.imgHeight * totalScale * mapRatio;

    var img = new Image();
    img.onload = function() {
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        canvas.toBlob(function(blob) {
            callback(blob);
        }, 'image/png', 0.95);
    };
    img.src = cropState.imageUrl;
}

// Upload the cropped image blob
async function uploadCroppedAvatar() {
    var token = localStorage.getItem('codelens-token');
    if (!token) return;

    var uploadBtn = document.getElementById('cropUploadBtn');
    if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<svg data-lucide="loader"></svg> Uploading...';
        if (window.lucide) lucide.createIcons();
    }

    cropImageToBlob(async function(blob) {
        if (!blob) {
            showProfileMsg('Failed to process image', 'error');
            closeCropModal();
            return;
        }

        var formData = new FormData();
        var croppedFile = new File([blob], 'avatar.png', { type: 'image/png' });
        formData.append('avatar', croppedFile);

        try {
            var response = await smartFetch(API_URL + '/auth/upload-avatar', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token
                },
                body: formData
            });

            var data = await response.json();

            if (!data.success) {
                showProfileMsg(data.message || 'Upload failed', 'error');
                closeCropModal();
                return;
            }

            var user = data.user;
            localStorage.setItem('codelens-user', JSON.stringify(user));

            updateProfileAvatarDisplay(user.avatar);
            updateHeaderAvatars(user);
            highlightSelectedAvatar('');

            closeCropModal();
            showProfileMsg('Avatar uploaded!', 'success');

        } catch (err) {
            showProfileMsg('Upload failed. Try again.', 'error');
            closeCropModal();
        }
    });
}

// Handle avatar file upload — opens crop modal
async function handleAvatarUpload(file) {
    var token = localStorage.getItem('codelens-token');
    if (!token) return;

    if (file.size > 5 * 1024 * 1024) {
        showProfileMsg('Image must be less than 5MB', 'error');
        return;
    }

    if (!file.type.startsWith('image/')) {
        showProfileMsg('Please select an image file', 'error');
        return;
    }

    openCropModal(file);
}

document.addEventListener('DOMContentLoaded', function() {

    var cropCloseBtn = document.getElementById('cropCloseBtn');
    if (cropCloseBtn) cropCloseBtn.addEventListener('click', closeCropModal);

    var cropCancelBtn = document.getElementById('cropCancelBtn');
    if (cropCancelBtn) cropCancelBtn.addEventListener('click', closeCropModal);

    var cropOverlay = document.getElementById('cropOverlay');
    if (cropOverlay) {
        cropOverlay.addEventListener('click', function(e) {
            if (e.target === cropOverlay) closeCropModal();
        });
    }

    var cropUploadBtn = document.getElementById('cropUploadBtn');
    if (cropUploadBtn) cropUploadBtn.addEventListener('click', uploadCroppedAvatar);

    var cropZoomSlider = document.getElementById('cropZoomSlider');
    if (cropZoomSlider) {
        cropZoomSlider.addEventListener('input', function() {
            handleCropZoom(parseFloat(cropZoomSlider.value));
        });
    }

    var cropWrapper = document.getElementById('cropCanvasWrapper');
    if (cropWrapper) {
        cropWrapper.addEventListener('mousedown', function(e) {
            if (e.button !== 0) return;
            e.preventDefault();
            cropState.dragging = true;
            cropState.dragStartX = e.clientX;
            cropState.dragStartY = e.clientY;
            cropState.startOffsetX = cropState.offsetX;
            cropState.startOffsetY = cropState.offsetY;
        });

        document.addEventListener('mousemove', function(e) {
            if (!cropState.dragging) return;
            var dx = e.clientX - cropState.dragStartX;
            var dy = e.clientY - cropState.dragStartY;
            cropState.offsetX = cropState.startOffsetX + dx;
            cropState.offsetY = cropState.startOffsetY + dy;
            clampOffset();
            updateCropPreview();
        });

        document.addEventListener('mouseup', function() {
            cropState.dragging = false;
        });

        cropWrapper.addEventListener('touchstart', function(e) {
            if (e.touches.length !== 1) return;
            var touch = e.touches[0];
            cropState.dragging = true;
            cropState.dragStartX = touch.clientX;
            cropState.dragStartY = touch.clientY;
            cropState.startOffsetX = cropState.offsetX;
            cropState.startOffsetY = cropState.offsetY;
        }, { passive: true });

        document.addEventListener('touchmove', function(e) {
            if (!cropState.dragging || e.touches.length !== 1) return;
            var touch = e.touches[0];
            var dx = touch.clientX - cropState.dragStartX;
            var dy = touch.clientY - cropState.dragStartY;
            cropState.offsetX = cropState.startOffsetX + dx;
            cropState.offsetY = cropState.startOffsetY + dy;
            clampOffset();
            updateCropPreview();
        }, { passive: true });

        document.addEventListener('touchend', function() {
            cropState.dragging = false;
        });

        cropWrapper.addEventListener('wheel', function(e) {
            e.preventDefault();
            var slider = document.getElementById('cropZoomSlider');
            if (!slider) return;

            var delta = e.deltaY > 0 ? -10 : 10;
            var newVal = Math.min(300, Math.max(100, parseFloat(slider.value) + delta));
            slider.value = newVal;
            handleCropZoom(newVal);
        }, { passive: false });
    }
});
