# Deploying JobReady KE to Vercel

This guide covers the env vars, DB host firewall, and Prisma client setup needed for the app to run on Vercel.

---

## 1. Required environment variables

In your Vercel project dashboard → **Settings → Environment Variables**, add the following for **all environments** (Production, Preview, Development):

| Name | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `mysql://jobready_intel_admin:Admincyber@d7.my-control-panel.com:3306/jobready_intel?connection_limit=3&connect_timeout=30&socket_timeout=60&pool_timeout=60` | The query string is **required** — Vercel serverless functions run with a 10s default timeout. Without `pool_timeout=60` and a small `connection_limit`, Prisma will hang. |
| `NEXTAUTH_SECRET` | (32+ random chars) | Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://jobready-ke.vercel.app` | The canonical public URL of your deployment. No trailing slash. |
| `GEMINI_API_KEY` | (optional) | If unset, the LLM extraction layer uses a deterministic stub. Leave empty for now. |

> **Do not** commit `.env` to git. It is in `.gitignore` and a template is provided in `.env.example`.

---

## 2. Allow Vercel to reach your MySQL host

Your DB lives at `d7.my-control-panel.com:3306` — a cPanel/DirectAdmin shared host. **By default, many of these hosts firewall port 3306 to a whitelist of IPs.** Vercel serverless functions run from dynamic IPs, so:

1. Log in to your hosting control panel (cPanel / DirectAdmin / etc.)
2. Look for **"Remote MySQL"** or **"Database Access Hosts"** under the Databases section
3. Add the wildcard `%` (or, more securely, the full list of Vercel region IP ranges listed at https://vercel.com/docs/edge-network/regions)

If you do not do this, every API call that touches the DB will time out and return `REG_DB-UNREACHABLE`.

---

## 3. Verify deployment with the health endpoint

Once env vars are set and the host firewall is open, visit:

```
https://jobready-ke.vercel.app/api/health
```

You should see JSON like:

```json
{
  "ok": true,
  "env": {
    "hasDatabaseUrl": true,
    "databaseUrlProtocol": "mysql",
    "databaseUrlHost": "d7.my-control-panel.com",
    ...
  },
  "prismaClient": "6.19.2",
  "db": {
    "state": "ok",
    "latencyMs": 240,
    "userCount": 2,
    "error": null
  }
}
```

If `db.state` is `fail` or `timeout`, check the `db.error` field for a sanitized hint.

---

## 4. Re-seed the production DB (only if needed)

The remote MySQL DB is shared between local dev and Vercel production. Demo data was already seeded during the Phase 2 DB migration:

- **Admin** — `admin@demo.com` / `password123`
- **Candidate** — `candidate@demo.com` / `password123`
- **6 demo jobs**, **4 pre-computed matches**

If you ever need to re-seed from your local machine:

```bash
unset DATABASE_URL   # IMPORTANT — the shell may have a stale SQLite URL
bun scripts/seed-mysql.ts
```

---

## 5. Common issues

### `REG_DB-UNREACHABLE` on register / login
**Cause:** Either `DATABASE_URL` is missing from Vercel env vars, or the MySQL host firewall is blocking Vercel's IP.
**Fix:** See sections 1 and 2 above.

### `REG_DB-CONFIG`
**Cause:** `DATABASE_URL` is present but malformed, or the user/password is wrong.
**Fix:** Verify the connection string with `scripts/test-mysql-connect.mjs` locally.

### `REG_UNKNOWN`
**Cause:** Something unexpected — Prisma schema mismatch, missing generated client, or an unknown error.
**Fix:** Check Vercel function logs (Dashboard → your project → Logs). The most common fix is ensuring `postinstall: prisma generate` is in `package.json` (it is, as of commit `f7ad030`).

### Function timeout on Vercel Hobby (10s)
**Cause:** The remote MySQL handshake is slow (~1-2s on a good day) and bcrypt hashing adds ~300ms. If the function does multiple sequential DB calls, it can blow past 10s.
**Fix:** Already mitigated with `connection_limit=3` and `pool_timeout=60`. If still timing out, consider upgrading to Vercel Pro (15s default, configurable up to 60s).
