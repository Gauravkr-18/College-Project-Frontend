/* ============================================
   Auth Routes — Registration, Login, Profile, Password Reset
   POST /api/auth/register         — Create account
   POST /api/auth/login            — Authenticate, return JWT
   GET  /api/auth/me               — Get current user profile
   PUT  /api/auth/me               — Update name / avatar
   POST /api/auth/upload-avatar    — Upload cropped avatar image
   POST /api/auth/forgot-password  — Send 6-digit OTP to email
   POST /api/auth/verify-otp       — Verify OTP code
   POST /api/auth/reset-password   — Reset password after OTP verified

   Security:
     • Password 6–128 chars (upper bound prevents bcrypt DoS)
     • Avatar: .jpg/.jpeg/.png/.gif/.webp, max 2 MB
     • Path traversal blocked on avatar values
     • Old uploaded avatars cleaned up on replacement
     • OTP hashed with SHA-256 before storage (select:false fields)
     • OTP expires in 10 min; reset window 5 min after verification
     • Forgot-password endpoint returns same response for unknown emails
     • Dedicated rate limiter: 8 req/15min for OTP/reset endpoints
   ============================================ */

const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ---- OTP-specific rate limiter: 8 attempts per 15 minutes per IP ----
const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 8,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many OTP requests. Please try again in 15 minutes.' }
});

// ---- Multer setup for avatar uploads ----
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, path.join(__dirname, '..', 'Data', 'Avatar', 'uploads'));
    },
    filename: function(req, file, cb) {
        const ext = path.extname(file.originalname).toLowerCase();
        const uniqueName = 'avatar-' + req.user._id + '-' + Date.now() + ext;
        cb(null, uniqueName);
    }
});

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const MAX_NAME_LENGTH = 50;

const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
    fileFilter: function(req, file, cb) {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ALLOWED_EXTENSIONS.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// ---- Nodemailer transporter (lazy-created per request) ----
function createEmailTransporter() {
    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_PORT === '465',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
}

// Send OTP to user email
async function sendOtpEmail(toEmail, userName, otp) {
    const transporter = createEmailTransporter();
    const firstName = (userName || 'there').split(' ')[0];

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0ea5e9 0%,#a855f7 100%);padding:32px;text-align:center">
          <p style="color:#fff;font-size:26px;font-weight:800;margin:0;letter-spacing:-0.5px">Code<span style="color:#e0f2fe">Lens</span></p>
          <p style="color:rgba(255,255,255,0.8);font-size:13px;margin:4px 0 0">Password Reset</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:36px 32px">
          <p style="color:#e2e8f0;font-size:16px;margin:0 0 8px">Hi <strong>${firstName}</strong>,</p>
          <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 28px">We received a request to reset your CodeLens password. Use the verification code below:</p>
          <!-- OTP Box -->
          <div style="background:#0f172a;border:2px solid #0ea5e9;border-radius:12px;padding:28px;text-align:center;margin-bottom:28px">
            <p style="color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 12px">Your Verification Code</p>
            <p style="color:#0ea5e9;font-size:44px;font-weight:800;letter-spacing:12px;margin:0;font-family:monospace">${otp}</p>
            <p style="color:#64748b;font-size:12px;margin:12px 0 0">Expires in <strong style="color:#f59e0b">10 minutes</strong></p>
          </div>
          <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0">If you didn&rsquo;t request a password reset, you can safely ignore this email. Your password will not be changed.</p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 32px;border-top:1px solid #334155;text-align:center">
          <p style="color:#475569;font-size:12px;margin:0">CodeLens &mdash; Final Year Project &bull; Do not reply to this email</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await transporter.sendMail({
        from: process.env.EMAIL_FROM || `"CodeLens" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: `${otp} — CodeLens password reset code`,
        text: `Hi ${firstName},\n\nYour CodeLens password reset code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, ignore this email.\n\n— CodeLens Team`,
        html: html
    });
}

// Helper: Generate JWT Token
function generateToken(userId) {
    return jwt.sign(
        { id: userId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
}

// Helper: Format user response (uses model's toPublicJSON)
function userResponse(user) {
    return typeof user.toPublicJSON === 'function'
        ? user.toPublicJSON()
        : { id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar, createdAt: user.createdAt };
}

/* ---- REGISTER ----
   POST /api/auth/register
   Body: { name, email, password }
   Returns: { success, token, user }
*/
router.post('/register', async function(req, res) {
    try {
        const { name, email, password } = req.body;

        // Validate required fields
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide name, email and password'
            });
        }

        // Sanitize and validate name length
        const trimmedName = name.trim();
        if (trimmedName.length < 2 || trimmedName.length > MAX_NAME_LENGTH) {
            return res.status(400).json({
                success: false,
                message: 'Name must be between 2 and ' + MAX_NAME_LENGTH + ' characters'
            });
        }

        // Validate password length (upper bound prevents bcrypt DoS with very long inputs)
        if (password.length < 6 || password.length > 128) {
            return res.status(400).json({
                success: false,
                message: 'Password must be between 6 and 128 characters'
            });
        }

        // Validate email format
        if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid email address'
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.trim() });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email is already registered'
            });
        }

        // Create new user
        const user = await User.create({ name: trimmedName, email: email.trim(), password });

        // Generate token
        const token = generateToken(user._id);

        // Send response
        res.status(201).json({
            success: true,
            token: token,
            user: userResponse(user)
        });

    } catch (err) {
        // Handle validation errors
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(function(e) {
                return e.message;
            });
            return res.status(400).json({
                success: false,
                message: messages[0]
            });
        }

        console.error('Register Error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error - Please try again'
        });
    }
});

/* ---- LOGIN ----
   POST /api/auth/login
   Body: { email, password }
   Returns: { success, token, user }
*/
router.post('/login', async function(req, res) {
    try {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        // Reject excessively long passwords to prevent bcrypt DoS
        if (password.length > 128) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Find user by email (include password field)
        const user = await User.findOne({ email: email }).select('+password');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check if password matches
        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Generate token
        const token = generateToken(user._id);

        // Send response
        res.json({
            success: true,
            token: token,
            user: userResponse(user)
        });

    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error - Please try again'
        });
    }
});

/* ---- GET CURRENT USER ----
   GET /api/auth/me
   Headers: Authorization: Bearer <token>
   Returns: { success, user }
*/
router.get('/me', authMiddleware, async function(req, res) {
    try {
        // User is already attached by authMiddleware
        res.json({
            success: true,
            user: userResponse(req.user)
        });

    } catch (err) {
        console.error('Get Profile Error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error - Please try again'
        });
    }
});

/* ---- UPDATE PROFILE ----
   PUT /api/auth/me
   Headers: Authorization: Bearer <token>
   Body: { name }
   Returns: { success, user }
*/
router.put('/me', authMiddleware, async function(req, res) {
    try {
        const { name, avatar } = req.body;

        // Update name if provided
        if (name !== undefined) {
            if (!name || name.trim().length < 2) {
                return res.status(400).json({
                    success: false,
                    message: 'Name must be at least 2 characters'
                });
            }
            if (name.trim().length > MAX_NAME_LENGTH) {
                return res.status(400).json({
                    success: false,
                    message: 'Name cannot exceed ' + MAX_NAME_LENGTH + ' characters'
                });
            }
            req.user.name = name.trim();
        }

        // Update avatar if provided
        if (avatar !== undefined) {
            // Validate avatar value (preset 1-5 or uploads/ path)
            // Ensure no path traversal in uploads path
            if (avatar && !/^[1-5]$/.test(avatar) && !avatar.startsWith('uploads/')) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid avatar value'
                });
            }
            if (avatar && avatar.includes('..')) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid avatar path'
                });
            }
            req.user.avatar = avatar;
        }

        await req.user.save();

        res.json({
            success: true,
            user: userResponse(req.user)
        });

    } catch (err) {
        console.error('Update Profile Error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error - Please try again'
        });
    }
});

/* ---- UPLOAD AVATAR ----
   POST /api/auth/upload-avatar
   Headers: Authorization: Bearer <token>
   Body: FormData with 'avatar' file
   Returns: { success, avatar }
*/
router.post('/upload-avatar', authMiddleware, function(req, res) {
    upload.single('avatar')(req, res, async function(err) {
        if (err) {
            var message = err.message || 'Upload failed';
            if (err.code === 'LIMIT_FILE_SIZE') {
                message = 'File size must be less than 2MB';
            }
            return res.status(400).json({ success: false, message: message });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        try {
            // Delete old uploaded avatar file if replacing with a new upload
            var oldAvatar = req.user.avatar;
            if (oldAvatar && oldAvatar.startsWith('uploads/')) {
                var oldPath = path.join(__dirname, '..', 'Data', 'Avatar', oldAvatar);
                fs.unlink(oldPath, function(unlinkErr) {
                    if (unlinkErr && unlinkErr.code !== 'ENOENT') {
                        console.error('Failed to delete old avatar:', unlinkErr.message);
                    }
                });
            }

            // Save avatar path as "uploads/filename.ext"
            const avatarPath = 'uploads/' + req.file.filename;
            req.user.avatar = avatarPath;
            await req.user.save();

            res.json({
                success: true,
                avatar: avatarPath,
                user: userResponse(req.user)
            });
        } catch (uploadErr) {
            console.error('Upload Avatar Error:', uploadErr);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    });
});

/* ---- FORGOT PASSWORD ----
   POST /api/auth/forgot-password
   Body: { email }
   Generates a 6-digit OTP, hashes it, stores with 10-min expiry, sends email.
   Always returns 200 to prevent email enumeration.
*/
router.post('/forgot-password', otpLimiter, async function(req, res) {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Please provide your email address' });
        }

        if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
            return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
        }

        const user = await User.findOne({ email: email.trim().toLowerCase() })
            .select('+resetOtp +resetOtpExpires +resetOtpVerified');

        if (user) {
            // Generate 6-digit OTP
            const otp = String(crypto.randomInt(100000, 1000000));

            // Hash before storing (SHA-256 is fast and sufficient for short-lived OTPs)
            const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

            user.resetOtp = otpHash;
            user.resetOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
            user.resetOtpVerified = false;
            await user.save({ validateBeforeSave: false });

            // Fire-and-forget — don't let email failure block the response
            sendOtpEmail(user.email, user.name, otp).catch(function(emailErr) {
                console.error('OTP Email Error:', emailErr.message);
            });
        }

        // Same response whether email exists or not (prevents email enumeration)
        res.json({
            success: true,
            message: 'If this email is registered, a verification code has been sent to it'
        });

    } catch (err) {
        console.error('Forgot Password Error:', err);
        res.status(500).json({ success: false, message: 'Server error — please try again' });
    }
});

/* ---- VERIFY OTP ----
   POST /api/auth/verify-otp
   Body: { email, otp }
   Validates the 6-digit OTP and marks it as verified.
*/
router.post('/verify-otp', otpLimiter, async function(req, res) {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ success: false, message: 'Email and verification code are required' });
        }

        const user = await User.findOne({ email: email.trim().toLowerCase() })
            .select('+resetOtp +resetOtpExpires +resetOtpVerified');

        if (!user || !user.resetOtp || !user.resetOtpExpires) {
            return res.status(400).json({ success: false, message: 'Invalid or expired code. Please request a new one.' });
        }

        // Check expiry
        if (user.resetOtpExpires < new Date()) {
            return res.status(400).json({ success: false, message: 'Code has expired. Please request a new one.' });
        }

        // Compare hash
        const incomingHash = crypto.createHash('sha256').update(otp.toString().trim()).digest('hex');
        if (incomingHash !== user.resetOtp) {
            return res.status(400).json({ success: false, message: 'Incorrect code. Please check and try again.' });
        }

        // Mark verified; give 5-minute window to submit new password
        user.resetOtpVerified = true;
        user.resetOtpExpires = new Date(Date.now() + 5 * 60 * 1000);
        await user.save({ validateBeforeSave: false });

        res.json({ success: true, message: 'Code verified! Please set your new password.' });

    } catch (err) {
        console.error('Verify OTP Error:', err);
        res.status(500).json({ success: false, message: 'Server error — please try again' });
    }
});

/* ---- RESET PASSWORD ----
   POST /api/auth/reset-password
   Body: { email, otp, newPassword }
   Validates OTP hash + verified flag, then resets password.
*/
router.post('/reset-password', otpLimiter, async function(req, res) {
    try {
        const { email, otp, newPassword } = req.body;

        if (!email || !otp || !newPassword) {
            return res.status(400).json({ success: false, message: 'Email, code and new password are required' });
        }

        // Validate password length (same rules as register)
        if (newPassword.length < 6 || newPassword.length > 128) {
            return res.status(400).json({ success: false, message: 'Password must be between 6 and 128 characters' });
        }

        const user = await User.findOne({ email: email.trim().toLowerCase() })
            .select('+password +resetOtp +resetOtpExpires +resetOtpVerified');

        if (!user || !user.resetOtp || !user.resetOtpExpires) {
            return res.status(400).json({ success: false, message: 'Invalid or expired reset session. Please start over.' });
        }

        if (!user.resetOtpVerified) {
            return res.status(400).json({ success: false, message: 'Please verify your code first' });
        }

        if (user.resetOtpExpires < new Date()) {
            return res.status(400).json({ success: false, message: 'Reset session expired. Please start over.' });
        }

        // Re-verify OTP hash to prevent tampering
        const incomingHash = crypto.createHash('sha256').update(otp.toString().trim()).digest('hex');
        if (incomingHash !== user.resetOtp) {
            return res.status(400).json({ success: false, message: 'Invalid reset session. Please start over.' });
        }

        // Update password — pre-save hook will bcrypt-hash it
        user.password = newPassword;
        user.resetOtp = undefined;
        user.resetOtpExpires = undefined;
        user.resetOtpVerified = false;
        await user.save();

        res.json({ success: true, message: 'Password reset successfully! You can now log in.' });

    } catch (err) {
        console.error('Reset Password Error:', err);
        res.status(500).json({ success: false, message: 'Server error — please try again' });
    }
});

module.exports = router;
