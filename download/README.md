# Job Matching Platform — Build Documentation

This folder contains the complete planning and design documentation for the
Kenyan job matching platform. No code has been written yet — these files
are the **blueprint** that the engineering team will build from.

## File Index

| # | File | Format | Purpose |
|---|------|--------|---------|
| 1 | `Job_Matching_Platform_Technical_Documentation_v4.md` | Markdown | **Master technical spec.** All 15 sections: philosophy, architecture, schemas, normalization, LLM extraction, matching algorithm, DB schema, tech stack, API endpoints, UI flows, background jobs, roadmap, DPA compliance, field similarity, appendix. |
| 2 | `Job_Matching_Platform_Build_Plan.pdf` | PDF | **5-phase build plan.** Executive summary, architecture overview, phase-by-phase deliverables, dependencies, risk register, team composition, milestone checkpoints. Read this first. |
| 3 | `Job_Matching_Platform_Build_Plan.md` | Markdown | Same content as the PDF, in editable Markdown form for future revision. |

## Reading Order (Recommended)

1. **Start with the Build Plan PDF** — it tells you *what* gets built, *when*,
   and *who* does it. 10 weeks, 5 phases, 92 person-days total.
2. **Reference the v4.0 Technical Doc** as the source of truth for any
   design question that comes up during implementation. Each phase in the
   plan links back to specific sections of the spec.

## Phase Summary (Quick Look)

| Phase | Name | Weeks | Key Deliverables |
|-------|------|-------|------------------|
| **1** | Foundation & Infrastructure | 1-2 | Next.js 15 project, MySQL schema, NextAuth, normalization layer, consent infrastructure |
| **2** | Data Pipeline (CV + JD Processing) | 3-4 | LLM integration (Gemini 1.5 Flash), CV upload, 4 job input methods, field mapping |
| **3** | Matching Engine | 5-6 | Scoring algorithm (100pts), cron job, match API, explanations |
| **4** | Candidate UI | 7-8 | Landing page, onboarding, dashboard, job detail, mobile-responsive |
| **5** | Admin Portal + Privacy + Production | 9-10 | Admin job management, privacy center, tests, Vercel deploy, monitoring |

## Key Architectural Decisions

- **"Extract Once, Compute Many"** — LLM fires only at CV/JD ingestion; all matching is deterministic DB queries ($0 per match).
- **Candidate empowerment** — never hard-disqualify; rank but don't filter; let candidates choose up to 3 trajectories.
- **Soft-delete with 30-day grace period** — `is_active=FALSE` + `deleted_at`, daily purge cron handles permanent deletion.
- **REST-correct DELETE method** — privacy delete endpoint uses HTTP `DELETE`, not `POST`.
- **Kenya DPA 2019 compliant** — consent flows, data export, breach notification to ODPC within 72 hours, 2-year inactivity retention.

## Tech Stack

- Next.js 15 + TypeScript
- Prisma ORM + MySQL 8.0
- NextAuth.js (Google + Email)
- Gemini 1.5 Flash for LLM extraction
- Vercel + GitHub Actions cron

## Cost Profile

| Operating Point | Monthly Cost |
|-----------------|--------------|
| Small (1K CVs / 100 jobs) | ~$31 USD |
| Medium (10K CVs / 1K jobs) | ~$71 USD |
| Large (100K CVs / 10K jobs) | ~$410 USD |

Per-match cost is **$0** at every scale — the LLM never fires during matching.

## Next Steps

1. Review the Build Plan PDF end-to-end with the engineering team.
2. Confirm team composition (2 full-stack devs + part-time DevOps).
3. Schedule the Phase 1 kickoff (Foundation & Infrastructure, Week 1-2).
4. Provision the GitHub repo, Vercel project, and MySQL instance before Phase 1 starts.

---

*Documentation version: v4.0 (July 2026) · Build Plan v1.0 (July 2026)*
