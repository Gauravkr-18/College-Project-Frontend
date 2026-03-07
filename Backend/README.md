# CodeLens — Backend API

Express 5 REST API with MongoDB, JWT authentication, lazy-load examples API,
admin dashboard, analytics tracking, and avatar upload support.

## Tech Stack

| Layer          | Technology                          |
|----------------|-------------------------------------|
| **Runtime**    | Node.js                             |
| **Framework**  | Express 5                            |
| **Database**   | MongoDB + Mongoose 9                |
| **Auth**       | JWT (jsonwebtoken) + bcryptjs       |
| **Security**   | Helmet, CORS, Rate Limiting         |
| **Upload**     | Multer (avatar images, 2 MB max)    |
| **Email**      | Nodemailer (OTP via SMTP/Gmail)     |
| **Other**      | Compression, Morgan (logging)       |

## Project Structure

```
Backend/
├── server.js           # App entry — middleware stack, routes, graceful shutdown
├── package.json        # Dependencies and scripts
├── .env                # Environment variables (never commit in production)
├── config/
│   └── db.js           # MongoDB connection (pool-optimised, auto-reconnect)
├── models/
│   ├── User.js         # User schema — bcrypt hashing, toPublicJSON(), OTP fields (select:false), indexes
│   └── Analytics.js    # View tracking — userId, title, lang, type, timestamp, 90-day TTL
├── middleware/
│   ├── auth.js         # JWT verification → attaches req.user
│   └── admin.js        # Admin role gate (requires auth first)
├── routes/
│   ├── auth.js         # Register, login, profile CRUD, avatar upload
│   ├── admin.js        # User listing (paginated), dashboard stats, delete user
│   └── examples.js     # Lazy-load examples list + single item + visibility toggle + analytics
└── Data/
    ├── Avatar/         # Preset avatars (1.png – 5.png)
    │   └── uploads/    # User-uploaded cropped avatars (old files auto-cleaned)
    ├── Examples/
    │   ├── Stack Examples/   # C.json, CPP.json, Java.json, JavaScript.json, Python.json
    │   ├── D.S Example/      # c.json (data structure examples)
    │   └── hiddenExamples.json  # Admin-toggled hidden state (cached in memory)
```

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
# Edit .env with your MongoDB URI and a strong JWT_SECRET

# 3. Ensure MongoDB is running
# mongod --dbpath /your/data/path

# 4. Start development server (with hot reload)
npm run dev

# 5. Or start production server
npm start
```

## Environment Variables

| Variable       | Description               | Default                             |
|----------------|---------------------------|-------------------------------------|
| `PORT`         | Server port               | `5000`                              |
| `NODE_ENV`     | Environment mode          | `development`                       |
| `MONGODB_URI`  | MongoDB connection string | `mongodb://localhost:27017/codelens` |
| `JWT_SECRET`   | JWT signing secret        | — (required, change in production)  |
| `JWT_EXPIRE`   | Token expiry duration     | `7d`                                |
| `CORS_ORIGINS` | Allowed origins (CSV)     | `http://localhost:5500,http://127.0.0.1:5500` |
| `EMAIL_HOST`   | SMTP host                 | `smtp.gmail.com`                    |
| `EMAIL_PORT`   | SMTP port                 | `587`                               |
| `EMAIL_USER`   | SMTP username / email     | — (required for password reset)    |
| `EMAIL_PASS`   | SMTP password / app-password | — (required for password reset) |
| `EMAIL_FROM`   | Sender display name+email | `"CodeLens" <EMAIL_USER>`           |

## API Endpoints

### Auth (`/api/auth`) — Rate limit: 20 req/15min (OTP routes: 8 req/15min)

| Method | Path                 | Auth | Description                              |
|--------|----------------------|------|------------------------------------------|
| POST   | `/register`          | No   | Create account (name 2–50, pwd 6–128)    |
| POST   | `/login`             | No   | Authenticate, returns JWT token          |
| GET    | `/me`                | Yes  | Get current user profile                 |
| PUT    | `/me`                | Yes  | Update name and/or avatar                |
| POST   | `/upload-avatar`     | Yes  | Upload cropped avatar (2 MB, images only)|
| POST   | `/forgot-password`   | No   | Send 6-digit OTP to registered email     |
| POST   | `/verify-otp`        | No   | Verify the 6-digit OTP code              |
| POST   | `/reset-password`    | No   | Reset password (requires verified OTP)   |

**Forgot-password flow:**
1. `POST /forgot-password` with `{ email }` → OTP emailed (10-min expiry). Always returns 200 (no email enumeration).
2. `POST /verify-otp` with `{ email, otp }` → marks OTP as verified (5-min window to reset).
3. `POST /reset-password` with `{ email, otp, newPassword }` → updates password, clears OTP fields.

### Examples (`/api/examples`) — Rate limit: 100 req/15min

| Method | Path                                   | Auth  | Description                               |
|--------|----------------------------------------|-------|-------------------------------------------|
| GET    | `/list/:type/:lang`                    | No    | Meta-only list (hidden examples filtered) |
| GET    | `/admin-list/:type/:lang`              | Admin | Full list including hidden flag           |
| GET    | `/item/:type/:lang/:idx`               | No    | Single full example (meta + steps)        |
| POST   | `/toggle-visibility/:type/:lang/:idx`  | Admin | Toggle hidden state of an example         |
| POST   | `/track-view`                          | Yes   | Log authenticated user's view             |
| POST   | `/track-view-guest`                    | No    | Log guest user's view                     |

**Type values:** `stack`, `ds`
**Language values:** `c`, `cpp`, `java`, `python`, `javascript`

The list endpoint returns only `meta` fields (~5–20 KB) instead of full examples (~3.6 MB for C.json),
enabling lazy loading. Individual examples are fetched on demand via the item endpoint.

Both GET endpoints include `Cache-Control: public, max-age=3600` headers since example data is static.
Track-view endpoints store `{ title, lang, type }` from the request body (truncated for safety).

### Admin (`/api/admin`) — Rate limit: 100 req/15min

| Method | Path          | Auth  | Description                                   |
|--------|---------------|-------|-----------------------------------------------|
| GET    | `/users`      | Admin | List users (paginated) with per-user view counts |
| GET    | `/stats`      | Admin | Dashboard analytics (users + executions)      |
| DELETE | `/users/:id`  | Admin | Delete user + their analytics (cannot delete self) |

**Pagination:** `?page=1&limit=50` (max 100 per page).

**Stats:** Uses `$facet` aggregation on User + Analytics collections, run in parallel via `Promise.all`.

### Health

| Method | Path          | Auth | Description                |
|--------|---------------|------|----------------------------|
| GET    | `/api/health` | No   | Server status + uptime     |

## Data Format

### Stack Examples JSON

Each language file (e.g., `C.json`) contains an array of examples:

```json
{
  "meta": {
    "title": "Hello World",
    "total_steps": 5,
    "code": "#include <stdio.h>\n...",
    "final_output": "Hello, World!\n",
    "level": "easy|medium|hard",
    "category": "basics|arithmetic|loops|...",
    "description": "Program description..."
  },
  "execution_steps": [
    {
      "step": 1,
      "line": 1,
      "description": "Step description...",
      "stack_update": { "action": "create_stack_frame", "..." },
      "data_segment_update": null,
      "terminal_update": "output text",
      "return_value": null
    }
  ]
}
```

### D.S Examples JSON

Same outer structure, but steps use `ds_update` instead of `stack_update`:

```json
{
  "step": 2,
  "line": 5,
  "description": "Pointer i moves to index 3",
  "ds_update": { "action": "update_pointer", "pointer_name": "i", "pointer_value": 3 },
  "terminal_update": null
}
```

### Analytics Document

```json
{
  "userId": "ObjectId | null",
  "title": "Hello World",
  "lang": "c",
  "type": "stack",
  "timestamp": "2026-02-19T10:30:00Z"
}
```
Records auto-expire after 90 days via MongoDB TTL index.

## Performance Optimisations

| Area                  | Detail                                                          |
|-----------------------|-----------------------------------------------------------------|
| **Example caching**   | JSON files parsed once per type+lang key, held in memory        |
| **Hidden list cache** | `hiddenExamples.json` cached in-memory, async disk writes       |
| **Stats pipeline**    | User + Analytics `$facet` aggregations run in parallel          |
| **Compression**       | gzip via `compression` middleware                               |
| **Static caching**    | Avatars: 1-day cache, examples: 1-hour cache (ETag enabled)    |
| **Fire-and-forget**   | Analytics writes don't block the response                       |
| **Connection pool**   | Mongoose pool: 2–10 connections, 5s selection timeout           |
| **Old avatar cleanup**| Previous uploaded avatar file deleted on new upload             |

## Security Features

| Feature                | Details                                                   |
|------------------------|-----------------------------------------------------------|
| **Helmet**             | HTTP security headers (XSS, sniffing, clickjacking)      |
| **Rate Limiting**      | 100 req/15min general, 20 req/15min auth, 8 req/15min OTP |
| **OTP Security**       | SHA-256 hashed before storage (select:false), 10-min expiry, same response for unknown emails |
| **Email**              | Nodemailer SMTP; OTP fire-and-forget (email failure doesn't expose errors) |
| **CORS**               | Configurable allowed origins via `CORS_ORIGINS` env var   |
| **Compression**        | Gzip response compression                                 |
| **Password Hashing**   | bcrypt with 10 salt rounds                                |
| **Password Length**    | 6–128 chars enforced (upper bound prevents bcrypt DoS)    |
| **Name Length**        | 2–50 chars enforced on register and update                |
| **JWT Auth**           | Token-based stateless authentication with configurable expiry |
| **Input Validation**   | Mongoose schema validators + route-level sanitisation     |
| **Path Traversal**     | Avatar path validation blocks `..` sequences              |
| **File Upload**        | Extension whitelist + 2 MB size limit + server-generated filenames |
| **Example Whitelists** | Type/language params validated against hardcoded maps     |
| **Track Input Limits** | Analytics title truncated to 200 chars, lang/type to 20   |
| **TTL Auto-Cleanup**   | Analytics records expire after 90 days                    |
| **Graceful Shutdown**  | SIGTERM/SIGINT handling with 10s force-close timeout      |

## Scripts

| Command       | Description                        |
|---------------|------------------------------------|
| `npm start`   | Start server (production)          |
| `npm run dev` | Start with Nodemon (auto-restart)  |
