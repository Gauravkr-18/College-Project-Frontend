/* ============================================
   Analytics Model — Example View Tracking
   Records what example each user viewed, when.
   Supports both authenticated and guest users.
   Fields: userId, title, lang, type, timestamp
   ============================================ */

const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null  // null for guest users, ObjectId for logged-in users
    },
    title: {
        type: String,
        default: ''    // example title, e.g. "Hello World"
    },
    lang: {
        type: String,
        default: ''    // language key, e.g. "c", "cpp", "python"
    },
    type: {
        type: String,
        default: ''    // example type, e.g. "stack", "ds"
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

// Indexes for fast aggregation queries
analyticsSchema.index({ userId: 1 });
analyticsSchema.index({ timestamp: -1 });
analyticsSchema.index({ userId: 1, timestamp: -1 });
// Auto-delete records older than 90 days to keep collection lean
analyticsSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const Analytics = mongoose.model('Analytics', analyticsSchema);
module.exports = Analytics;
