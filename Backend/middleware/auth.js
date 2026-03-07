/* ============================================
   Auth Middleware — JWT Token Verification
   Extracts Bearer token from Authorization header,
   verifies signature, and attaches the User document
   to req.user for downstream route handlers.
   Returns 401 on missing/expired/invalid tokens.
   ============================================ */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function authMiddleware(req, res, next) {
    let token = null;

    // Check for token in Authorization header
    // Format: "Bearer <token>"
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    // If no token found, return error
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized - No token provided'
        });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Find user by ID from token and attach to request
        req.user = await User.findById(decoded.id).select('name email role avatar createdAt');

        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized - User not found'
            });
        }

        next();
    } catch (err) {
        const message = err.name === 'TokenExpiredError'
            ? 'Not authorized - Token expired'
            : 'Not authorized - Invalid token';
        return res.status(401).json({ success: false, message: message });
    }
}

module.exports = authMiddleware;
