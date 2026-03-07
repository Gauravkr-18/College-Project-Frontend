/* ============================================
   Admin Middleware — Role-Based Access Control
   Must be chained AFTER auth middleware.
   adminMiddleware:  req.user.role === 'admin'
   adminOrTesterMiddleware: req.user.role === 'admin' or 'tester'
   ============================================ */

function adminMiddleware(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Access denied - Admin only'
        });
    }
    next();
}

function adminOrTesterMiddleware(req, res, next) {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'tester')) {
        return res.status(403).json({
            success: false,
            message: 'Access denied - Admin or Tester only'
        });
    }
    next();
}

module.exports = adminMiddleware;
module.exports.adminOrTesterMiddleware = adminOrTesterMiddleware;
