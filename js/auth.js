/* ============================================
   Auth System - Login/Signup/Profile/Password Reset
   Handles modal, form submission, JWT storage,
   forgot-password OTP flow (3-step: email → otp → reset)
   ============================================ */

// API_URL is defined in config.js (loaded first)

// ---- State ----
var currentTab = 'login'; // 'login' | 'signup' | 'forgot-request' | 'forgot-verify' | 'forgot-password'
var isLoggedIn = false;
var currentUser = null;

// Forgot-password flow state
var forgotEmail = '';    // email entered in step 1
var forgotOtp = '';      // OTP entered in step 2 (kept to re-send to reset endpoint)
var otpCountdownInterval = null;

// ============================================
// MODAL CONTROL
// ============================================

// Open auth modal (always resets to login tab)
function openAuthModal() {
    var overlay = document.getElementById('authOverlay');
    if (overlay) {
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
        clearAuthError();
        clearAuthSuccess();
        // Always start fresh on the login tab
        if (currentTab !== 'login' && currentTab !== 'signup') {
            switchAuthTab('login');
        }
    }
}

// Close auth modal
function closeAuthModal() {
    var overlay = document.getElementById('authOverlay');
    if (overlay) {
        overlay.classList.remove('open');
        document.body.style.overflow = '';
        clearOtpCountdown();
    }
}

// Switch between Login, Signup, and Forgot-Password states
function switchAuthTab(tab) {
    currentTab = tab;

    // ---- Element refs ----
    var tabs          = document.querySelectorAll('.auth-tab');
    var tabsContainer = document.querySelector('.auth-tabs');
    var nameGroup     = document.getElementById('authNameGroup');
    var emailGroup    = document.getElementById('authEmailGroup');
    var passwordGroup = document.getElementById('authPasswordGroup');
    var forgotLink    = document.getElementById('authForgotLink');
    var otpGroup      = document.getElementById('authOtpGroup');
    var newPwGroup    = document.getElementById('authNewPasswordGroup');
    var confirmPwGrp  = document.getElementById('authConfirmPasswordGroup');
    var submitBtn     = document.getElementById('authSubmitBtn');
    var title         = document.getElementById('authTitle');
    var subtitle      = document.getElementById('authSubtitle');
    var footer        = document.getElementById('authFooter');

    // Helper: show/hide an element
    function show(el) { if (el) el.style.display = ''; }
    function hide(el) { if (el) el.style.display = 'none'; }

    // Reset all optional elements to hidden
    hide(nameGroup); hide(otpGroup); hide(newPwGroup); hide(confirmPwGrp); hide(forgotLink);

    if (tab === 'login') {
        // ---- LOGIN state ----
        show(tabsContainer);
        tabs[0] && tabs[0].classList.add('active');
        tabs[1] && tabs[1].classList.remove('active');

        show(emailGroup); show(passwordGroup); show(forgotLink);

        if (submitBtn) submitBtn.textContent = 'Login';
        if (title)    title.textContent = 'Welcome Back';
        if (subtitle) subtitle.textContent = 'Login to access your saved work';
        if (footer)   footer.innerHTML = 'Don\'t have an account? <a onclick="switchAuthTab(\'signup\')">Sign up</a>';

    } else if (tab === 'signup') {
        // ---- SIGNUP state ----
        show(tabsContainer);
        tabs[0] && tabs[0].classList.remove('active');
        tabs[1] && tabs[1].classList.add('active');

        show(nameGroup); show(emailGroup); show(passwordGroup);

        if (submitBtn) submitBtn.textContent = 'Create Account';
        if (title)    title.textContent = 'Create Account';
        if (subtitle) subtitle.textContent = 'Sign up to start visualizing code';
        if (footer)   footer.innerHTML = 'Already have an account? <a onclick="switchAuthTab(\'login\')">Login</a>';

    } else if (tab === 'forgot-request') {
        // ---- FORGOT — Step 1: request OTP ----
        hide(tabsContainer);
        show(emailGroup); hide(passwordGroup);
        // Clear the email field so it's clean
        var emailInput = document.getElementById('authEmail');
        if (emailInput) emailInput.value = '';

        if (submitBtn) submitBtn.textContent = 'Send Code';
        if (title)    title.textContent = 'Reset Password';
        if (subtitle) subtitle.textContent = 'Enter your email — we\'ll send a verification code';
        if (footer)   footer.innerHTML = '<a onclick="switchAuthTab(\'login\')">\u2190 Back to login</a>';

    } else if (tab === 'forgot-verify') {
        // ---- FORGOT — Step 2: verify OTP ----
        hide(tabsContainer);
        hide(emailGroup); hide(passwordGroup);
        show(otpGroup);

        // Show email hint
        var hint = document.getElementById('authOtpEmailHint');
        if (hint) hint.textContent = forgotEmail;

        // Clear previous OTP input
        var otpInput = document.getElementById('authOtp');
        if (otpInput) otpInput.value = '';

        // Start countdown (10 minutes)
        startOtpCountdown(10);

        if (submitBtn) submitBtn.textContent = 'Verify Code';
        if (title)    title.textContent = 'Check Your Email';
        if (subtitle) subtitle.textContent = 'Enter the 6-digit code we sent you';
        if (footer)   footer.innerHTML = '<a onclick="switchAuthTab(\'forgot-request\')">\u2190 Try a different email</a>';

    } else if (tab === 'forgot-password') {
        // ---- FORGOT — Step 3: set new password ----
        hide(tabsContainer);
        show(newPwGroup); show(confirmPwGrp);

        // Clear the password fields
        var newPw = document.getElementById('authNewPassword');
        var confPw = document.getElementById('authConfirmPassword');
        if (newPw) newPw.value = '';
        if (confPw) confPw.value = '';

        if (submitBtn) submitBtn.textContent = 'Reset Password';
        if (title)    title.textContent = 'Set New Password';
        if (subtitle) subtitle.textContent = 'Choose a strong new password';
        if (footer)   footer.innerHTML = '<a onclick="switchAuthTab(\'login\')">\u2190 Back to login</a>';
    }

    clearAuthError();
    clearAuthSuccess();
}

// Entry point when "Forgot password?" link is clicked
function switchToForgotPassword() {
    switchAuthTab('forgot-request');
}

// ============================================
// ERROR / SUCCESS MESSAGES
// ============================================

function showAuthError(message) {
    var errorDiv = document.getElementById('authError');
    if (errorDiv) {
        errorDiv.querySelector('.auth-error-text').textContent = message;
        errorDiv.classList.add('show');
    }
}

function clearAuthError() {
    var errorDiv = document.getElementById('authError');
    if (errorDiv) {
        errorDiv.classList.remove('show');
    }
}

function showAuthSuccess(message) {
    var successDiv = document.getElementById('authSuccess');
    if (successDiv) {
        successDiv.querySelector('.auth-success-text').textContent = message;
        successDiv.classList.add('show');
    }
}

function clearAuthSuccess() {
    var successDiv = document.getElementById('authSuccess');
    if (successDiv) {
        successDiv.classList.remove('show');
    }
}

// ============================================
// FORM SUBMISSION
// ============================================

async function handleAuthSubmit(event) {
    event.preventDefault();
    clearAuthError();
    clearAuthSuccess();

    var submitBtn = document.getElementById('authSubmitBtn');
    submitBtn.disabled = true;

    try {
        if (currentTab === 'login') {
            await handleLogin();
        } else if (currentTab === 'signup') {
            await handleRegister();
        } else if (currentTab === 'forgot-request') {
            await handleForgotPassword();
        } else if (currentTab === 'forgot-verify') {
            await handleVerifyOtp();
        } else if (currentTab === 'forgot-password') {
            await handleResetPassword();
        }
    } catch (err) {
        showAuthError(err.message || 'Something went wrong');
    }

    submitBtn.disabled = false;
}

// ---- Login ----
async function handleLogin() {
    var email = document.getElementById('authEmail').value.trim();
    var password = document.getElementById('authPassword').value;

    if (!email || !password) {
        showAuthError('Please fill in all fields');
        return;
    }

    // Basic email format check
    if (!/^\S+@\S+\.\S+$/.test(email)) {
        showAuthError('Please enter a valid email address');
        return;
    }

    var response = await fetch(API_URL + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password })
    });

    var data = await response.json();

    if (!data.success) {
        showAuthError(data.message);
        return;
    }

    // Save token and user data
    localStorage.setItem('codelens-token', data.token);
    localStorage.setItem('codelens-user', JSON.stringify(data.user));

    // Update UI
    setLoggedInState(data.user);
    closeAuthModal();
}

// ---- Register ----
async function handleRegister() {
    var name = document.getElementById('authName').value.trim();
    var email = document.getElementById('authEmail').value.trim();
    var password = document.getElementById('authPassword').value;

    if (!name || !email || !password) {
        showAuthError('Please fill in all fields');
        return;
    }

    if (name.length < 2) {
        showAuthError('Name must be at least 2 characters');
        return;
    }

    // Basic email format check
    if (!/^\S+@\S+\.\S+$/.test(email)) {
        showAuthError('Please enter a valid email address');
        return;
    }

    if (password.length < 6) {
        showAuthError('Password must be at least 6 characters');
        return;
    }

    var response = await fetch(API_URL + '/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, email: email, password: password })
    });

    var data = await response.json();

    if (!data.success) {
        showAuthError(data.message);
        return;
    }

    // Save token and user data
    localStorage.setItem('codelens-token', data.token);
    localStorage.setItem('codelens-user', JSON.stringify(data.user));

    // Update UI
    setLoggedInState(data.user);
    closeAuthModal();
}

// ============================================
// FORGOT PASSWORD FLOW (3 steps)
// ============================================

// ---- OTP Countdown Timer ----
function startOtpCountdown(minutes) {
    clearOtpCountdown();
    var expiresAt = Date.now() + minutes * 60 * 1000;
    var countdownEl = document.getElementById('authOtpCountdown');
    var resendBtn   = document.getElementById('authOtpResendBtn');

    if (resendBtn) resendBtn.disabled = true;

    otpCountdownInterval = setInterval(function() {
        var remaining = expiresAt - Date.now();
        if (remaining <= 0) {
            clearOtpCountdown();
            if (countdownEl) countdownEl.textContent = '00:00';
            if (resendBtn) resendBtn.disabled = false;
            return;
        }
        var mins = Math.floor(remaining / 60000);
        var secs = Math.floor((remaining % 60000) / 1000);
        if (countdownEl) {
            countdownEl.textContent = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
        }
    }, 1000);
}

function clearOtpCountdown() {
    if (otpCountdownInterval) {
        clearInterval(otpCountdownInterval);
        otpCountdownInterval = null;
    }
}

// ---- Step 1: Request OTP ----
async function handleForgotPassword() {
    var email = document.getElementById('authEmail').value.trim();

    if (!email) {
        showAuthError('Please enter your email address');
        return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
        showAuthError('Please enter a valid email address');
        return;
    }

    var response = await fetch(API_URL + '/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email })
    });

    var data = await response.json();

    if (!data.success) {
        showAuthError(data.message);
        return;
    }

    // Store email for subsequent steps
    forgotEmail = email;

    // Move to OTP verification step
    switchAuthTab('forgot-verify');
    showAuthSuccess('Code sent! Check your inbox (and spam folder).');
}

// ---- Step 2: Verify OTP ----
async function handleVerifyOtp() {
    var otp = (document.getElementById('authOtp').value || '').trim();

    if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
        showAuthError('Please enter the 6-digit code from your email');
        return;
    }

    var response = await fetch(API_URL + '/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, otp: otp })
    });

    var data = await response.json();

    if (!data.success) {
        showAuthError(data.message);
        return;
    }

    // Store OTP for the reset step
    forgotOtp = otp;
    clearOtpCountdown();

    // Move to new-password step
    switchAuthTab('forgot-password');
    showAuthSuccess('Identity verified! Set your new password below.');
}

// ---- Step 3: Reset Password ----
async function handleResetPassword() {
    var newPassword     = document.getElementById('authNewPassword').value;
    var confirmPassword = document.getElementById('authConfirmPassword').value;

    if (!newPassword || !confirmPassword) {
        showAuthError('Please fill in both password fields');
        return;
    }

    if (newPassword.length < 6) {
        showAuthError('Password must be at least 6 characters');
        return;
    }

    if (newPassword !== confirmPassword) {
        showAuthError('Passwords do not match');
        return;
    }

    var response = await fetch(API_URL + '/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, otp: forgotOtp, newPassword: newPassword })
    });

    var data = await response.json();

    if (!data.success) {
        showAuthError(data.message);
        return;
    }

    // Clear forgot-password state
    forgotEmail = '';
    forgotOtp   = '';

    // Switch back to login and show success
    switchAuthTab('login');
    showAuthSuccess(data.message || 'Password reset successfully! Please log in.');
}

// ---- Resend OTP (triggered by "Resend code" button) ----
async function handleResendOtp() {
    if (!forgotEmail) return;

    var resendBtn = document.getElementById('authOtpResendBtn');
    if (resendBtn) resendBtn.disabled = true;

    clearAuthError();
    clearAuthSuccess();

    try {
        var response = await fetch(API_URL + '/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: forgotEmail })
        });

        var data = await response.json();

        if (data.success) {
            showAuthSuccess('New code sent! Check your inbox.');
            startOtpCountdown(10);
        } else {
            showAuthError(data.message || 'Could not resend. Please try again.');
            if (resendBtn) resendBtn.disabled = false;
        }
    } catch (err) {
        showAuthError('Network error. Please try again.');
        if (resendBtn) resendBtn.disabled = false;
    }
}

// ============================================
// AUTH STATE MANAGEMENT
// ============================================

// Set UI to logged-in state
function setLoggedInState(user) {
    isLoggedIn = true;
    currentUser = user;

    // Hide login button, show profile button
    var loginBtns = document.querySelectorAll('.login-btn');
    loginBtns.forEach(function(btn) {
        btn.style.display = 'none';
    });

    var profileBtns = document.querySelectorAll('.profile-btn');
    profileBtns.forEach(function(btn) {
        btn.classList.add('show');
    });

    // Update header avatars and profile info
    updateHeaderAvatars(user);
    updateHeaderProfileInfo(user);

    // Show admin link if user is admin
    var adminLinks = document.querySelectorAll('.admin-only-link');
    adminLinks.forEach(function(link) {
        link.style.display = user.role === 'admin' ? '' : 'none';
    });

    // Show reports link if user is tester
    var testerLinks = document.querySelectorAll('.tester-only-link');
    testerLinks.forEach(function(link) {
        link.style.display = user.role === 'tester' ? '' : 'none';
    });

    // Hide the guest run counter badge now that user is logged in
    if (window._P && typeof window._P.updateGuestRunBadge === 'function') {
        window._P.updateGuestRunBadge();
    }
}

// Set UI to logged-out state
function setLoggedOutState() {
    isLoggedIn = false;
    currentUser = null;

    // Show login button, hide profile button
    var loginBtns = document.querySelectorAll('.login-btn');
    loginBtns.forEach(function(btn) {
        btn.style.display = '';
    });

    var profileBtns = document.querySelectorAll('.profile-btn');
    profileBtns.forEach(function(btn) {
        btn.classList.remove('show');
    });

    // Hide admin link
    var adminLinks = document.querySelectorAll('.admin-only-link');
    adminLinks.forEach(function(link) {
        link.style.display = 'none';
    });

    // Hide tester link
    var testerLinks = document.querySelectorAll('.tester-only-link');
    testerLinks.forEach(function(link) {
        link.style.display = 'none';
    });
}

// handleLogout, getInitials, toggleProfileDropdown, closeProfileDropdown
// are defined in config.js (loaded first)

// ============================================
// PASSWORD VISIBILITY TOGGLE
// ============================================

function togglePasswordVisibility() {
    var passwordInput = document.getElementById('authPassword');
    var toggleBtn = document.querySelector('.auth-password-toggle');

    if (!passwordInput || !toggleBtn) return;

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleBtn.innerHTML = '<svg data-lucide="eye-off"></svg>';
    } else {
        passwordInput.type = 'password';
        toggleBtn.innerHTML = '<svg data-lucide="eye"></svg>';
    }

    // Re-render lucide icons
    if (window.lucide) {
        lucide.createIcons();
    }
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', function() {

    // ---- Login button click → open modal ----
    var loginBtns = document.querySelectorAll('.login-btn');
    loginBtns.forEach(function(btn) {
        btn.addEventListener('click', openAuthModal);
    });

    // ---- Close modal on X button ----
    var closeBtn = document.querySelector('.auth-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeAuthModal);
    }

    // ---- Close modal on overlay click ----
    var overlay = document.getElementById('authOverlay');
    if (overlay) {
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                closeAuthModal();
            }
        });
    }

    // ---- Close on Escape ----
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAuthModal();
            closeProfileDropdown();
        }
    });

    // ---- Tab switching ----
    var tabs = document.querySelectorAll('.auth-tab');
    tabs.forEach(function(tab, index) {
        tab.addEventListener('click', function() {
            switchAuthTab(index === 0 ? 'login' : 'signup');
        });
    });

    // ---- Form submit ----
    var form = document.getElementById('authForm');
    if (form) {
        form.addEventListener('submit', handleAuthSubmit);
    }

    // ---- Profile button → toggle dropdown ----
    var profileBtns = document.querySelectorAll('.profile-btn');
    profileBtns.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleProfileDropdown();
        });
    });

    // ---- Close profile dropdown on outside click ----
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.profile-dropdown-wrapper')) {
            closeProfileDropdown();
        }
    });

    // ---- Logout button ----
    var logoutBtns = document.querySelectorAll('.logout-btn');
    logoutBtns.forEach(function(btn) {
        btn.addEventListener('click', handleLogout);
    });

    // ---- Check if user is already logged in ----
    var savedToken = localStorage.getItem('codelens-token');
    var savedUser = localStorage.getItem('codelens-user');

    if (savedToken && savedUser) {
        try {
            var user = JSON.parse(savedUser);
            setLoggedInState(user);
        } catch (e) {
            // Invalid data, clear it
            localStorage.removeItem('codelens-token');
            localStorage.removeItem('codelens-user');
        }
    }
});
