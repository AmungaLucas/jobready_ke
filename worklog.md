# JobReady KE — Multi-Agent Worklog

This file is the shared work log for all agents working on JobReady KE.
Append-only. New sections start with `---`.

---
Task ID: db-mysql-migration
Agent: main (super-z)
Task: Migrate JobReady KE from local SQLite to a remote MySQL DB (d7.my-control-panel.com / jobready_intel) before Phase 3.

Work Log:
- Inspected current Prisma schema (provider=sqlite) and `.env` (DATABASE_URL=file:...custom.db).
- Tested TCP reachability to d7.my-control-panel.com:3306 — OK.
- Installed `mysql2` and `dotenv` for direct connection tests.
- Confirmed credentials work via `mysql2/promise`: server is `10.6.23-MariaDB-cll-lve`, DB `jobready_intel` is empty, 0 tables.
- Identified that the shell had a stale `DATABASE_URL=file:...` env var overriding `.env`; must `unset DATABASE_URL` before running prisma.
- Identified that Prisma's default 10s pool_timeout was too short for the remote shared host; added `?connection_limit=3&connect_timeout=30&socket_timeout=60&pool_timeout=60` to the URL.
- Switched Prisma provider `sqlite` → `mysql` in `prisma/schema.prisma`.
- Added `@db.Text` / `@db.LongText` annotations to all long-text fields (description, requiredSkills, rawExperiences, rawInput, coverLetter, deletedData, etc.) — MySQL defaults String to VARCHAR(191) which would truncate these.
- Ran `prisma db push --accept-data-loss` — created all 16 tables on the remote DB. Verified ENUM columns are real MySQL ENUMs and TEXT/LONGTEXT columns have correct types.
- Wrote `scripts/seed-mysql.ts` as a standalone seed script (bypasses flaky dev server) mirroring `src/app/api/admin/seed-demo/route.ts`. Seeded: 2 users, 1 candidate, 2 education records, 3 clusters (2 selected), 6 jobs, 4 matches (scores 100/96/94/90).
- Wrote `scripts/verify-auth.ts` — confirmed NextAuth credentials flow works against remote MySQL: candidate@demo.com / admin@demo.com logins succeed; wrong password and non-existent user are rejected.
- Created `.env.example` documenting the MySQL connection string format and shared-host tuning parameters.

Stage Summary:
- Migration: COMPLETE. SQLite → MariaDB 10.6.23 on `d7.my-control-panel.com:3306/jobready_intel`.
- 16 tables provisioned with native MySQL ENUM + TEXT/LONGTEXT column types.
- Demo data seeded and verified.
- Auth flow verified end-to-end against remote DB.
- Connection string tuned for shared-host limits (pool=3, timeout=60s).
- Files changed: `prisma/schema.prisma`, `.env`, `.env.example`, `package.json`, `bun.lock`.
- New scripts: `scripts/test-mysql-connect.mjs`, `scripts/verify-mysql-schema.mjs`, `scripts/seed-mysql.ts`, `scripts/verify-seed.mjs`, `scripts/verify-auth.ts`.
- Next: commit & push to GitHub, then proceed to Phase 3.
