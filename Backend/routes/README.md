# Routes

API route handlers for CodeLens Backend.

## Files

### `auth.js` — Authentication Routes

| Method | Endpoint                   | Auth | Description                              |
|--------|----------------------------|------|------------------------------------------|
| POST   | `/api/auth/register`       | No   | Create new account                       |
| POST   | `/api/auth/login`          | No   | Login, get JWT token                     |
| GET    | `/api/auth/me`             | Yes  | Get current user profile                 |
| PUT    | `/api/auth/me`             | Yes  | Update name (2–50 chars) and/or avatar   |
| POST   | `/api/auth/upload-avatar`  | Yes  | Upload cropped avatar image              |

**Registration Validation:**
- Name: 2–50 characters, trimmed
- Email: regex-validated format, checked for duplicates
- Password: 6–128 characters, bcrypt-hashed (upper bound prevents DoS)

**Login Validation:**
- Password length capped at 128 chars (prevents bcrypt DoS with very long inputs)

**Profile Update Validation:**
- Name: 2–50 characters enforced (both min and max)
- Avatar: must be preset ID (`1`–`5`) or `uploads/` path, `..` blocked

**Avatar Upload:**
- Max size: 2 MB
- Allowed: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
- Stored in `Data/Avatar/uploads/` with unique server-generated filenames
- Old uploaded avatar file is automatically deleted when user uploads a new one
- Path traversal blocked (`..` sequences rejected)
- Rate limited: 20 requests / 15 min

### `examples.js` — Examples Lazy-Load API

| Method | Endpoint                                       | Auth  | Description                    |
|--------|-------------------------------------------------|-------|--------------------------------|
| GET    | `/api/examples/list/:type/:lang`                | No    | Meta-only list (hidden filtered)|
| GET    | `/api/examples/admin-list/:type/:lang`          | Admin | All examples with hidden flag  |
| GET    | `/api/examples/item/:type/:lang/:idx`           | No    | Single full example            |
| POST   | `/api/examples/toggle-visibility/:type/:lang/:idx` | Admin | Toggle hidden state         |
| POST   | `/api/examples/track-view`                      | Yes   | Log authenticated view         |
| POST   | `/api/examples/track-view-guest`                | No    | Log guest view                 |

**Path Parameters:**

| Param  | Valid Values                                 |
|--------|----------------------------------------------|
| `type` | `stack`, `ds`                                |
| `lang` | `c`, `cpp`, `java`, `python`, `javascript`  |
| `idx`  | 0-based array index                          |

**Security:** Type and language params validated against whitelists (prevents path traversal). Invalid values return `400`.

**Performance:**
- JSON files parsed once and cached in memory (per type+lang key)
- Hidden examples list cached in memory, async writes to disk
- List endpoint returns only `meta` fields (~5–20 KB vs ~3.6 MB full)
- `Cache-Control: public, max-age=3600` headers on GET endpoints
- UTF-8 BOM stripping for cross-platform compatibility

**Track-View Body Fields (optional):**
- `title` — example title (truncated to 200 chars)
- `lang` — language key (truncated to 20 chars)
- `type` — example type (truncated to 20 chars)

### `admin.js` — Admin Routes

| Method | Endpoint              | Auth  | Description                                    |
|--------|-----------------------|-------|------------------------------------------------|
| GET    | `/api/admin/users`    | Admin | List users (paginated) with per-user view counts |
| GET    | `/api/admin/stats`    | Admin | Dashboard analytics (user + execution stats)  |
| DELETE | `/api/admin/users/:id`| Admin | Delete user + their analytics data             |

**Pagination:** `?page=1&limit=50` (max 100 per page, defaults to page 1)

**Stats Pipeline:** User and Analytics `$facet` aggregations run in parallel via `Promise.all`:
- Total users & admins
- New users today / this week / this month
- Executions today / this month / total

**Delete User:** Cannot delete your own account. Also removes all analytics records for that user.

All admin routes require both JWT authentication and the `admin` role.
