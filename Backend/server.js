/* ============================================
   CodeLens Backend — Main Server Entry Point
   Express 5 + MongoDB + JWT Authentication

   Middleware stack (in order):
     1. Helmet — HTTP security headers
     2. Compression — gzip responses
     3. Morgan — request logging (dev mode)
     4. JSON/URL body parsers (1 MB limit)
     5. CORS — configurable allowed origins
     6. Rate limiters — 100 req/15min general, 20/15min auth

   Routes:
     /api/auth      — Register, login, profile, avatar upload
     /api/examples  — Lazy-load examples list + single item
     /api/admin     — User management + dashboard stats
     /api/health    — Health check
     /avatars/*     — Static avatar images (1d cache)
     /examples/*    — Static example files (1h cache, legacy)

   Graceful shutdown on SIGTERM/SIGINT with 10s timeout.
   ============================================ */

const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

// Create Express app
const app = express();

// ---- Security Middleware ----

// HTTP security headers (XSS protection, content-type sniffing, etc.)
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' } // Allow avatar images cross-origin
}));

// Gzip compression for responses
app.use(compression());

// Request logging (dev format for development)
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
}

// Parse JSON request body (limit payload size)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// CORS - allow frontend origins
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5500,http://127.0.0.1:5500')
    .split(',')
    .map(function(s) { return s.trim(); });

app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// ---- Rate Limiting ----

// General API rate limit: 100 requests per 15 minutes per IP
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later' }
});

// Stricter limit for auth routes: 20 attempts per 15 minutes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many login attempts, please try again later' }
});

// ---- Static Files ----

// Serve avatar images with caching headers
app.use('/avatars', express.static(path.join(__dirname, 'Data', 'Avatar'), {
    maxAge: '1d',
    etag: true
}));

// Example lazy-load API (meta-only list + single-item fetch)
app.use('/api/examples', apiLimiter, require('./routes/examples'));

// Serve example data files (legacy static, kept as fallback)
app.use('/examples', express.static(path.join(__dirname, 'Data', 'Examples'), {
    maxAge: '1h',
    etag: true
}));

// ---- Routes ----

// Auth routes (login, register, profile) — with stricter rate limit
app.use('/api/auth', authLimiter, require('./routes/auth'));

// Admin routes (user management, analytics) — with general rate limit
app.use('/api/admin', apiLimiter, require('./routes/admin'));

// Report routes (submit + admin management) — with general rate limit
app.use('/api/reports', apiLimiter, require('./routes/reports'));

// Health check
app.get('/api/health', function(req, res) {
    res.json({
        status: 'ok',
        message: 'CodeLens API is running',
        uptime: Math.floor(process.uptime()) + 's'
    });
});

// ---- 404 Handler ----
app.use(function(req, res) {
    res.status(404).json({ success: false, message: 'Route not found' });
});

// ---- Global Error Handler ----
app.use(function(err, req, res, next) {
    console.error('Unhandled Error:', err.stack || err.message);
    res.status(err.status || 500).json({
        success: false,
        message: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message || 'Internal server error'
    });
});

// ---- Start Server ----
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, function() {
    console.log('');
    console.log('  CodeLens Backend Server');
    console.log('  -----------------------');
    console.log('  Server running on port ' + PORT);
    console.log('  API: http://localhost:' + PORT + '/api');
    console.log('  Environment: ' + (process.env.NODE_ENV || 'development'));
    console.log('');
});

// ---- Graceful Shutdown ----
function shutdown(signal) {
    console.log('\n  ' + signal + ' received. Shutting down gracefully...');
    server.close(function() {
        console.log('  Server closed.');
        process.exit(0);
    });
    // Force close after 10 seconds
    setTimeout(function() {
        console.error('  Forced shutdown.');
        process.exit(1);
    }, 10000);
}

process.on('SIGTERM', function() { shutdown('SIGTERM'); });
process.on('SIGINT', function() { shutdown('SIGINT'); });
