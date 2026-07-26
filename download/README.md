# Job Matching Platform — Kenya

A Kenyan job matching platform that ranks candidates against jobs without ever disqualifying them. Built on the **"Extract Once, Compute Many"** architecture: LLM fires only at CV/JD ingestion, all matching is deterministic DB queries at $0 per match.

## Status

**Phase 1 — Foundation & Infrastructure** ✅ COMPLETE

- ✅ Next.js 16 + TypeScript + Tailwind 4 + shadcn/ui
- ✅ Prisma schema (15 models, soft-delete, consent records)
- ✅ NextAuth.js credentials provider (candidate + admin roles)
- ✅ Word-boundary normalization (4 enums, anti-false-positive regex)
- ✅ Field similarity mapping (3-tier: exact → group → partial-word)
- ✅ Scoring algorithm (100 pts: title 40 + skills 35 + edu 15 + field 5 + exp 10)
- ✅ Privacy layer (DPA 2019 compliant: export, soft-delete, consent recording)
- ✅ Candidate UI (landing, auth, dashboard, job detail, profile/privacy)
- ✅ Admin UI (job creation form, jobs list, seed-demo, compute-matches)
- ✅ Demo data seeding (admin + candidate accounts, 6 jobs, pre-computed matches)

## Quick Start

```bash
# 1. Database is already initialized (SQLite at db/custom.db)
# 2. Dev server is running at http://localhost:3000

# 3. Seed demo data (one-time):
curl -X POST http://localhost:3000/api/admin/seed-demo

# 4. Login with demo accounts:
#    Candidate: candidate@demo.com / password123
#    Admin:     admin@demo.com / password123
```

## Documentation

- `download/Job_Matching_Platform_Technical_Documentation_v4.md` — Master spec (3,014 lines, 15 sections)
- `download/Job_Matching_Platform_Build_Plan.pdf` — 5-phase, 10-week build plan
- `download/job-detail-preview.png` — Screenshot of job detail view
- `download/profile-privacy-preview.png` — Screenshot of profile/privacy view

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui (New York) |
| Database | Prisma ORM + SQLite (dev) / MySQL (prod) |
| Auth | NextAuth.js v4 (Credentials provider) |
| State | TanStack Query (server) + React hooks (client) |
| Validation | Zod |
| Notifications | Sonner |
| LLM (Phase 2) | Gemini 1.5 Flash via z-ai-web-dev-sdk |

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                     Next.js App (port 3000)                    │
│                                                                │
│  ┌─────────────────┐    ┌─────────────────┐                   │
│  │  Candidate UI   │    │   Admin UI      │                   │
│  │  • Landing      │    │  • Job form     │                   │
│  │  • Auth modal   │    │  • Jobs list    │                   │
│  │  • Matches      │    │  • Seed demo    │                   │
│  │  • Job detail   │    │  • Compute      │                   │
│  │  • Profile      │    │                 │                   │
│  └────────┬────────┘    └────────┬────────┘                   │
│           │                       │                            │
│           ▼                       ▼                            │
│  ┌──────────────────────────────────────────┐                  │
│  │            API Routes (Next.js)          │                  │
│  │  • /api/auth/* (NextAuth)                │                  │
│  │  • /api/jobs (list, detail)              │                  │
│  │  • /api/matches (candidate matches)      │                  │
│  │  • /api/cv/upload, /api/cv/profile       │                  │
│  │  • /api/admin/jobs (CRUD)                │                  │
│  │  • /api/admin/compute-matches            │                  │
│  │  • /api/admin/seed-demo                  │                  │
│  │  • /api/privacy/{export,delete,consent}  │                  │
│  └────────────────┬─────────────────────────┘                  │
│                   │                                            │
│           ┌───────┴───────┐                                    │
│           ▼               ▼                                    │
│  ┌─────────────┐   ┌──────────────────┐                       │
│  │  lib/db.ts  │   │  lib/matching.ts │                       │
│  │  (Prisma)   │   │  (100-pt score)  │                       │
│  └──────┬──────┘   └────────┬─────────┘                       │
│         │                   │                                  │
│         ▼                   ▼                                  │
│  ┌──────────────────────────────────────┐                      │
│  │  lib/normalization.ts                │                      │
│  │  lib/field-mapping.ts                │                      │
│  │  (word-boundary regex + 3-tier map)  │                      │
│  └──────────────────────────────────────┘                      │
│                                                                │
│  ┌──────────────────────────────────────────┐                  │
│  │           SQLite Database (Prisma)       │                  │
│  │  15 models: User, Candidate, Education,  │                  │
│  │  Cluster, Job, JobMatch, Application,    │                  │
│  │  SavedJob, ConsentRecord,               │                  │
│  │  DeletionRequest, ExportRequest,        │                  │
│  │  ParseFailure, Account, Session,        │                  │
│  │  VerificationToken                      │                  │
│  └──────────────────────────────────────────┘                  │
└────────────────────────────────────────────────────────────────┘
```

## Key Files

| Path | Purpose |
|------|---------|
| `prisma/schema.prisma` | Database schema (15 models, soft-delete, consent) |
| `src/lib/db.ts` | Prisma client singleton |
| `src/lib/auth.ts` | NextAuth config + password hashing |
| `src/lib/normalization.ts` | 4-enum word-boundary normalization |
| `src/lib/field-mapping.ts` | 3-tier field similarity (Section 14) |
| `src/lib/matching.ts` | 100-point scoring algorithm (Section 6) |
| `src/lib/types/index.ts` | Shared TS types + display labels |
| `src/app/page.tsx` | Main SPA (landing + auth + dashboard + admin) |
| `src/app/api/` | All API routes (12 endpoints) |
| `src/components/auth/auth-modal.tsx` | Sign-in / sign-up modal |
| `src/components/candidate/matches-list.tsx` | Ranked matches dashboard |
| `src/components/candidate/cv-upload-modal.tsx` | CV paste/upload |
| `src/components/jobs/job-detail-panel.tsx` | Single job + score breakdown |
| `src/components/privacy/profile-panel.tsx` | Profile + DPA controls |
| `src/components/admin/admin-job-form.tsx` | 4-input-method job creation |
| `src/components/admin/admin-jobs-list.tsx` | Admin jobs table + compute button |

## Scoring Algorithm (Section 6 of v4.0 doc)

| Dimension | Max Pts | Type | Source |
|-----------|---------|------|--------|
| Job Function match | Required | Filter | cluster.function = job.function |
| Job Title match | 40 | Scored | Word-boundary keyword overlap |
| Skills match | 35 | Scored | Required (70%) + preferred (30%) |
| Education Level | 15 | Scored | Sliding scale vs job minimum |
| Education Field | 5 | Scored | 3-tier (exact 5 / group 4 / partial 2) |
| Experience Years | 10 | Scored | Sliding scale (100%/75%/50%/25%) |
| **Total** | **100** | | |

Missing data never disqualifies — it scores 0 for that dimension.

## DPA 2019 Compliance

- ✅ Consent recording at signup + CV upload
- ✅ Data export endpoint (JSON download)
- ✅ Account deletion (HTTP DELETE, soft-delete with 30-day grace)
- ✅ Daily purge cron (audit trail captured before hard delete)
- ✅ Monthly inactivity sweep (2-year retention)
- ✅ Soft-delete columns (`is_active`, `deleted_at`) on User + Candidate

## Roadmap (Phases 2-5)

| Phase | Status | Focus |
|-------|--------|-------|
| 1 — Foundation | ✅ Done | Schema, auth, normalization, scoring, UI shell |
| 2 — Data Pipeline | Pending | Gemini LLM extraction, file upload, clustering |
| 3 — Matching Engine | Pending | Cron job (5-min), recompute on update, scaling |
| 4 — Candidate UI | Pending | Save jobs, applications, mobile polish, alerts |
| 5 — Admin + Production | Pending | Vercel deploy, monitoring, MySQL, final tests |

## License

Proprietary. © 2026 JobMatch Kenya.
