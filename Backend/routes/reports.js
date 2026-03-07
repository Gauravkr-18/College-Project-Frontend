/* ============================================
   Report Routes — Submit & Manage Reports
   POST   /api/reports           — Submit a report (auth optional)
   GET    /api/reports           — List reports (admin only, paginated + filters)
   GET    /api/reports/stats     — Report summary stats (admin only)
   PATCH  /api/reports/:id       — Update report status (admin only)
   DELETE /api/reports/:id       — Delete a report (admin only)
   ============================================ */

const express = require('express');
const Report = require('../models/Report');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const { adminOrTesterMiddleware } = require('../middleware/admin');

const router = express.Router();

/* ---- SUBMIT REPORT ----
   POST /api/reports
   Auth optional — logged-in users get userId attached
*/
router.post('/', async function(req, res) {
    try {
        // Try to extract user from token (optional)
        var userId = null;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            try {
                var jwt = require('jsonwebtoken');
                var token = req.headers.authorization.split(' ')[1];
                var decoded = jwt.verify(token, process.env.JWT_SECRET);
                userId = decoded.id;
            } catch (_) {}
        }

        var body = req.body;
        var description = (body.description || '').trim();
        if (!description) {
            return res.status(400).json({ success: false, message: 'Description is required' });
        }
        if (description.length > 500) {
            return res.status(400).json({ success: false, message: 'Description too long' });
        }

        var allowedCategories = ['incorrect_visualization', 'wrong_variable_value', 'missing_step', 'wrong_line_highlight', 'ui_glitch', 'other'];
        var category = allowedCategories.includes(body.category) ? body.category : 'other';

        var report = await Report.create({
            userId: userId,
            language: (body.language || '').substring(0, 50),
            exampleTitle: (body.exampleTitle || '').substring(0, 200),
            step: (body.step || '').substring(0, 30),
            line: (body.line || '').substring(0, 20),
            dataSegment: (body.dataSegment || '').substring(0, 50),
            visType: (body.visType || '').substring(0, 50),
            category: category,
            description: description
        });

        res.status(201).json({ success: true, reportId: report._id });
    } catch (err) {
        console.error('Submit Report Error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/* ---- LIST REPORTS (admin or tester) ----
   GET /api/reports?page=1&limit=20&status=open&category=&search=
*/
router.get('/', authMiddleware, adminOrTesterMiddleware, async function(req, res) {
    try {
        var page = Math.max(1, parseInt(req.query.page) || 1);
        var limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
        var skip = (page - 1) * limit;

        var filter = {};
        if (req.query.status && req.query.status !== 'all') {
            filter.status = req.query.status;
        }
        if (req.query.category && req.query.category !== 'all') {
            filter.category = req.query.category;
        }
        if (req.query.language && req.query.language !== 'all') {
            filter.language = req.query.language;
        }
        if (req.query.exampleTitle && req.query.exampleTitle !== 'all') {
            filter.exampleTitle = req.query.exampleTitle;
        }
        if (req.query.search) {
            var searchRegex = new RegExp(req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [
                { exampleTitle: searchRegex },
                { description: searchRegex },
                { language: searchRegex }
            ];
        }
        var sortOrder = req.query.sort === 'oldest' ? 1 : -1;

        var [reports, total] = await Promise.all([
            Report.find(filter)
                .populate('userId', 'name email avatar')
                .sort({ createdAt: sortOrder })
                .skip(skip)
                .limit(limit)
                .lean(),
            Report.countDocuments(filter)
        ]);

        res.json({
            success: true,
            count: total,
            page: page,
            totalPages: Math.ceil(total / limit),
            reports: reports.map(function(r) {
                return {
                    id: r._id,
                    user: r.userId ? { name: r.userId.name, email: r.userId.email, avatar: r.userId.avatar } : null,
                    language: r.language,
                    exampleTitle: r.exampleTitle,
                    step: r.step,
                    line: r.line,
                    dataSegment: r.dataSegment,
                    visType: r.visType,
                    category: r.category,
                    description: r.description,
                    status: r.status,
                    createdAt: r.createdAt
                };
            })
        });
    } catch (err) {
        console.error('List Reports Error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/* ---- REPORT STATS (admin or tester) ----
   GET /api/reports/stats
*/
router.get('/stats', authMiddleware, adminOrTesterMiddleware, async function(req, res) {
    try {
        var result = await Report.aggregate([
            {
                $facet: {
                    total: [{ $count: 'count' }],
                    open: [{ $match: { status: 'open' } }, { $count: 'count' }],
                    inProgress: [{ $match: { status: 'in_progress' } }, { $count: 'count' }],
                    resolved: [{ $match: { status: 'resolved' } }, { $count: 'count' }],
                    dismissed: [{ $match: { status: 'dismissed' } }, { $count: 'count' }],
                    byCategory: [
                        { $group: { _id: '$category', count: { $sum: 1 } } },
                        { $sort: { count: -1 } }
                    ],
                    byExample: [
                        { $group: { _id: '$exampleTitle', count: { $sum: 1 } } },
                        { $sort: { count: -1 } },
                        { $limit: 10 }
                    ],
                    byLanguage: [
                        { $group: { _id: '$language', count: { $sum: 1 } } },
                        { $sort: { count: -1 } }
                    ]
                }
            }
        ]);

        var data = result[0];
        var getCount = function(arr) { return arr.length > 0 ? arr[0].count : 0; };

        res.json({
            success: true,
            stats: {
                total: getCount(data.total),
                open: getCount(data.open),
                inProgress: getCount(data.inProgress),
                resolved: getCount(data.resolved),
                dismissed: getCount(data.dismissed),
                byCategory: data.byCategory,
                byExample: data.byExample,
                byLanguage: data.byLanguage
            }
        });
    } catch (err) {
        console.error('Report Stats Error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/* ---- UPDATE REPORT STATUS (admin or tester) ----
   PATCH /api/reports/:id
   Body: { status: 'open'|'in_progress'|'resolved'|'dismissed' }
*/
router.patch('/:id', authMiddleware, adminOrTesterMiddleware, async function(req, res) {
    try {
        var allowedStatuses = ['open', 'in_progress', 'resolved', 'dismissed'];
        if (!allowedStatuses.includes(req.body.status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        var report = await Report.findByIdAndUpdate(
            req.params.id,
            { status: req.body.status },
            { new: true }
        );

        if (!report) {
            return res.status(404).json({ success: false, message: 'Report not found' });
        }

        res.json({ success: true, status: report.status });
    } catch (err) {
        console.error('Update Report Error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/* ---- DELETE REPORT (admin or tester) ----
   DELETE /api/reports/:id
*/
router.delete('/:id', authMiddleware, adminOrTesterMiddleware, async function(req, res) {
    try {
        var report = await Report.findByIdAndDelete(req.params.id);
        if (!report) {
            return res.status(404).json({ success: false, message: 'Report not found' });
        }
        res.json({ success: true, message: 'Report deleted' });
    } catch (err) {
        console.error('Delete Report Error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
