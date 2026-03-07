# Models

Mongoose schemas and models for CodeLens.

## Files

### `User.js`
User account model with authentication support.

**Schema Fields:**

| Field       | Type     | Details                                      |
|-------------|----------|----------------------------------------------|
| `name`      | String   | Required, 2–50 characters, trimmed            |
| `email`     | String   | Required, unique, lowercase, regex validated  |
| `password`  | String   | Required, min 6 chars, excluded from queries  |
| `role`      | String   | Enum: `user` \| `admin` (default: `user`)     |
| `avatar`    | String   | Preset ID (`1`–`5`) or `uploads/` path        |
| `createdAt` | Date     | Auto-set on creation                          |

**Database Indexes:**

| Field       | Type    | Purpose                                |
|-------------|---------|----------------------------------------|
| `email`     | Unique  | Fast lookup, prevents duplicates       |
| `role`      | Regular | Efficient admin filtering              |
| `createdAt` | Desc    | Fast sorting for admin user listing    |

**Instance Methods:**

| Method                    | Returns   | Description                        |
|---------------------------|-----------|------------------------------------|
| `comparePassword(plain)`  | `boolean` | Compares bcrypt hash               |
| `toPublicJSON()`          | `object`  | Returns safe user object (no pwd)  |

**Pre-save Hook:** Auto-hashes password via bcrypt (salt rounds: 10). Only runs when `password` field is modified.

---

### `Analytics.js`
Example view tracking model for dashboard analytics.

**Schema Fields:**

| Field       | Type       | Details                                           |
|-------------|------------|---------------------------------------------------|
| `userId`    | ObjectId   | Ref to User, `null` for guest views               |
| `title`     | String     | Example title (e.g. "Hello World"), max 200 chars |
| `lang`      | String     | Language key (e.g. "c", "cpp"), max 20 chars      |
| `type`      | String     | Example type (e.g. "stack", "ds"), max 20 chars   |
| `timestamp` | Date       | Auto-set on creation                              |

**Database Indexes:**

| Index                         | Purpose                                       |
|-------------------------------|-----------------------------------------------|
| `userId`                      | Per-user view count aggregation                |
| `timestamp` (desc)            | Recent-first queries                           |
| `userId + timestamp` (compound) | Efficient per-user time-range queries       |
| `timestamp` (TTL: 90 days)   | Auto-delete old records to keep collection lean|

**Usage:**
- Created by `POST /api/examples/track-view` (authenticated) and `track-view-guest` (anonymous)
- Aggregated in admin stats via `$facet` pipeline
- Per-user view counts shown in admin user listing
