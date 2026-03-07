# Frontend JavaScript — CodeLens

All client-side logic for CodeLens. No build tools or bundler — plain ES5-compatible JavaScript loaded via `<script>` tags.

## File Overview

### `js/` — Core Application Scripts

| File                      | Lines | Purpose                                                    |
|---------------------------|-------|------------------------------------------------------------|
| `config.js`               | ~120  | API URLs, shared helpers (`escapeHtml`, `getInitials`, etc.) |
| `theme.js`                | ~50   | Dark/light theme toggle with localStorage persistence       |
| `header.js`               | ~100  | Navigation dropdown interactions, logo eye blink animation   |
| `auth.js`                 | ~270  | Login/signup modal, JWT storage, auth state management       |
| `profile.js`              | ~350  | Profile modal, inline name editing                           |
| `profile-avatar-ui.js`    | ~150  | Avatar picker, viewer, preset selection                      |
| `avatar-crop.js`          | ~200  | Canvas-based circular crop with zoom & drag                  |
| `category-colors.js`      | ~100  | 80+ category → color map IIFE (CategoryColors global)       |
| `syntax.js`               | ~300  | Multi-language syntax highlighter (C, C++, Java, Python, JS) |
| `popup-core.js`           | ~350  | Shared popup namespace (_P), data loading, caching, helpers  |
| `browse-examples.js`      | ~380  | Browse examples popup (type/lang tabs, list + preview)       |
| `search.js`               | ~200  | Global search dropdown (Ctrl+K, keyboard nav)               |
| `history.js`              | ~200  | History popup (time filters, search, clear)                  |
| `animation-controller.js` | ~350  | Step-through animation player with play/pause/speed          |
| `editor.js`               | ~250  | Editor page (copy, reset, fullscreen, resizer, vis tabs)     |
| `fullscreen-editor.js`    | ~300  | Full-screen code editor with simulated terminal              |
| `admin.js`                | ~250  | Admin panel — stats cards, user table                        |

### `Visualization Engine/` — Memory & DS Visualization

| File                                     | Lines | Purpose                                              |
|------------------------------------------|-------|------------------------------------------------------|
| `Memory Engine/visualization-engine.js`  | ~350  | Stack memory state engine (frames, variables, arrays) |
| `Memory Engine/visualization-renderer.js`| ~440  | DOM renderer for stack frames + data segment          |
| `D.S Engine/ds-engine.js`                | ~400  | Data structure state engine (arrays, pointers, cells) |
| `D.S Engine/ds-renderer.js`              | ~350  | DOM renderer for DS arrays, matrices, pointers        |

## Loading Order

Scripts are loaded via `<script>` tags and **must** follow this dependency order:

```
config.js                     ← Global helpers & API_URL (loaded first on every page)
  ├── theme.js                ← Standalone, uses localStorage only
  ├── header.js               ← Standalone, DOM-only + logo eye blink animation
  ├── auth.js                 ← Depends on: config.js
  ├── profile.js              ← Depends on: config.js
  ├── profile-avatar-ui.js    ← Depends on: config.js + profile.js
  ├── avatar-crop.js          ← Depends on: config.js + profile.js
  ├── category-colors.js      ← Standalone IIFE → CategoryColors global
  ├── syntax.js               ← Depends on: category-colors.js → SyntaxHighlighter global
  ├── popup-core.js           ← Depends on: config.js + syntax.js + category-colors.js → _P namespace
  ├── browse-examples.js      ← Depends on: popup-core.js (_P)
  ├── search.js               ← Depends on: popup-core.js (_P)
  ├── history.js              ← Depends on: popup-core.js (_P)
  ├── animation-controller.js ← Standalone → AnimationController global
  ├── fullscreen-editor.js    ← Depends on: config.js → FullScreenEditor global
  ├── editor.js               ← Depends on: popup-core.js + animation-controller.js
  │
  │  Visualization Engines (editor page only):
  ├── visualization-engine.js ← Standalone → VisualizationEngine global
  ├── visualization-renderer.js ← Depends on: config.js (escapeHtml)
  ├── ds-engine.js            ← Standalone → DSEngine global
  └── ds-renderer.js          ← Depends on: config.js (escapeHtml)
  │
  └── admin.js                ← Page: admin.html only (depends on config.js)
```

## Shared Utilities (config.js)

**Must be loaded first** on every page. Single source of truth for all shared globals.

| Function                      | Description                                              |
|-------------------------------|----------------------------------------------------------|
| `escapeHtml(text)`            | XSS-safe HTML escaping (reuses single DOM element). **Used project-wide** — visualization renderers reference this instead of maintaining local copies. |
| `getInitials(name)`           | Extracts initials from full name (e.g., "John Doe" → "JD") |
| `getAvatarUrl(avatar)`        | Builds full avatar URL from preset ID or upload path      |
| `formatDate(dateString)`      | Formats ISO date to readable string ("Jan 15, 2025")      |
| `truncateFileName(base)`      | Truncates long file names for badge display (>6 → 4+"...") |
| `updateHeaderAvatars(user)`   | Updates all `.profile-avatar` elements across the page    |
| `updateHeaderProfileInfo(user)` | Updates name/email in profile dropdowns                 |
| `toggleProfileDropdown()`     | Toggles profile dropdown visibility                       |
| `closeProfileDropdown()`      | Closes profile dropdown                                   |
| `handleLogout()`              | Clears JWT/user from localStorage, resets UI              |
| `toggleMobileMenu()`          | Toggles mobile navigation menu                            |

## File Details

### `theme.js` — Theme Toggle

- Applies theme via `data-theme` attribute on `<html>`
- Swaps Lucide icon between `moon` and `sun`
- Default theme: `dark`
- Storage key: `codelens-theme`

### `header.js` — Navigation Dropdowns

- Uses `data-dropdown` attribute on `.nav-dropdown-wrapper` elements
- Only one dropdown open at a time (closes others before opening)
- Closes on outside click and Escape key
- Sets `aria-expanded` for accessibility
- Logo eye blink animation (SVG path interpolation at random intervals)

### `auth.js` — Authentication System

Full login/signup modal with JWT-based authentication.

| State Variable | Description |
|---|---|
| `currentTab` | Active tab (`login` \| `signup`) |
| `isLoggedIn` | Boolean login state |
| `currentUser` | Current user object |

- Client-side email format + password length validation
- JWT token stored in localStorage (`codelens-token`)
- User data cached in localStorage (`codelens-user`)
- Auto-restores login state on page load

**API Calls:** `POST /auth/login`, `POST /auth/register`

### `profile.js` — Profile Management

Profile modal with inline name editing and profile data display.

- Loads fresh data from API on every open
- Inline name editing with save/cancel + Enter shortcut
- Displays formatted join date

**API Calls:** `GET /auth/me`, `PUT /auth/me`

### `profile-avatar-ui.js` — Avatar Picker & Viewer

- 5 preset avatar images to choose from
- Custom upload opens crop modal (avatar-crop.js)
- Click-to-enlarge overlay for current avatar
- All avatar elements across the page update in real-time

**API Calls:** `PUT /auth/me`, `POST /auth/upload-avatar`

### `avatar-crop.js` — Image Crop Modal

Canvas-based circular crop modal for custom avatar upload.

- 320px canvas area, 140px radius circular crop
- Mouse drag + touch drag support
- Scroll-to-zoom
- Outputs 400×400 PNG blob
- Clamps offset so crop circle always has image coverage

### `category-colors.js` — Category Color Map

IIFE exposing `CategoryColors.catColor(category)` → `{ bg, color }`.

- 80+ category name mappings (data structures, algorithms, OOP, etc.)
- Handles both singular and plural variants ("array"/"arrays")
- Default fallback for unknown categories (slate gray)

### `syntax.js` — Syntax Highlighter

IIFE exposing `SyntaxHighlighter` global. Multi-language tokenizer.

**Supported Languages:** C, C++, Java, Python, JavaScript

| Token Class | Highlights |
|---|---|
| `syn-keyword` | `if`, `for`, `return`, `class`, etc. |
| `syn-type` | `int`, `String`, `vector`, etc. |
| `syn-function` | Identifiers followed by `(` |
| `syn-string` | `"..."`, `'...'`, `` `...` ``, `"""..."""` |
| `syn-comment` | `// ...`, `/* ... */`, `# ...` |
| `syn-number` | `42`, `0xFF`, `3.14`, `0b101` |
| `syn-constant` | `null`, `true`, `None`, `nullptr` |
| `syn-builtin` | `printf`, `console.log`, `len`, etc. |
| `syn-print` | Print/output functions (white text) |
| `syn-preprocessor` | `#include`, `#define` |
| `syn-include` / `syn-header` | Split-colored `#include <stdio.h>` |

**Architecture:**
- Single-pass line tokenizer — rules checked in priority order, first match wins
- Block comment state tracked across lines via `state.inBlock`
- Rules cached per language in `_cache` for performance
- Uses its own minimal `esc()` function (3-entity escape, not the global 4-entity `escapeHtml`)

### `popup-core.js` — Shared Popup Infrastructure

IIFE establishing `window._P` namespace for the popup system.

**Key APIs:**

| Method | Description |
|---|---|
| `_P.loadExamples(type, lang, cb)` | Fetch + cache example metadata |
| `_P.fetchExampleItem(type, lang, idx, cb)` | Fetch full example data |
| `_P.loadExampleIntoEditor(example, lang, type)` | Render example in main editor |
| `_P.openPopup(id)` / `_P.closePopup(id)` | Popup lifecycle management |
| `_P.addToHistory(example, lang, type)` | Save to localStorage history |
| `_P.getHistory()` / `_P.saveHistory(list)` | History read/write |
| `_P.getCategoryColor(cat)` | Category → `{bg, color}` |
| `_P.getCategoryIcon(cat)` | Category → inline SVG string |
| `_P.refreshIcons(rootEl)` | Scoped Lucide icon refresh |

**Performance:**
- Inline SVGs for 12 high-frequency icons (avoids Lucide DOM scanning per item)
- Example data cached by `type_lang` key to avoid redundant API calls
- Admin requests cached separately (`type_lang_admin`)

### `browse-examples.js` — Browse Examples Popup

Builds on `_P` namespace. Split-view popup with list + code preview.

- Type toggle (Stack / Data Structures)
- 5 language tabs (C, C++, Java, Python, JavaScript)
- Category filter dropdown with icons and color badges
- Text search across title, category, description
- Session state persistence (scroll position, selection, category)
- Admin: toggle example visibility with optimistic UI update
- Event delegation for performant list click handling

### `search.js` — Global Search Dropdown

- 200ms debounced search across all 5 languages simultaneously
- Keyboard navigation (↑/↓/Enter)
- Ctrl+K shortcut to focus
- Max 8 results with language badge, category, step count
- Click result → loads into editor immediately

### `history.js` — History Popup

- localStorage-backed (`codelens-history`, max 50 items)
- Time filters: last hour, today, this week, this month, all time
- Text search within history
- Relative time display ("5m ago", "2h ago", "3d ago")
- Open or remove individual items; clear all

### `animation-controller.js` — Animation Controller

Standalone IIFE exposing `window.AnimationController`.

- Play/pause with auto-advance timer
- Speed control: 0.5×, 1.0×, 1.5×, 2.0×
- Step forward / backward buttons
- Progress slider with step-bar markers (section starts, checkpoints)
- Code line highlighting synced to current step
- Delegates rendering to `VisualizationEngine` + `VisualizationRenderer` (stack examples) or `DSEngine` + `DSRenderer` (DS examples)
- End overlay with "Next Example" / "Browse" buttons

### `fullscreen-editor.js` — Full-Screen Editor

Modal overlay with code viewer, toolbar, and simulated terminal.

- Syncs code + file badge + status bar from main editor
- Copy code to clipboard
- Simulated compile → run → output terminal sequence
- Auto-opens terminal on Run
- Terminal states: minimized / open / expanded
- Browse examples integration (opens popup behind FSE)

### `editor.js` — Editor Page Logic

Main editor controller — orchestrates the code panel, visualizer, and animation.

- **Copy code** — Clipboard API with legacy `execCommand` fallback
- **Reset** — Restores initial code/badge/info saved at page load
- **Fullscreen** — Browser fullscreen with icon swap (maximize ⇄ minimize)
- **Resizer** — Mouse drag between code panel and visualizer (20–30% range)
- **Visualizer tabs** — Stack / DS tab switching, syncs with popup type
- **VisualizerPanel** — Exposes `window.VisualizerPanel.setActiveTab(type)` for external use
- Initializes `AnimationController.init()` on DOMContentLoaded

### `admin.js` — Admin Panel

Admin-only page (`admin.html`) for user management.

- Redirects non-admin users to home
- Stats cards: total users, new today/week, admins, executions
- Users table with avatar, name, email, role badge, join date, view count
- Delete user with confirmation modal
- Parallel data fetching (stats + users simultaneously)

**API Calls:** `GET /admin/stats`, `GET /admin/users`, `DELETE /admin/users/:id`

## Visualization Engines

### `visualization-engine.js` — Stack Memory Engine

State machine that processes `stack_update` and `data_segment_update` actions from example JSON steps. Maintains immutable-style state with stack frames, variables, arrays (1D/2D), and data segment.

**Key API:** `executeUpTo(steps, targetStep)` → state object

### `visualization-renderer.js` — Stack DOM Renderer

Reads engine state and renders DOM elements for stack frames (left-to-right, bottom of stack on left), scalar variables, 1D/2D arrays, and a macOS-style floating terminal window.

**Depends on:** `config.js` (`escapeHtml`) — no local copy.

### `ds-engine.js` — Data Structure Engine

State machine for DS visualization. Handles array initialization, updates, pointer tracking, cell state highlighting (active, comparing, sorted, swapping, etc.), and multi-array support.

**Key API:** `executeUpTo(steps, targetStep)` → state object

### `ds-renderer.js` — Data Structure DOM Renderer

Renders DS arrays with pointer badges, info sidebars, cell state colors, 2D matrix grids with row/col pointer indicators, and terminal output.

**Depends on:** `config.js` (`escapeHtml`) — no local copy.

## Code Quality Notes

### Deduplication

All HTML escaping is centralized in `config.js` → `escapeHtml()`. The visualization renderers and DS renderer reference this single global function instead of maintaining local copies. Only `syntax.js` keeps its own minimal `esc()` because it intentionally escapes only 3 entities (no quotes needed inside span tags).

### Patterns

- **ES5 syntax** — `var`, `function()`, no arrow functions or template literals
- **`async/await`** — Exception for API calls (supported by all modern browsers)
- **No framework** — Pure vanilla JS with DOM manipulation
- **IIFE pattern** — Used for `syntax.js`, `popup-core.js`, `category-colors.js`, visualization engines to avoid global pollution
- **`window._P` namespace** — Shared state for popup system (browse, search, history)
- **Global functions** — `config.js`, `auth.js`, `profile.js` expose globals for cross-script access
- **Event delegation** — Preferred for dynamic lists to avoid re-binding listeners
- **localStorage keys** — `codelens-theme`, `codelens-token`, `codelens-user`, `codelens-history`, `browseExamples_state`
