# CodeLens — Interactive DSA Code Visualizer (Frontend)

Final-year college project. Step-through visualization of data structures and algorithms
across C, C++, Java, Python, and JavaScript with live memory/stack/array rendering,
multi-language syntax highlighting, user authentication, and an admin dashboard.

**Deployment:**
- **Frontend** → [Vercel](https://vercel.com) (this repo — static HTML/CSS/JS)
- **Backend** → separate repo, deployed on [Render](https://render.com)

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| **Browser** | Chrome 90+, Firefox 90+, Edge 90+ | ES5, no polyfills needed |
| **Static server** | Any | `python -m http.server 5500` or VS Code Live Server |

No Node.js, no build step, no bundler needed to run the frontend.

---

## Quick Start

```bash
# Serve the frontend with any static server
cd path/to/codelens-frontend
python -m http.server 5500
# Or use VS Code Live Server on port 5500
```

Open in browser:
- **Home:** `http://localhost:5500/index.html`
- **Editor:** `http://localhost:5500/editor.html`
- **Admin:** `http://localhost:5500/admin.html` (admin users only)

> The backend must also be running locally (`http://localhost:5000`) for auth, examples, and analytics to work. See the backend repo for setup.

---

## API URL Configuration

The frontend has **no environment variables**. The backend URL is set directly in `js/config.js`:

```js
var BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : 'https://YOUR_RENDER_APP.onrender.com';  // ← update before deploying
```

Replace `YOUR_RENDER_APP` with your actual Render service name before pushing to production.

---

## Production Deployment (Vercel)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import this repo
3. Framework: **Other**, Build Command: *(empty)*, Output Directory: `./`
4. Click **Deploy** — no build step needed

Vercel auto-deploys on every push to `main`.

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

---

## Features

### Visualization
- **Memory Engine** — Stack frames, local/global variables, arrays (1D + 2D), data segment, simulated terminal
- **D.S Engine** — Arrays, matrices, pointers, cell states (active, comparing, sorted, pivot, swapping, found, visited, left/right/mid, min/max), info sidebar
- **Step-through Player** — Play/pause, adjustable speed (0.5×, 1.0×, 1.5×, 2.0×), slider with step-bar markers, keyboard navigation
- **Synthetic Steps** — If an example has no `execution_steps`, the engine auto-generates evenly-spaced steps across the code lines
- **End Overlay** — After the last step, shows completion screen with "Next Example" and "Browse" options

### UI & UX
- **Dark/Light Theme** — CSS variable-driven, persisted in `localStorage`
- **Multi-language Syntax Highlighting** — C, C++, Java, Python, JavaScript (custom tokenizer, rule caching)
- **Browse Examples** — Filter by type (stack/DS), language, category; search; split list + preview panel
- **Global Search** — `Ctrl+K` with 200ms debounce, keyboard navigation (↑/↓/Enter), max 8 results with language badges
- **History** — Last 50 viewed examples in `localStorage`, time-based filtering, text search, per-item remove
- **Auth System** — JWT login/signup modal, email validation, token expiry handling
- **Guest Limit** — Non-logged-in users can visualize **5 free examples per session**; further visualizations prompt login. Counter badge shown in editor header.
- **Profile** — Inline name editing, 5 preset avatars, upload & crop custom avatar (canvas-based, zoom + drag)
- **Full-screen Editor** — Modal editor with code viewer, simulated compile + run terminal, copy to clipboard
- **Admin Panel** — Stats cards (total users, new today/week/month, execution counts), paginated user table, admin-only access
- **Responsive Design** — Mobile-friendly with breakpoints at 1100 / 1024 / 900 / 768 / 480 px
- **Lucide Icons** — SVG icon library with scoped rendering

---

## Keyboard Shortcuts

| Shortcut | Where | Action |
|---|---|---|
| `Ctrl+K` | Any page | Focus global search |
| `↑` / `↓` | Search dropdown open | Navigate results |
| `Enter` | Search dropdown open | Load highlighted result |
| `Escape` | Search dropdown / popup open | Close |
| `←` / `→` | Animation controller | Previous / Next step |
| `Space` | Animation controller | Play / Pause |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Language** | Vanilla HTML/CSS/JS (ES5, no framework, no bundler) |
| **Styling** | Custom CSS (~3,800 lines), Inter + JetBrains Mono fonts |
| **Vis Engines** | Vanilla JS IIFEs, DOM-based rendering |
| **Hosting** | Vercel (static, free tier) |
| **Icons** | Lucide Icons (SVG) |

---

## Script Loading Order

Scripts must be loaded in the following dependency order:

```
config.js               ← Global helpers & API_URL (loaded first on every page)
├── theme.js             ← Standalone
├── header.js            ← Standalone
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

## localStorage / sessionStorage Keys

| Key | Storage | Used By | Stores |
|---|---|---|---|
| `codelens-theme` | localStorage | `theme.js` | `"dark"` or `"light"` |
| `codelens-token` | localStorage | `auth.js` | JWT string |
| `codelens-user` | localStorage | `auth.js` | JSON user object |
| `codelens-history` | localStorage | `popup-core.js` | JSON array of up to 50 viewed items |
| `browseExamples_state` | sessionStorage | `browse-examples.js` | Last selected type, lang, category, search, scroll |
| `codelens-guest-count` | sessionStorage | `editor.js` | Guest visualization count (resets per session) |

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
| `data_segment_update` | Add a global/static variable to the data segment panel |

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

### DS Cell States

| State | Typical use |
|---|---|
| `''` | Neutral / default |
| `active` | Current element being processed |
| `comparing` | Two elements under comparison |
| `sorted` | Element permanently in sorted position |
| `pivot` | Pivot element (quicksort-style) |
| `swapping` | Elements mid-swap |
| `found` | Search target located |
| `visited` | Already processed |
| `current` | Current traversal position |
| `min` / `max` | Min/max tracker |
| `left` / `right` / `mid` | Binary search boundary markers |

CSS class applied: `.ds-array-cell--<state>`

---

## Known Limitations

| Area | Detail |
|---|---|
| **Guest execution limit** | 5 free visualizations per browser session (stored in `sessionStorage`). On the 6th attempt, the auth modal opens. Counter badge visible in editor header. |
| **No bundler** | All JS files load as separate `<script>` tags. Fine for this scale; not optimised for production network performance. |


