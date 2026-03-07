/* ============================================
   Examples Routes — Lazy-Load API
   GET  /list/:type/:lang                — meta-only list (hidden filtered for non-admins)
   GET  /admin-list/:type/:lang          — all examples incl. hidden flag (admin)
   GET  /item/:type/:lang/:idx           — single full example
   POST /toggle-visibility/:type/:lang/:idx — toggle hidden state (admin)
   POST /track-view                      — log authenticated view
   POST /track-view-guest                — log guest view

   Performance:
     • Example JSON files cached in-memory (parsed once)
     • Hidden list cached in-memory, async writes to disk
     • Cache-Control headers on list + item endpoints (1h)
   Security:
     • Type/lang params validated against whitelists
     • Track inputs truncated to prevent oversized writes
   ============================================ */

const express        = require('express');
const path           = require('path');
const fs             = require('fs');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const { adminOrTesterMiddleware } = require('../middleware/admin');
const Analytics      = require('../models/Analytics');

const router = express.Router();

// ---- Whitelists (prevent path traversal) ----
const TYPE_FOLDERS = {
    stack: 'Stack Examples',
    ds:    'D.S Example'
};

const LANG_FILES = {
    c:          'C',
    cpp:        'CPP',
    java:       'Java',
    python:     'Python',
    javascript: 'JavaScript'
};

// ---- Hidden examples storage (in-memory cache + JSON persistence) ----
const HIDDEN_FILE = path.join(__dirname, '..', 'Data', 'Examples', 'hiddenExamples.json');
var hiddenCache = null; // loaded lazily, invalidated on toggle

function loadHidden() {
    if (hiddenCache) return hiddenCache;
    try {
        var raw = fs.readFileSync(HIDDEN_FILE, 'utf8');
        hiddenCache = JSON.parse(raw);
    } catch (e) {
        hiddenCache = {};
    }
    return hiddenCache;
}

function saveHidden(data) {
    hiddenCache = data; // update in-memory cache immediately
    // Async write — don't block the request
    fs.writeFile(HIDDEN_FILE, JSON.stringify(data, null, 2), 'utf8', function(err) {
        if (err) console.error('Failed to save hidden examples:', err);
    });
}

// ---- In-memory file cache (whole JSON, parsed once per file) ----
const fileCache = {};

function loadFile(type, lang) {
    const cacheKey = type + '_' + lang;
    if (fileCache[cacheKey]) return fileCache[cacheKey];

    const folder = TYPE_FOLDERS[type];
    const file   = LANG_FILES[lang];
    if (!folder || !file) return null;

    const filePath = path.join(__dirname, '..', 'Data', 'Examples', folder, file + '.json');
    try {
        const raw  = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''); // strip UTF-8 BOM if present
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
            fileCache[cacheKey] = data;
            return data;
        }
        return null;
    } catch (e) {
        return null;
    }
}

/* ---- GET /api/examples/list/:type/:lang
   Returns only the meta section of each example plus its array index.
   Hidden examples are filtered out for regular users.
   ----------------------------------------- */
router.get('/list/:type/:lang', function(req, res) {
    const type = req.params.type;
    const lang = req.params.lang.toLowerCase();

    if (!TYPE_FOLDERS[type] || !LANG_FILES[lang]) {
        return res.status(400).json({ success: false, message: 'Invalid type or language' });
    }

    const data = loadFile(type, lang);
    if (!data) return res.json({ success: true, data: [] });

    const hidden    = loadHidden();
    const key       = type + '_' + lang;
    const hiddenSet = new Set(hidden[key] || []);

    const metaList = data
        .map(function(ex, idx) {
            return {
                meta: ex.meta,
                _idx: idx,
                has_steps: Array.isArray(ex.execution_steps) && ex.execution_steps.length > 0
            };
        })
        .filter(function(item) { return !hiddenSet.has(item._idx); });

    // Cache meta list for 1 hour (static data)
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({ success: true, data: metaList });
});

/* ---- GET /api/examples/admin-list/:type/:lang  (admin or tester)
   Returns all examples including hidden ones, each with a `hidden` boolean flag.
   ----------------------------------------- */
router.get('/admin-list/:type/:lang', authMiddleware, adminOrTesterMiddleware, function(req, res) {
    const type = req.params.type;
    const lang = req.params.lang.toLowerCase();

    if (!TYPE_FOLDERS[type] || !LANG_FILES[lang]) {
        return res.status(400).json({ success: false, message: 'Invalid type or language' });
    }

    const data = loadFile(type, lang);
    if (!data) return res.json({ success: true, data: [] });

    const hidden    = loadHidden();
    const key       = type + '_' + lang;
    const hiddenSet = new Set(hidden[key] || []);

    const metaList = data.map(function(ex, idx) {
        return {
            meta: ex.meta,
            _idx: idx,
            hidden: hiddenSet.has(idx),
            has_steps: Array.isArray(ex.execution_steps) && ex.execution_steps.length > 0
        };
    });

    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: metaList });
});

/* ---- POST /api/examples/toggle-visibility/:type/:lang/:idx  (admin only)
   Toggles the hidden state of an example. Returns { success, hidden } where
   `hidden` is the new state (true = now hidden from regular users).
   ----------------------------------------- */
router.post('/toggle-visibility/:type/:lang/:idx', authMiddleware, adminMiddleware, function(req, res) {
    const type = req.params.type;
    const lang = req.params.lang.toLowerCase();
    const idx  = parseInt(req.params.idx, 10);

    if (!TYPE_FOLDERS[type] || !LANG_FILES[lang] || isNaN(idx) || idx < 0) {
        return res.status(400).json({ success: false, message: 'Invalid parameters' });
    }

    const data = loadFile(type, lang);
    if (!data || idx >= data.length) {
        return res.status(404).json({ success: false, message: 'Example not found' });
    }

    const hidden  = loadHidden();
    const key     = type + '_' + lang;
    if (!hidden[key]) hidden[key] = [];

    const pos = hidden[key].indexOf(idx);
    let nowHidden;
    if (pos === -1) {
        hidden[key].push(idx);
        nowHidden = true;
    } else {
        hidden[key].splice(pos, 1);
        nowHidden = false;
    }

    saveHidden(hidden);
    res.json({ success: true, hidden: nowHidden });
});

/* ---- GET /api/examples/item/:type/:lang/:idx
   Returns the full single example (meta + execution_steps).
   ----------------------------------------- */
router.get('/item/:type/:lang/:idx', function(req, res) {
    const type = req.params.type;
    const lang = req.params.lang.toLowerCase();
    const idx  = parseInt(req.params.idx, 10);

    if (!TYPE_FOLDERS[type] || !LANG_FILES[lang] || isNaN(idx) || idx < 0) {
        return res.status(400).json({ success: false, message: 'Invalid parameters' });
    }

    const data = loadFile(type, lang);
    if (!data || idx >= data.length) {
        return res.status(404).json({ success: false, message: 'Example not found' });
    }

    // Cache individual examples for 1 hour (static data)
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({ success: true, data: data[idx] });
});

/* ---- POST /api/examples/track-view
   Logs that an authenticated user viewed an example.
   Requires auth. Stores userId + title + lang + type + timestamp.
   ----------------------------------------- */
router.post('/track-view', authMiddleware, function(req, res) {
    var body = req.body || {};
    // Fire-and-forget — don't block the response
    Analytics.create({
        userId: req.user._id,
        title: typeof body.title === 'string' ? body.title.slice(0, 200) : '',
        lang:  typeof body.lang  === 'string' ? body.lang.slice(0, 20)  : '',
        type:  typeof body.type  === 'string' ? body.type.slice(0, 20)  : '',
        timestamp: new Date()
    }).catch(function(err) {
        console.error('Analytics track error:', err.message);
    });

    res.json({ success: true });
});

/* ---- POST /api/examples/track-view-guest
   Logs that a guest user viewed an example.
   No auth required. Stores userId: null + view details.
   ----------------------------------------- */
router.post('/track-view-guest', function(req, res) {
    var body = req.body || {};
    // Fire-and-forget — don't block the response
    Analytics.create({
        userId: null,
        title: typeof body.title === 'string' ? body.title.slice(0, 200) : '',
        lang:  typeof body.lang  === 'string' ? body.lang.slice(0, 20)  : '',
        type:  typeof body.type  === 'string' ? body.type.slice(0, 20)  : '',
        timestamp: new Date()
    }).catch(function(err) {
        console.error('Analytics guest track error:', err.message);
    });

    res.json({ success: true });
});

module.exports = router;
