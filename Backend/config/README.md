# Config

Database configuration for CodeLens Backend.

## Files

### `db.js`
MongoDB connection using Mongoose with optimized settings.

**Connection Settings:**

| Setting                      | Value  | Purpose                            |
|------------------------------|--------|------------------------------------|
| `maxPoolSize`                | 10     | Max concurrent connections         |
| `minPoolSize`                | 2      | Keep-alive connections             |
| `serverSelectionTimeoutMS`   | 5000   | Fail fast if server unreachable    |
| `socketTimeoutMS`            | 45000  | Timeout for individual operations  |

**Connection Events Monitored:**
- `error` — Logs connection errors
- `disconnected` — Warns and triggers auto-reconnect
- `reconnected` — Confirms successful reconnection

## Environment Variables

| Variable       | Description                     | Default                              |
|----------------|---------------------------------|--------------------------------------|
| `MONGODB_URI`  | MongoDB connection string       | `mongodb://localhost:27017/codelens`  |

## Usage

```js
const connectDB = require('./config/db');
connectDB(); // Called once in server.js at startup
```

The function exits the process with code 1 if the initial connection fails.
