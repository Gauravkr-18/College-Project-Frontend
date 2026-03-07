/* ============================================
   Admin Routes — User Management & Analytics
   GET    /api/admin/users      — List users (paginated, with view counts)
   GET    /api/admin/stats      — Dashboard analytics (users + executions)
   DELETE /api/admin/users/:id  — Delete user + their analytics

   All routes require auth + admin role.
   Stats use $facet aggregation; User + Analytics
   pipelines run in parallel via Promise.all.
   ============================================ */

const express = require('express');
const User = require('../models/User');
const Analytics = require('../models/Analytics');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

const router = express.Router();

// Apply auth + admin middleware to all admin routes
router.use(authMiddleware);
router.use(adminMiddleware);

/* ---- GET ALL USERS ----
   GET /api/admin/users?page=1&limit=50
   Returns: { success, count, users }
*/
router.get('/users', async function(req, res) {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
        const skip = (page - 1) * limit;

        const [users, total] = await Promise.all([
            User.find()
                .select('name email role avatar createdAt')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            User.countDocuments()
        ]);

        // Get example view counts per user
        const userIds = users.map(function(u) { return u._id; });
        const viewCounts = await Analytics.aggregate([
            { $match: { userId: { $in: userIds } } },
            { $group: { _id: '$userId', count: { $sum: 1 } } }
        ]);
        const viewMap = {};
        viewCounts.forEach(function(v) { viewMap[v._id.toString()] = v.count; });

        res.json({
            success: true,
            count: total,
            page: page,
            totalPages: Math.ceil(total / limit),
            users: users.map(function(user) {
                return {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    avatar: user.avatar,
                    createdAt: user.createdAt,
                    examplesViewed: viewMap[user._id.toString()] || 0
                };
            })
        });

    } catch (err) {
        console.error('Get Users Error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error - Please try again'
        });
    }
});

/* ---- GET STATS ----
   GET /api/admin/stats
   Returns: { success, stats }
   Optimized: single aggregation pipeline instead of 5 queries
*/
router.get('/stats', async function(req, res) {
    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
        if (weekStart > todayStart) {
            weekStart.setDate(weekStart.getDate() - 7);
        }

        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // Run User and Analytics aggregations in parallel (independent queries)
        var [result, execResult] = await Promise.all([
            User.aggregate([
                {
                    $facet: {
                        totalUsers: [{ $count: 'count' }],
                        totalAdmins: [
                            { $match: { role: 'admin' } },
                            { $count: 'count' }
                        ],
                        totalTesters: [
                            { $match: { role: 'tester' } },
                            { $count: 'count' }
                        ],
                        newToday: [
                            { $match: { createdAt: { $gte: todayStart } } },
                            { $count: 'count' }
                        ],
                        newThisWeek: [
                            { $match: { createdAt: { $gte: weekStart } } },
                            { $count: 'count' }
                        ],
                        newThisMonth: [
                            { $match: { createdAt: { $gte: monthStart } } },
                            { $count: 'count' }
                        ]
                    }
                }
            ]),
            Analytics.aggregate([
                {
                    $facet: {
                        today: [
                            { $match: { timestamp: { $gte: todayStart } } },
                            { $count: 'count' }
                        ],
                        thisMonth: [
                            { $match: { timestamp: { $gte: monthStart } } },
                            { $count: 'count' }
                        ],
                        total: [{ $count: 'count' }]
                    }
                }
            ])
        ]);

        const data = result[0];
        const execData = execResult[0];
        const getCount = function(arr) { return arr.length > 0 ? arr[0].count : 0; };

        res.json({
            success: true,
            stats: {
                totalUsers: getCount(data.totalUsers),
                totalAdmins: getCount(data.totalAdmins),
                totalTesters: getCount(data.totalTesters),
                newToday: getCount(data.newToday),
                newThisWeek: getCount(data.newThisWeek),
                newThisMonth: getCount(data.newThisMonth),
                executionsToday: getCount(execData.today),
                executionsThisMonth: getCount(execData.thisMonth),
                totalExecutions: getCount(execData.total)
            }
        });

    } catch (err) {
        console.error('Get Stats Error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error - Please try again'
        });
    }
});

/* ---- CHANGE USER ROLE ----
   PATCH /api/admin/users/:id/role
   Body: { role: 'user'|'admin'|'tester' }
   Cannot change your own role
*/
router.patch('/users/:id/role', async function(req, res) {
    try {
        const targetId = req.params.id;
        const { role } = req.body;

        const allowedRoles = ['user', 'admin', 'tester'];
        if (!role || !allowedRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role. Allowed: user, admin, tester'
            });
        }

        // Cannot change own role
        if (targetId === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'You cannot change your own role'
            });
        }

        const user = await User.findByIdAndUpdate(
            targetId,
            { role: role },
            { new: true }
        ).select('name email role avatar createdAt');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'Role updated successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (err) {
        console.error('Change Role Error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error - Please try again'
        });
    }
});

/* ---- DELETE USER ----
   DELETE /api/admin/users/:id
   Cannot delete your own account
*/
router.delete('/users/:id', async function(req, res) {
    try {
        const targetId = req.params.id;

        // Cannot delete self
        if (targetId === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'You cannot delete your own account'
            });
        }

        const user = await User.findByIdAndDelete(targetId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Also remove user's analytics data
        await Analytics.deleteMany({ userId: targetId });

        res.json({
            success: true,
            message: 'User deleted successfully'
        });

    } catch (err) {
        console.error('Delete User Error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error - Please try again'
        });
    }
});

module.exports = router;
