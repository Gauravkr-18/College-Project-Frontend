/* ============================================
   Report Model — Visualization Issue Reports
   Records reports from users about visualization
   issues in examples.
   Fields: userId, language, exampleTitle, step, line,
           dataSegment, visType, category, description,
           status, createdAt
   ============================================ */

const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    language: {
        type: String,
        default: ''
    },
    exampleTitle: {
        type: String,
        default: ''
    },
    step: {
        type: String,
        default: ''
    },
    line: {
        type: String,
        default: ''
    },
    dataSegment: {
        type: String,
        default: ''
    },
    visType: {
        type: String,
        default: ''
    },
    category: {
        type: String,
        enum: ['incorrect_visualization', 'wrong_variable_value', 'missing_step', 'wrong_line_highlight', 'ui_glitch', 'other'],
        default: 'other'
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    status: {
        type: String,
        enum: ['open', 'in_progress', 'resolved', 'dismissed'],
        default: 'open'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Indexes for admin queries
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ category: 1 });
reportSchema.index({ exampleTitle: 1 });
reportSchema.index({ createdAt: -1 });

const Report = mongoose.model('Report', reportSchema);
module.exports = Report;
