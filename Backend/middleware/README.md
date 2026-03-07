# Middleware

Authentication and authorization middleware for route protection.

## Files

### `auth.js` — JWT Verification

Extracts and verifies JWT tokens from the `Authorization` header.

**Flow:**
1. Reads `Authorization: Bearer <token>` header
2. Verifies token signature against `JWT_SECRET`
3. Looks up user in database by decoded ID
4. Attaches full `req.user` (Mongoose document) for route handlers

**Error Responses:**

| Status | Condition               | Message                            |
|--------|-------------------------|------------------------------------|
| 401    | No token provided       | Not authorized - No token provided |
| 401    | Token expired           | Not authorized - Token expired     |
| 401    | Invalid/malformed token | Not authorized - Invalid token     |
| 401    | User deleted            | Not authorized - User not found    |

**Usage:**
```js
router.get('/protected', authMiddleware, handler);
```

### `admin.js` — Admin Role Gate

Checks that `req.user.role === 'admin'`. **Must be used after `auth.js`.**

**Error Response:** `403 — Access denied - Admin only`

**Usage:**
```js
router.use(authMiddleware);
router.use(adminMiddleware);
// All routes below require admin role
```

## Middleware Chain

```
Request → auth.js (JWT verify, attach user) → admin.js (role check) → Route Handler
```
