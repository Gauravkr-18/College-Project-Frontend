# CodeLens — Interactive DSA Code Visualizer

Final-year college project. Step-through visualization of data structures and algorithms
across C, C++, Java, Python, and JavaScript with live memory/stack/array rendering,
multi-language syntax highlighting, user authentication, and an admin dashboard.

**Deployment:**
- **Frontend** → [Vercel](https://vercel.com) (this repo — static HTML/CSS/JS)
- **Backend** → [Render](https://render.com) ([codelens-backend](https://github.com/YOUR_USERNAME/codelens-backend) repo)
- **Database** → MongoDB Atlas

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| **Browser** | Chrome 90+, Firefox 90+, Edge 90+ | ES5 frontend, no polyfills needed |
| **Node.js** | 18 LTS or 20 LTS | Backend only (not needed for frontend) |
| **MongoDB** | Atlas (cloud) OR local 6+ | Backend database |

---

## Quick Start

### Local Development

```bash
# 1. Start the backend (in the separate codelens-backend repo)
git clone https://github.com/YOUR_USERNAME/codelens-backend.git
cd codelens-backend
npm install
cp .env.example .env   # fill in MONGODB_URI, JWT_SECRET, etc.
npm run dev            # → http://localhost:5000

# 2. Serve the frontend with any static server
cd path/to/codelens-frontend
python -m http.server 5500
# Or use VS Code Live Server on port 5500
```

Open in browser:
- **Home:** `http://localhost:5500/index.html`
- **Editor:** `http://localhost:5500/editor.html`
- **Admin:** `http://localhost:5500/admin.html` (admin users only)

> **`js/config.js` auto-detects the environment:** on `localhost` it points to `http://localhost:5000`; on any other domain it points to the configured Render URL.

### Production (Vercel)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import this repo
3. Framework: **Other**, Build Command: *(empty)*, Output Directory: `./`
4. Click **Deploy** — no build step needed

Vercel auto-deploys on every push to `main`.

---

## Environment Variables

The frontend has **no environment variables**. The backend API URL is configured directly in `js/config.js`:

```js
var BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : 'https://YOUR_RENDER_APP.onrender.com';  // ← update before deploying
```

Replace `YOUR_RENDER_APP` with your actual Render service name before pushing.

> All backend configuration (MongoDB URI, JWT secret, CORS, email) lives in the backend repo's environment variables on Render.

---

## Creating the First Admin Account

There is no sign-up route for admins. Promote a user directly in MongoDB:

```js
// In MongoDB Atlas Data Explorer or mongosh:
db.users.updateOne(
  { email: "your@email.com" },
  { $set: { role: "admin" } }
)
```

Then log in as that user to access `admin.html`.

---

## Project Structure

```
codelens-frontend/
├── index.html                  # Home page — hero, features, language cards
├── editor.html                 # Editor — code viewer + visualizer + animation controller
├── admin.html                  # Admin panel — user stats & management
├── .gitignore
├── README.md                   # ← You are here
│
├── css/                        # 7 CSS files (~3,800 lines, no framework)
│   ├── theme.css               #   CSS variables for dark/light themes (~200 vars each)
│   ├── common.css              #   Header, nav, shared components, reset, responsive
│   ├── home.css                #   Home page — hero, features grid, language cards, CTA
│   ├── editor.css              #   Editor layout (code panel + resizer + visualizer)
│   ├── auth.css                #   Auth modal, profile dropdown
│   ├── dashboard.css           #   Profile modal, admin table, avatar picker/crop/viewer
│   └── popups.css              #   Browse examples, search dropdown, history popup
│
├── js/                         # 19 JS files (vanilla ES5, no bundler)
│   ├── config.js               #   BACKEND_URL auto-detect, API_URL, escapeHtml, helpers (loaded first)
│   ├── theme.js                #   Dark/light theme toggle with localStorage
│   ├── header.js               #   Nav dropdowns, logo eye blink animation
│   ├── auth.js                 #   Login/signup modal, JWT auth state management
│   ├── profile.js              #   Profile modal, inline name editing
│   ├── profile-avatar-ui.js    #   Avatar picker, viewer, preset selection
│   ├── avatar-crop.js          #   Canvas-based circular crop with zoom & drag
│   ├── category-colors.js      #   80+ category → colour map for badges
│   ├── syntax.js               #   Multi-language syntax highlighter (5 languages)
│   ├── popup-core.js           #   Shared popup namespace (_P), data loading, caching
│   ├── browse-examples.js      #   Browse examples popup (type/lang tabs, list + preview)
│   ├── search.js               #   Global search dropdown (Ctrl+K, keyboard nav, max 8 results)
│   ├── history.js              #   History popup (time filters, search, clear, max 50 items)
│   ├── animation-controller.js #   Step-through animation player (play/pause/speed/slider/markers)
│   ├── editor.js               #   Editor page (copy, reset, fullscreen, resizer, vis tabs)
│   ├── fullscreen-editor.js    #   Full-screen modal editor with simulated terminal
│   ├── admin.js                #   Admin panel — stats & user table (server-side auth via /api/auth/me)
│   ├── admin-reports.js        #   Admin reports
│   └── report.js               #   Report submission
│
├── Visualization Engine/       # 4 engine files (vanilla JS, IIFE pattern)
│   ├── Memory Engine/          #   Stack + data segment visualization
│   │   ├── visualization-engine.js   # State machine (11 stack_update actions + data_segment)
│   │   └── visualization-renderer.js # DOM renderer (frames, variables, arrays)
│   └── D.S Engine/             #   Data structure visualization
│       ├── ds-engine.js        #   State machine (13 ds_update actions)
│       └── ds-renderer.js      #   DOM renderer (arrays, matrices, pointers, sidebar)
│
└── Assets/                     # Static assets (Logo.png)
```

> **Backend lives in a separate repo** ([codelens-backend](https://github.com/YOUR_USERNAME/codelens-backend)) deployed on Render.

---

## Features

### Visualization
- **Memory Engine** — Stack frames, local/global variables, arrays (1D + 2D), data segment, simulated terminal
- **D.S Engine** — Arrays, matrices, pointers, cell states (active, comparing, sorted, pivot, swapping, found, visited, left/right/mid, min/max), info sidebar
- **Step-through Player** — Play/pause, adjustable speed (0.5×, 1.0×, 1.5×, 2.0×), slider with step-bar markers (section_start + checkpoint), keyboard navigation
- **Synthetic Steps** — If an example has no `execution_steps`, the engine auto-generates evenly-spaced steps across the code lines
- **End Overlay** — After the last step, shows completion screen with "Next Example" and "Browse" options

### Frontend
- **Dark/Light Theme** — CSS variable-driven, persisted in `localStorage`
- **Multi-language Syntax Highlighting** — C, C++, Java, Python, JavaScript (custom tokenizer, rule caching)
- **Browse Examples** — Filter by type (stack/DS), language, category; search; split list + preview panel
- **Global Search** — `Ctrl+K` with 200ms debounce, keyboard navigation (↑/↓/Enter), max 8 results with language badges
- **History** — Last 50 viewed examples in `localStorage`, time-based filtering (last hour / today / this week / this month / all), text search, per-item remove
- **Auth System** — JWT login/signup, email validation, password 6–128 chars, token expiry
- **Guest Limit** — Non-logged-in users can visualize **5 free examples per session**; further visualizations require login. Counter badge shown in editor. Limit resets per browser session (stored in `sessionStorage`).
- **Profile** — Inline name editing, 5 preset avatars, upload & crop custom avatar (canvas-based, zoom + drag)
- **Full-screen Editor** — Modal editor with code viewer, simulated compile + run terminal, copy to clipboard
- **Admin Panel** — Stats cards (total users, new today/week/month, execution counts), paginated user table (deletable), admin-only auth
- **Responsive Design** — Mobile-friendly with breakpoints at 1100 / 1024 / 900 / 768 / 480 px
- **Lucide Icons** — SVG icon library with scoped rendering

### Backend
- **Lazy-Load API** — Meta-only example lists (~5–20 KB per request) + on-demand full examples (avoids loading 3.6 MB C.json all at once)
- **In-Memory Caching** — Example JSON files parsed once per type+lang key; hidden list cached with async disk writes
- **Analytics Tracking** — Records title, lang, type, userId, timestamp with 90-day TTL auto-expiry
- **Avatar Management** — Upload, server-generated filename, old file cleanup on replacement, preset fallback
- **Visibility Toggle** — Admin can hide individual examples from regular users without deleting them
- **Security** — Helmet, CORS, rate limiting (20/15min auth, 100/15min general), bcrypt (10 rounds), path traversal protection, bcrypt DoS guard (128 char password ceiling)
- **Graceful Shutdown** — SIGTERM/SIGINT with 10s force-close

---

## Keyboard Shortcuts

| Shortcut | Where | Action |
|---|---|---|
| `Ctrl+K` | Any page | Focus global search input |
| `↑` / `↓` | Search dropdown open | Navigate results |
| `Enter` | Search dropdown open | Load highlighted result |
| `Escape` | Search dropdown open | Close dropdown |
| `←` / `→` | Animation controller | Previous / Next step |
| `Space` | Animation controller | Play / Pause |

---

## Tech Stack

| Layer              | Technology                                                |
|--------------------|-----------------------------------------------------------|
| **Frontend**       | Vanilla HTML/CSS/JS (ES5, no framework, no bundler)       |
| **Styling**        | Custom CSS (~3,800 lines), Inter + JetBrains Mono fonts   |
| **Vis Engines**    | Vanilla JS IIFEs, DOM-based rendering                     |
| **Hosting**        | Vercel (static, free tier)                                |
| **Backend**        | Node.js + Express 5 on Render (separate repo)             |
| **Database**       | MongoDB Atlas (cloud, free tier)                          |
| **Auth**           | JWT (jsonwebtoken) + bcryptjs                             |
| **Security**       | Helmet, express-rate-limit, CORS                          |
| **Upload**         | Multer (2 MB max, image-only)                             |
| **Compression**    | gzip via compression middleware                           |

---

## API Summary

| Endpoint group | Routes | Auth | Purpose |
|---|---|---|---|
| `/api/auth` | 5 | Mixed | Register, login, profile, avatar |
| `/api/examples` | 6 | Mixed | List, fetch, toggle, track views |
| `/api/admin` | 3 | Admin | Users, stats, delete |
| `/api/health` | 1 | No | Server status + uptime |

See the [codelens-backend README](https://github.com/YOUR_USERNAME/codelens-backend#readme) for full endpoint documentation.

### Rate Limits

| Route group | Limit |
|---|---|
| `/api/auth` | 20 requests / 15 min per IP |
| All other `/api/*` | 100 requests / 15 min per IP |

---

## Visualization Engine Details

### Memory Engine — `stack_update` Actions

| Action | Description |
|---|---|
| `create_stack_frame` | Push a new function frame with optional variables |
| `create_temporary_stack_frame` | Push a temporary frame (printf etc.) — auto-removed next step |
| `update_variable` | Update a variable value by name or address |
| `update_multiple_variables` | Batch-update several variables in one step |
| `update_array` | Replace full element list for a named 1D array |
| `update_array_element` | Update one element of a 1D array by index |
| `update_2d_array` | Replace full element list for a 2D array |
| `update_2d_array_element` | Update one element of a 2D array by row + col |
| `clear_frame` / `remove_stack_frame` | Pop a named function frame |
| `clear_all_frames` | Remove all stack frames (data segment persists) |
| `data_segment_update` (`create_data_segment_variable`) | Add a global or static variable to the data segment panel |

**Layout:** Frames render left-to-right; `main` on far left, most recent call on the right. Active frame gets `id="vis-active-frame"` and auto-scrolls into view.

### D.S Engine — `ds_update` Actions

| Action | Description |
|---|---|
| `create_array` | Create a named 1D array with initial values |
| `create_2d_array` | Create a named 2D matrix (rows × cols) |
| `update_element` | Update value + state of a single element by index |
| `update_element_state` | Update only the state of a single element |
| `update_multiple_elements` | Batch update for multiple indices in one step |
| `reset_states` | Reset all cell states to neutral `''` |
| `swap_elements` | Swap two elements and set their state to `'swapping'` |
| `update_pointer` | Create or move a named pointer to a new index |
| `update_multiple_pointers` | Batch update several pointers |
| `remove_pointer` | Remove a single pointer from state |
| `clear_pointers` | Remove all pointers |
| `update_info_sidebar` | Replace the stats/info panel items |
| `ds_update_message` | Update the description text |

### DS Cell States Reference

| State | Typical use |
|---|---|
| `''` | Neutral / default |
| `active` | Current element being processed |
| `comparing` | Two elements under comparison |
| `sorted` | Element permanently placed in sorted position |
| `pivot` | Pivot element (quicksort-style) |
| `swapping` | Elements mid-swap |
| `found` | Search target located |
| `visited` | Already processed |
| `current` | Current traversal position |
| `min` / `max` | Min/max tracker |
| `left` / `right` / `mid` | Binary search boundary markers |

CSS class applied: `.ds-array-cell--<state>`

### Step JSON Format — Memory Engine

```json
{
  "step": 1,
  "line": 3,
  "description": "Function main() called",
  "stack_update": {
    "action": "create_stack_frame",
    "function_name": "main",
    "stack_data_frame": {
      "no_of_data_frame": "create_1",
      "data_frame_1": {
        "variable_name": "x",
        "type": "int",
        "variable_value": 0,
        "address": "0x7fff1000",
        "size": "4 bytes"
      }
    }
  },
  "data_segment_update": null,
  "terminal_update": null,
  "return_value": null
}
```

### Step JSON Format — D.S Engine

```json
{
  "step": 2,
  "line": 5,
  "description": "i pointer moves to index 3",
  "ds_update": {
    "action": "update_pointer",
    "pointer_name": "i",
    "pointer_value": 3,
    "target_array": "arr"
  },
  "terminal_update": null
}
```

---

## Script Loading Order

Scripts must be loaded in dependency order:

```
config.js               ← Global helpers & API_URL (loaded first on every page)
├── theme.js             ← Standalone, localStorage only
├── header.js            ← Standalone, DOM only
├── auth.js              ← config.js
├── profile.js           ← config.js
├── profile-avatar-ui.js ← config.js + profile.js
├── avatar-crop.js       ← config.js + profile.js
├── category-colors.js   ← Standalone IIFE
├── syntax.js            ← category-colors.js
├── popup-core.js        ← config.js + syntax.js + category-colors.js
├── browse-examples.js   ← popup-core.js
├── search.js            ← popup-core.js
├── history.js           ← popup-core.js
├── animation-controller.js ← Standalone
├── editor.js            ← popup-core.js + animation-controller.js
├── fullscreen-editor.js ← config.js
└── admin.js             ← config.js (admin.html only)

Visualization engines (editor.html only):
├── visualization-engine.js   ← Standalone
├── visualization-renderer.js ← config.js (escapeHtml)
├── ds-engine.js              ← Standalone
└── ds-renderer.js            ← config.js (escapeHtml)
```

---

## localStorage Keys

| Key | Used By | Stores |
|---|---|---|
| `codelens-theme` | `theme.js` | `"dark"` or `"light"` |
| `codelens-token` | `auth.js` | JWT string |
| `codelens-user` | `auth.js` | JSON user object |
| `codelens-history` | `popup-core.js` | JSON array of up to 50 viewed items |
| `browseExamples_state` | `browse-examples.js` | Session filters state (type, lang, category) |

---

## Data Files

Example data lives in `Backend/Data/Examples/`:

| Folder | Languages available |
|---|---|
| `Stack Examples/` | `C.json`, `CPP.json`, `Java.json`, `JavaScript.json`, `Python.json` |
| `D.S Example/` | `c.json` |

`hiddenExamples.json` — tracks which examples are admin-hidden. Cached in memory on first read; async disk writes on toggle. Committed as `{}` (empty); changes made via the admin panel persist on the server.

---

## Known Limitations

| Area | Detail |
|---|---|
| **Guest execution limit** | Non-logged-in users can run **5 free visualizations per browser session** (stored in `sessionStorage`, resets per new session). On the 6th attempt, the auth modal opens with a prompt to login/signup. Counter badge visible in editor header (top-right, shows remaining count). |
| **Avatar uploads** | Stored locally in `Backend/Data/Avatar/uploads/` — not cloud storage. Files are lost if the server is re-cloned. For production, migrate to AWS S3 or similar. |
| `hiddenExamples.json` | Overwritten by `git pull` if the file changed in the repo. Commit it before deploying if admin-hidden examples must be preserved. |
| **No bundler** | All 17 JS files load as separate `<script>` tags. Fine for this scale; not optimised for production network performance. |

---

## Deployment

See [`development.md`](development.md) *(gitignored — local reference only)* for the full guide covering:
- GitHub initial push checklist
- EC2 first-time setup (Node.js, PM2, Nginx)
- Nginx reverse proxy config
- SSL with Let's Encrypt / Certbot
- GitHub Actions auto-deploy setup
- Production `.env` configuration

---

## Code Quality Notes

- **Single `escapeHtml()` implementation** in `config.js` — all other files reference the global
- **`syntax.js` uses its own `esc()`** intentionally (3-entity escape, quotes omitted for span content)
- **No duplicate code** across the 21 JS files (verified and deduplicated)
- **Analytics bug fixed** — `trackExampleView()` now sends example details to the backend
- **Old avatar cleanup** — backend deletes previous uploaded file on new upload
- **bcrypt DoS guard** — password length capped at 128 chars on both register and login routes
