"""
Finalize the v4.0 Technical Documentation:
1. Change privacy DELETE endpoint from POST to DELETE method (REST semantics)
2. Replace cascading hard-delete with soft-delete (is_active=FALSE, deleted_at=NOW())
3. Add Section 15: Appendix / Quick Reference
   - Score breakdown table
   - "What gets matched vs stored" matrix
   - Input methods summary
4. Remove artificial "End of Documentation" marker (Rule 6 violation)
5. Update Version History to note Section 15 addition
6. Update Summary table to reference Section 15
"""
import re
from pathlib import Path

DOC_PATH = Path('/home/z/my-project/download/Job_Matching_Platform_Technical_Documentation_v4.md')

content = DOC_PATH.read_text(encoding='utf-8')

# ─────────────────────────────────────────────────────────────
# 1. Change POST -> DELETE for privacy/delete endpoint
# ─────────────────────────────────────────────────────────────
old_delete_handler = """export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
        const { confirm } = await request.json();
        
        if (!confirm || confirm !== 'DELETE') {
            return Response.json({ 
                error: 'Please type DELETE to confirm account deletion' 
            }, { status: 400 });
        }
        
        // Record deletion request
        await query(
            `INSERT INTO deletion_requests (user_id, status) VALUES (?, ?)`,
            [session.user.id, 'pending']
        );
        
        // Trigger background deletion job
        // Cascading delete: candidates -> clusters, extras, matches,
        //                     consent_records, applications
        
        return Response.json({
            success: true,
            message: 'Account deletion request submitted. Your data will be permanently deleted within 30 days.'
        });
        
    } catch (error) {
        return Response.json({ error: (error as Error).message }, { status: 500 });
    }
}"""

new_delete_handler = """export async function DELETE(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { confirm } = await request.json();

        if (!confirm || confirm !== 'DELETE') {
            return Response.json({
                error: 'Please type DELETE to confirm account deletion'
            }, { status: 400 });
        }

        // Record deletion request for audit trail
        await query(
            `INSERT INTO deletion_requests (user_id, status) VALUES (?, ?)`,
            [session.user.id, 'pending']
        );

        // Soft-delete: mark candidate inactive, schedule purge after 30-day grace period.
        // Hard purge is performed by a monthly cron job (see Section 13.7).
        // During the grace period the user may still log in and revoke the request.
        await query(
            `UPDATE candidates
                SET is_active = FALSE,
                    deleted_at = NOW()
              WHERE id = ?`,
            [session.user.id]
        );

        return Response.json({
            success: true,
            message: 'Account deletion request submitted. Your data will be permanently purged within 30 days. You may revoke this request by logging in before the purge completes.'
        });

    } catch (error) {
        return Response.json({ error: (error as Error).message }, { status: 500 });
    }
}"""

assert old_delete_handler in content, "Could not find original DELETE handler block"
content = content.replace(old_delete_handler, new_delete_handler)
print("[1/6] Changed privacy DELETE endpoint from POST to DELETE method")

# ─────────────────────────────────────────────────────────────
# 2. Add is_active / deleted_at columns note in 13.4 Database Additions
#    (only if not already present)
# ─────────────────────────────────────────────────────────────
if 'deleted_at' not in content.split('## 13.4 Database Additions')[1].split('## 13.5')[0]:
    # Insert soft-delete columns into the candidates table alterations
    old_db_additions_anchor = """-- Add privacy-related columns to candidates table
ALTER TABLE candidates
ADD COLUMN consent_version VARCHAR(20) DEFAULT '1.0',
ADD COLUMN consent_date DATETIME,"""
    new_db_additions_anchor = """-- Add privacy-related columns to candidates table
-- Soft-delete columns support the 30-day grace period before permanent purge.
ALTER TABLE candidates
ADD COLUMN is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN deleted_at DATETIME NULL,
ADD COLUMN consent_version VARCHAR(20) DEFAULT '1.0',
ADD COLUMN consent_date DATETIME,"""
    if old_db_additions_anchor in content:
        content = content.replace(old_db_additions_anchor, new_db_additions_anchor)
        print("[2/6] Added is_active/deleted_at soft-delete columns to candidates table")
    else:
        print("[2/6] SKIPPED - soft-delete column anchor not found (may already be present)")
else:
    print("[2/6] SKIPPED - soft-delete columns already present")

# ─────────────────────────────────────────────────────────────
# 3. Add Section 15: Appendix / Quick Reference
#    Insert BEFORE "# Summary of Key Decisions"
# ─────────────────────────────────────────────────────────────
section_15 = """# 15. Appendix / Quick Reference

This appendix consolidates the most-referenced decisions and data shapes into a single quick-lookup section. It is intended for engineers, QA testers, and product reviewers who need to verify behavior without re-reading the full document.

## 15.1 Score Breakdown Table

The matching algorithm allocates a maximum of 100 points across five dimensions. Function match is a hard requirement (filter, not scored); the remaining five dimensions contribute to the candidate's rank within the function-matched set. No single dimension can disqualify a candidate; missing data simply results in zero points for that dimension.

| Dimension            | Max Points | Type        | Source                       | Disqualifies? |
|----------------------|------------|-------------|------------------------------|---------------|
| Job Function match   | Required   | Filter      | `candidate_clusters.function` vs `job.function` | Yes (filter)  |
| Job Title match      | 40         | Scored      | Cluster titles vs `job.title` (word-boundary regex) | No            |
| Skills match         | 35         | Scored      | Cluster skills ∩ `job.required_skills` (count-weighted) | No            |
| Education Level      | 15         | Scored      | Highest candidate education level vs `job.min_education` | No            |
| Education Field      | 5          | Scored      | `isFieldRelated()` 3-tier matrix (exact / group / partial) | No            |
| Experience Years     | 10         | Scored      | Cluster years vs `job.min_experience` (sliding scale) | No            |
| **Total**            | **100**    |             |                              |               |

Table 15.1: Scoring Dimensions and Weights

### 15.1.1 Experience Sliding Scale (10 points max)

The 10 experience points are not all-or-nothing. They are awarded on a sliding scale to reward candidates who exceed the minimum without penalizing those who just meet it.

| Candidate Experience vs Job Minimum    | Points Awarded |
|----------------------------------------|----------------|
| Meets or exceeds minimum (>= 100%)     | 10             |
| 75% to 99% of minimum                  | 7              |
| 50% to 74% of minimum                  | 4              |
| 25% to 49% of minimum                  | 2              |
| Less than 25% of minimum               | 0              |

Table 15.2: Experience Points Sliding Scale

### 15.1.2 Education Level Points (15 points max)

Education points are awarded based on whether the candidate's highest qualification meets or exceeds the job's minimum requirement.

| Candidate Level vs Job Minimum         | Points Awarded |
|----------------------------------------|----------------|
| Exceeds by 2+ levels                   | 15             |
| Exceeds by 1 level                     | 13             |
| Exactly meets minimum                  | 12             |
| One level below minimum                | 6              |
| Two levels below minimum               | 2              |
| Three or more levels below             | 0              |

Table 15.3: Education Level Points

Education level enum order (low to high): `none` < `certificate` < `diploma` < `bachelors` < `masters` < `phd`.

## 15.2 What Gets Matched vs What Gets Stored

This matrix clarifies which candidate data fields are used by the matching engine versus which are stored only for the resume builder and profile display. This distinction is critical: storing data without using it for matching preserves the candidate-empowerment philosophy (we never silently filter on data the candidate didn't intend to be matched on).

| Data Field                     | Stored? | Used for Matching? | Used For                                   |
|--------------------------------|---------|--------------------|--------------------------------------------|
| Job Function (cluster)         | Yes     | Yes (filter)       | Primary match filter                       |
| Job Titles (cluster)           | Yes     | Yes (40 pts)       | Title match scoring                        |
| Skills (cluster)               | Yes     | Yes (35 pts)       | Skills overlap scoring                     |
| Education Level                | Yes     | Yes (15 pts)       | Education level scoring                    |
| Education Field                | Yes     | Yes (5 pts)        | Field relatedness scoring                  |
| Experience Years (cluster)     | Yes     | Yes (10 pts)       | Experience scoring                         |
| Sector (job only)              | Yes     | Yes (job-side)     | Job metadata, displayed to candidate       |
| Job Type (job only)            | Yes     | Yes (job-side)     | Job metadata, displayed to candidate       |
| Certifications                 | Yes     | **No**             | Resume builder, profile display            |
| Referees                       | Yes     | **No**             | Resume builder, shared only on application |
| Languages spoken               | Yes     | **No**             | Profile display                            |
| Location / County              | Yes     | **No**             | Displayed to candidate; never filters jobs |
| Salary expectation             | Yes     | **No**             | Displayed to candidate; never filters jobs |
| Administrative requirements    | Yes     | **No**             | Candidate self-selects at apply time       |
| Soft skills (free text)        | Yes     | **No**             | Profile display only                       |
| Profile photo                  | Yes     | **No**             | Profile display only                       |

Table 15.4: Matched vs Stored Data Matrix

The principle behind this matrix is simple: **the candidate, not the algorithm, decides whether they qualify for a job's non-functional requirements.** Location, salary, and administrative requirements are surfaced to the candidate as information; the candidate chooses whether to apply. This avoids the common platform failure mode where good candidates are silently filtered out because they live in the "wrong" county or expect slightly above the listed salary band.

## 15.3 Job Input Methods Summary

The platform supports four distinct ways for admins to create job postings. Two of them invoke the LLM extractor; two of them bypass it entirely. The choice of method depends on the source of the job data and the admin's preference for control versus convenience.

| Method                | LLM Fires? | Input Format             | Best For                                            | Latency         | Cost per Job |
|-----------------------|------------|--------------------------|-----------------------------------------------------|-----------------|--------------|
| **Paste JD text**     | Yes        | Raw JD text in textarea  | Job descriptions copied from email or PDF           | 3-8 seconds     | ~$0.001      |
| **Upload JD file**    | Yes        | PDF / DOCX / TXT file    | Job descriptions received as attachments            | 5-12 seconds    | ~$0.001      |
| **Paste structured JSON** | No     | Pre-formatted JSON       | Programmatic import, partner integrations           | < 1 second      | $0           |
| **Fill form manually**| No         | Form fields (selects/text) | Quick admin entry, corrections to LLM output     | < 1 second      | $0           |

Table 15.5: Job Input Methods Comparison

### 15.3.1 Input Method Decision Tree

```
Admin creates a new job posting
        |
        v
   Is the JD already structured
   as JSON (e.g., from a partner API)?
        |
   Yes--+--No
        |     |
        |     v
        |   Is the JD a file
        |   (PDF/DOCX/TXT)?
        |     |
        |  Yes--+--No
        |        |     |
        |        |     v
        |        |   Is the JD text
        |        |   you can copy-paste?
        |        |     |
        |        |  Yes--+--No
        |        |        |     |
        |        |        |     v
        |        |        |  Fill form manually
        |        |        |  (no LLM, $0)
        |        |        |
        |        |        v
        |        |   Paste JD text (LLM, ~$0.001)
        |        |
        |        v
        |   Upload JD file (LLM, ~$0.001)
        |
        v
   Paste JSON (no LLM, $0)
```

Figure 15.1: Input Method Decision Tree

### 15.3.2 JSON Input Schema (for paste-JSON method)

When using the paste-JSON method, the admin provides a JSON object matching the job schema exactly. No LLM is invoked; the JSON is validated against the schema and inserted directly. This is the fastest and cheapest input method, ideal for bulk imports or partner integrations.

```json
{
  "title": "Senior Accountant",
  "function": "finance",
  "sector": "financial_services",
  "job_type": "full_time",
  "min_education": "bachelors",
  "education_field": "accounting",
  "min_experience": 5,
  "required_skills": ["accounting", "ifrs", "audit", "taxation", "quickbooks"],
  "preferred_skills": ["sap", "hyperion"],
  "description": "We are seeking a Senior Accountant to lead our...",
  "location": "Nairobi, Kenya",
  "salary_range": "KES 150,000 - 250,000",
  "application_deadline": "2026-09-30",
  "administrative_requirements": ["CPA K", "3 professional referees"]
}
```

Listing 15.1: Example JSON payload for the paste-JSON input method

## 15.4 API Endpoint Quick Reference

The full API surface is documented in Section 9. This condensed reference lists every endpoint with its HTTP method, path, and purpose, so engineers can scan the surface area at a glance.

| Method   | Path                                | Purpose                                          | Auth Required |
|----------|-------------------------------------|--------------------------------------------------|---------------|
| POST     | `/api/auth/callback/credentials`    | Email/password login                             | No            |
| POST     | `/api/auth/callback/google`         | Google OAuth login                               | No            |
| POST     | `/api/auth/register`                | New candidate signup                             | No            |
| POST     | `/api/cv/upload`                    | Upload CV file for LLM extraction                | Candidate     |
| GET      | `/api/cv/profile`                   | Get candidate's extracted profile                | Candidate     |
| PUT      | `/api/cv/profile`                    | Edit extracted profile (post-LLM correction)     | Candidate     |
| POST     | `/api/cv/trajectories`              | Save up to 3 selected career trajectories        | Candidate     |
| GET      | `/api/jobs`                         | List active jobs (paginated)                     | Candidate     |
| GET      | `/api/jobs/:id`                     | Get job detail + match explanation               | Candidate     |
| POST     | `/api/jobs/:id/apply`               | Apply to a job                                   | Candidate     |
| GET      | `/api/matches`                      | Get candidate's ranked match list                | Candidate     |
| POST     | `/api/admin/jobs`                   | Create job (any of 4 input methods)              | Admin         |
| PUT      | `/api/admin/jobs/:id`               | Update job posting                               | Admin         |
| DELETE   | `/api/admin/jobs/:id`               | Deactivate job posting (soft-delete)             | Admin         |
| GET      | `/api/admin/stats`                  | Platform statistics dashboard                    | Admin         |
| GET      | `/api/privacy/export`               | Download candidate's data as JSON                | Candidate     |
| DELETE   | `/api/privacy/delete`               | Request account deletion (soft-delete + 30-day purge) | Candidate |
| GET      | `/api/privacy/consent`              | View current consent records                     | Candidate     |
| POST     | `/api/privacy/consent`              | Update consent preferences                       | Candidate     |

Table 15.6: Complete API Endpoint Reference

## 15.5 Normalization Enum Quick Reference

The platform uses three primary enums for matching: Education Level, Job Function, and Sector. The full canonical values are listed here for quick lookup. The normalization pipeline (Section 4) maps user-supplied variants to these canonical values using word-boundary regex.

### 15.5.1 Education Levels (canonical order, low to high)

```
none -> certificate -> diploma -> bachelors -> masters -> phd
```

### 15.5.2 Job Functions (12 categories)

```
engineering, finance, marketing, sales, operations,
human_resources, technology, design, customer_service,
healthcare, education, legal
```

### 15.5.3 Sectors (job-only, 12 categories)

```
technology, financial_services, healthcare, education,
manufacturing, retail, agriculture, construction,
hospitality, government, non_profit, media
```

### 15.5.4 Job Types

```
full_time, part_time, contract, internship, temporary, freelance
```

## 15.6 Cost & Scale Reference

The platform's economic model is built on the "Extract Once, Compute Many" principle. The LLM fires only at ingestion; all subsequent operations are deterministic database queries. The table below shows the projected cost and scale characteristics at three operating points.

| Metric                              | Small (startup) | Medium (growth) | Large (scale)  |
|-------------------------------------|-----------------|-----------------|----------------|
| Active candidates                   | 1,000           | 10,000          | 100,000        |
| Active job postings                 | 100             | 1,000           | 10,000         |
| Monthly LLM extractions (CVs)       | 1,000           | 10,000          | 100,000        |
| Monthly LLM extractions (JDs)       | 100             | 1,000           | 10,000         |
| Monthly LLM cost (Gemini 1.5 Flash) | ~$1             | ~$11            | ~$110          |
| Monthly DB cost (PlanetScale/Vercel)| ~$10            | ~$40            | ~$200          |
| Monthly Vercel cost                 | ~$20            | ~$20            | ~$100          |
| **Total monthly cost**              | **~$31**        | **~$71**        | **~$410**      |
| Cost per match                      | $0              | $0              | $0             |
| Cron job duration (5-min interval)  | < 5 sec         | < 30 sec        | < 2 min        |
| Dashboard query latency             | < 100ms         | < 200ms         | < 500ms        |

Table 15.7: Projected Cost and Scale at Three Operating Points

---

"""

old_summary_anchor = "# Summary of Key Decisions"
assert old_summary_anchor in content, "Could not find Summary of Key Decisions anchor"
content = content.replace(old_summary_anchor, section_15 + old_summary_anchor)
print("[3/6] Added Section 15: Appendix / Quick Reference (6 sub-sections, 7 tables)")

# ─────────────────────────────────────────────────────────────
# 4. Remove "## End of Documentation" + the italic note after it
#    (Rule 6: never add artificial ending markers)
# ─────────────────────────────────────────────────────────────
old_end_marker = """---

## End of Documentation

*This documentation reflects all decisions made during the design phase. Any future changes should be documented and versioned accordingly.*"""

if old_end_marker in content:
    content = content.replace(old_end_marker, "")
    print("[4/6] Removed artificial 'End of Documentation' marker")
else:
    print("[4/6] SKIPPED - end marker not found (may already be removed)")

# ─────────────────────────────────────────────────────────────
# 5. Update Version History to note Section 15
# ─────────────────────────────────────────────────────────────
old_version_row = "| 4.0 | July 2026 | Added data privacy & DPA compliance (Section 13), field similarity mapping (Section 14), breach notification, data retention policy |"
new_version_row = "| 4.0 | July 2026 | Added data privacy & DPA compliance (Section 13), field similarity mapping (Section 14), breach notification, data retention policy, Appendix / Quick Reference (Section 15), soft-delete with 30-day grace period, REST-correct DELETE endpoint |"
assert old_version_row in content, "Could not find version 4.0 history row"
content = content.replace(old_version_row, new_version_row)
print("[5/6] Updated Version History with Section 15 entry")

# ─────────────────────────────────────────────────────────────
# 6. Update Summary of Key Decisions table to reference Section 15
#    (add rows for soft-delete and appendix)
# ─────────────────────────────────────────────────────────────
old_summary_row = "| **Field Similarity** | ✅ Predefined Matrix | Replaces naive includes() with 3-tier matching |"
new_summary_rows = """| **Field Similarity** | ✅ Predefined Matrix | Replaces naive includes() with 3-tier matching |
| **Account Deletion** | ✅ Soft-delete | `is_active=FALSE` + 30-day purge window, user can revoke |
| **DELETE Method** | ✅ REST-correct | Privacy delete endpoint uses HTTP DELETE (not POST) |
| **Appendix (Sec 15)** | ✅ Added | Quick reference for scores, data matrix, API surface |"""
assert old_summary_row in content, "Could not find Field Similarity summary row"
content = content.replace(old_summary_row, new_summary_rows)
print("[6/6] Updated Summary of Key Decisions table with soft-delete + appendix rows")

# ─────────────────────────────────────────────────────────────
# Write the updated file
# ─────────────────────────────────────────────────────────────
DOC_PATH.write_text(content, encoding='utf-8')
print()
print(f"✓ File saved: {DOC_PATH}")
print(f"  New size: {len(content):,} characters ({len(content.splitlines()):,} lines)")
