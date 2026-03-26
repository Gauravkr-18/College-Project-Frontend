
var currentTab = 'login';
var isLoggedIn = false;
var currentUser = null;

var forgotEmail = '';
var forgotOtp = '';
var otpCountdownInterval = null;
var fullNamePattern = /^[A-Za-z]+(?: [A-Za-z]+)*$/;

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

function closeAuthModal() {
    var overlay = document.getElementById('authOverlay');
    if (overlay) {
        overlay.classList.remove('open');
        document.body.style.overflow = '';
        clearOtpCountdown();
    }
}

function switchAuthTab(tab) {
    currentTab = tab;

    var tabs          = document.querySelectorAll('.auth-tab');
    var tabsContainer = document.querySelector('.auth-tabs');
    var nameGroup     = document.getElementById('authNameGroup');
    var genderGroup   = document.getElementById('authGenderGroup');
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

    function show(el) { if (el) el.style.display = ''; }
    function hide(el) { if (el) el.style.display = 'none'; }

    // Reset all optional elements to hidden
    hide(nameGroup); hide(genderGroup); hide(otpGroup); hide(newPwGroup); hide(confirmPwGrp); hide(forgotLink);

    if (tab === 'login') {
        show(tabsContainer);
        tabs[0] && tabs[0].classList.add('active');
        tabs[1] && tabs[1].classList.remove('active');

        show(emailGroup); show(passwordGroup); show(forgotLink);

        if (submitBtn) submitBtn.textContent = 'Login';
        if (title)    title.textContent = 'Welcome Back';
        if (subtitle) subtitle.textContent = 'Login to access your saved work';
        if (footer)   footer.innerHTML = 'Don\'t have an account? <a onclick="switchAuthTab(\'signup\')">Sign up</a>';

    } else if (tab === 'signup') {
        show(tabsContainer);
        tabs[0] && tabs[0].classList.remove('active');
        tabs[1] && tabs[1].classList.add('active');

        show(nameGroup); show(genderGroup); show(emailGroup); show(passwordGroup);

        if (submitBtn) submitBtn.textContent = 'Create Account';
        if (title)    title.textContent = 'Create Account';
        if (subtitle) subtitle.textContent = 'Sign up to start visualizing code';
        if (footer)   footer.innerHTML = 'Already have an account? <a onclick="switchAuthTab(\'login\')">Login</a>';

    } else if (tab === 'forgot-request') {
        hide(tabsContainer);
        show(emailGroup); hide(passwordGroup);
        var emailInput = document.getElementById('authEmail');
        if (emailInput) emailInput.value = '';

        if (submitBtn) submitBtn.textContent = 'Send Code';
        if (title)    title.textContent = 'Reset Password';
        if (subtitle) subtitle.textContent = 'Enter your email — we\'ll send a verification code';
        if (footer)   footer.innerHTML = '<a onclick="switchAuthTab(\'login\')">\u2190 Back to login</a>';

    } else if (tab === 'forgot-verify') {
        hide(tabsContainer);
        hide(emailGroup); hide(passwordGroup);
        show(otpGroup);

        var hint = document.getElementById('authOtpEmailHint');
        if (hint) hint.textContent = forgotEmail;

        var otpInput = document.getElementById('authOtp');
        if (otpInput) otpInput.value = '';

        startOtpCountdown(10);

        if (submitBtn) submitBtn.textContent = 'Verify Code';
        if (title)    title.textContent = 'Check Your Email';
        if (subtitle) subtitle.textContent = 'Enter the 6-digit code we sent you';
        if (footer)   footer.innerHTML = '<a onclick="switchAuthTab(\'forgot-request\')">\u2190 Try a different email</a>';

    } else if (tab === 'forgot-password') {
        hide(tabsContainer);
        show(newPwGroup); show(confirmPwGrp);

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

function switchToForgotPassword() {
    switchAuthTab('forgot-request');
}

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

    var response = await smartFetch(API_URL + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password })
    });

    var data = await response.json();

    if (!data.success) {
        showAuthError(data.message);
        return;
    }

    localStorage.setItem('codelens-token', data.token);
    localStorage.setItem('codelens-user', JSON.stringify(data.user));

    setLoggedInState(data.user);
    closeAuthModal();
}

async function handleRegister() {
    var name = document.getElementById('authName').value.trim();
    var email = document.getElementById('authEmail').value.trim();
    var password = document.getElementById('authPassword').value;
    var genderEl = document.querySelector('input[name="authGender"]:checked');
    var gender = genderEl ? genderEl.value : 'male';

    if (!name || !email || !password) {
        showAuthError('Please fill in all fields');
        return;
    }

    if (name.length < 2) {
        showAuthError('Name must be at least 2 characters');
        return;
    }

    if (!fullNamePattern.test(name)) {
        showAuthError('Name can contain only letters and single spaces between words');
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

    var response = await smartFetch(API_URL + '/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, email: email, password: password, gender: gender })
    });

    var data = await response.json();

    if (!data.success) {
        showAuthError(data.message);
        return;
    }

    localStorage.setItem('codelens-token', data.token);
    localStorage.setItem('codelens-user', JSON.stringify(data.user));

    setLoggedInState(data.user);
    closeAuthModal();
}

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

    var response = await smartFetch(API_URL + '/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email })
    });

    var data = await response.json();

    if (!data.success) {
        showAuthError(data.message);
        return;
    }

    forgotEmail = email;

    switchAuthTab('forgot-verify');
    showAuthSuccess('Code sent! Check your inbox (and spam folder).');
}

async function handleVerifyOtp() {
    var otp = (document.getElementById('authOtp').value || '').trim();

    if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
        showAuthError('Please enter the 6-digit code from your email');
        return;
    }

    var response = await smartFetch(API_URL + '/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, otp: otp })
    });

    var data = await response.json();

    if (!data.success) {
        showAuthError(data.message);
        return;
    }
    forgotOtp = otp;
    clearOtpCountdown();

    switchAuthTab('forgot-password');
    showAuthSuccess('Identity verified! Set your new password below.');
}

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

    var response = await smartFetch(API_URL + '/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, otp: forgotOtp, newPassword: newPassword })
    });

    var data = await response.json();

    if (!data.success) {
        showAuthError(data.message);
        return;
    }

    forgotEmail = '';
    forgotOtp   = '';

    switchAuthTab('login');
    showAuthSuccess(data.message || 'Password reset successfully! Please log in.');
}

async function handleResendOtp() {
    if (!forgotEmail) return;

    var resendBtn = document.getElementById('authOtpResendBtn');
    if (resendBtn) resendBtn.disabled = true;

    clearAuthError();
    clearAuthSuccess();

    try {
        var response = await smartFetch(API_URL + '/auth/forgot-password', {
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

// Set UI to logged-in state
function setLoggedInState(user) {
    isLoggedIn = true;
    currentUser = user;

    var loginBtns = document.querySelectorAll('.login-btn');
    loginBtns.forEach(function(btn) {
        btn.style.display = 'none';
    });

    var profileBtns = document.querySelectorAll('.profile-btn');
    profileBtns.forEach(function(btn) {
        btn.classList.add('show');
    });

    updateHeaderAvatars(user);
    updateHeaderProfileInfo(user);

    var adminLinks = document.querySelectorAll('.admin-only-link');
    adminLinks.forEach(function(link) {
        link.style.display = user.role === 'admin' ? '' : 'none';
    });

    var testerLinks = document.querySelectorAll('.tester-only-link');
    testerLinks.forEach(function(link) {
        link.style.display = user.role === 'tester' ? '' : 'none';
    });

    if (window._P && typeof window._P.updateGuestRunBadge === 'function') {
        window._P.updateGuestRunBadge();
    }
}

// Set UI to logged-out state
function setLoggedOutState() {
    isLoggedIn = false;
    currentUser = null;

    var loginBtns = document.querySelectorAll('.login-btn');
    loginBtns.forEach(function(btn) {
        btn.style.display = '';
    });

    var profileBtns = document.querySelectorAll('.profile-btn');
    profileBtns.forEach(function(btn) {
        btn.classList.remove('show');
    });

    var adminLinks = document.querySelectorAll('.admin-only-link');
    adminLinks.forEach(function(link) {
        link.style.display = 'none';
    });

    var testerLinks = document.querySelectorAll('.tester-only-link');
    testerLinks.forEach(function(link) {
        link.style.display = 'none';
    });
}

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

    if (window.lucide) {
        lucide.createIcons();
    }
}

document.addEventListener('DOMContentLoaded', function() {

    var loginBtns = document.querySelectorAll('.login-btn');
    loginBtns.forEach(function(btn) {
        btn.addEventListener('click', openAuthModal);
    });

    var closeBtn = document.querySelector('.auth-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeAuthModal);
    }

    var overlay = document.getElementById('authOverlay');
    if (overlay) {
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                closeAuthModal();
            }
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAuthModal();
            closeProfileDropdown();
        }
    });

    var tabs = document.querySelectorAll('.auth-tab');
    tabs.forEach(function(tab, index) {
        tab.addEventListener('click', function() {
            switchAuthTab(index === 0 ? 'login' : 'signup');
        });
    });

    var form = document.getElementById('authForm');
    if (form) {
        form.addEventListener('submit', handleAuthSubmit);
    }

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

    var logoutBtns = document.querySelectorAll('.logout-btn');
    logoutBtns.forEach(function(btn) {
        btn.addEventListener('click', handleLogout);
    });

    var savedToken = localStorage.getItem('codelens-token');
    var savedUser = localStorage.getItem('codelens-user');

    if (savedToken && savedUser) {
        try {
            var user = JSON.parse(savedUser);
            if (user && typeof user.name === 'string' && typeof user.email === 'string') {
                setLoggedInState(user);
            } else {
                localStorage.removeItem('codelens-token');
                localStorage.removeItem('codelens-user');
            }
        } catch (e) {
            localStorage.removeItem('codelens-token');
            localStorage.removeItem('codelens-user');
        }
    }
});
