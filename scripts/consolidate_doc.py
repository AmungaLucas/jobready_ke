"""Insert Section 13, Section 14, update Summary table and Version History in the build doc."""

INPUT = "/home/z/my-project/download/Job_Matching_Platform_Technical_Documentation_v4.md"

with open(INPUT, "r") as f:
    lines = f.readlines()

# Find the line index of "# Summary of Key Decisions"
summary_idx = None
for i, line in enumerate(lines):
    if line.strip() == "# Summary of Key Decisions":
        summary_idx = i
        break

if summary_idx is None:
    raise RuntimeError("Could not find '# Summary of Key Decisions'")

# The "---" before it is at summary_idx - 2 (blank line at summary_idx - 1)
# We'll insert before that "---"
insert_idx = summary_idx - 2  # points to the "---" line

# New sections 13 and 14 content
new_sections = r"""---

# 13. Data Privacy & DPA Compliance

## 13.1 Kenya Data Protection Act (2019) Overview

**Key Requirements:**

| Requirement | What It Means | Our Implementation |
|-------------|---------------|-------------------|
| **Data Minimization** | Collect only what's necessary | We only collect required fields; extras are optional |
| **Consent** | Explicit consent for data processing | User must consent during signup/CV upload |
| **Right to Access** | Users can view their data | Profile page shows all stored data |
| **Right to Rectification** | Users can correct inaccurate data | Edit profile functionality |
| **Right to Erasure** | Users can request deletion | Account deletion option |
| **Data Retention** | Define how long data is kept | Clear retention policy |
| **Data Security** | Protect against breaches | Encryption, secure storage |
| **Data Transfer** | Controls on cross-border transfer | All data stored in Kenya/EU compliant regions |

## 13.2 Data Collection Consent

### Signup/Registration Flow:

```
+---------------------------------------------------------------------+
|  Create Account                                                    |
|                                                                     |
|  Email: [____________________]                                     |
|  Password: [____________________]                                  |
|                                                                     |
|  [x] I agree to the Terms of Service and Privacy Policy           |
|                                                                     |
|  Data Consent:                                                      |
|  By creating an account, you agree to:                            |
|  - We will store your CV data to match you with jobs             |
|  - We will share your profile with employers when you apply      |
|  - You can download, edit, or delete your data anytime          |
|                                                                     |
|  [Create Account]                                                  |
|                                                                     |
|  Already have an account? [Login]                                  |
+---------------------------------------------------------------------+
```

### CV Upload Consent:

```
+---------------------------------------------------------------------+
|  Upload Your CV                                                    |
|                                                                     |
|  [Choose File] cv_2026.pdf                                         |
|                                                                     |
|  Data Processing Consent:                                          |
|  By uploading your CV, you agree that:                            |
|  - We will analyze your CV to extract work experience, skills,   |
|    and education for job matching purposes                       |
|  - Your data will be stored securely                             |
|  - You can review and edit your extracted profile                |
|  - You can delete your data at any time                          |
|                                                                     |
|  [x] I consent to the processing of my CV data                     |
|                                                                     |
|  [Upload CV]  [Skip for Now]                                      |
+---------------------------------------------------------------------+
```

## 13.3 Privacy Policy (Summary)

```markdown
## Privacy Policy

### 1. Data We Collect
- **Personal Information:** Name, email, phone number, location
- **Professional Information:** Work experience, education, skills, certifications
- **CV/Resume:** Full CV text (for parsing and resume builder)
- **Application Data:** Jobs you apply for, applications status

### 2. How We Use Your Data
- **Job Matching:** Match your profile with relevant job openings
- **Resume Builder:** Generate formatted CVs from your data
- **Communication:** Send job alerts, application updates
- **Platform Improvement:** Aggregated analytics (anonymized)

### 3. Data Sharing
- **Employers:** When you apply for a job, your profile is shared with the employer
- **Third Parties:** We do NOT sell your data to third parties
- **Analytics:** Aggregated, anonymized data only

### 4. Your Rights
- **Access:** View all data we hold about you
- **Rectification:** Correct inaccurate data
- **Erasure:** Request deletion of your account and data
- **Portability:** Download your data in JSON format
- **Object:** Opt out of certain processing activities

### 5. Data Retention
- Active accounts: Data retained for the duration of account activity
- Inactive accounts: Data deleted after 2 years of inactivity
- Account deletion: Data permanently deleted within 30 days

### 6. Data Security
- Encryption at rest (AES-256)
- Encryption in transit (TLS 1.2+)
- Access controls and authentication
- Regular security audits

### 7. Contact
- Data Protection Officer: dpo@platform.com
- Privacy Concerns: privacy@platform.com
```

## 13.4 Database Additions

```sql
-- ============================================
-- DATA CONSENT & PRIVACY TABLES
-- ============================================

-- Consent Records
CREATE TABLE consent_records (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    consent_type ENUM('signup', 'cv_upload', 'marketing', 'data_processing'),
    consent_version VARCHAR(10),  -- e.g., 'v1.0'
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES candidates(id) ON DELETE CASCADE,
    INDEX idx_user (user_id)
);

-- Data Deletion Requests
CREATE TABLE deletion_requests (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'processing', 'completed', 'cancelled') DEFAULT 'pending',
    completion_date TIMESTAMP,
    reason TEXT,
    deleted_data JSON,  -- Audit trail of what was deleted
    
    FOREIGN KEY (user_id) REFERENCES candidates(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_status (status)
);

-- Data Export Requests
CREATE TABLE export_requests (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'processing', 'completed') DEFAULT 'pending',
    completion_date TIMESTAMP,
    export_url VARCHAR(255),
    expiry_date TIMESTAMP,  -- Link expires after 7 days
    
    FOREIGN KEY (user_id) REFERENCES candidates(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_status (status)
);
```

## 13.5 Privacy API Endpoints

```typescript
// app/api/privacy/export/route.ts
import { query } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
        // Get all user data
        const candidate = await query(
            `SELECT * FROM candidates WHERE id = ?`,
            [session.user.id]
        );
        const education = await query(
            `SELECT * FROM candidate_education WHERE candidate_id = ?`,
            [session.user.id]
        );
        const clusters = await query(
            `SELECT * FROM candidate_clusters WHERE candidate_id = ?`,
            [session.user.id]
        );
        const extras = await query(
            `SELECT * FROM candidate_extras WHERE candidate_id = ?`,
            [session.user.id]
        );
        const matches = await query(
            `SELECT * FROM job_matches WHERE candidate_id = ?`,
            [session.user.id]
        );
        
        const exportData = {
            profile: candidate[0],
            education,
            work_experience: clusters,
            extras: extras[0],
            matches,
            export_date: new Date().toISOString()
        };
        
        // Create export record
        const result = await query(
            `INSERT INTO export_requests (user_id, status) VALUES (?, ?)`,
            [session.user.id, 'completed']
        );
        
        // In production, generate a signed download URL
        const exportUrl = `/api/privacy/download/${result.insertId}`;
        
        return Response.json({
            success: true,
            export_url: exportUrl,
            expires_in: '7 days'
        });
        
    } catch (error) {
        return Response.json({ error: (error as Error).message }, { status: 500 });
    }
}
```

```typescript
// app/api/privacy/delete/route.ts
import { query } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function POST(request: Request) {
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
}
```

## 13.6 Data Breach Notification Procedure

In the event of a personal data breach, the platform shall:

1. **Detect and Contain:** Identify the breach within 24 hours and take immediate steps to contain it
2. **Assess:** Determine the nature, scope, and impact of the breach (data types affected, number of data subjects)
3. **Notify ODPC:** Report to the Office of the Data Protection Commissioner within 72 hours if the breach is likely to result in risk to data subjects
4. **Notify Data Subjects:** Inform affected users without undue delay if the breach is likely to result in high risk to their rights and freedoms
5. **Document:** Record all breaches in a breach register including facts, effects, and remedial actions taken
6. **Remediate:** Implement measures to prevent recurrence (patch vulnerabilities, update access controls, retrain staff)

## 13.7 Data Retention and Cleanup

| Data Type | Retention Period | Deletion Method |
|-----------|-----------------|-----------------|
| Active account data | Duration of account activity | On account deletion request |
| Inactive accounts | 2 years after last login | Automated cron job (monthly) |
| Application records | 1 year after position closes | Automated cron job (monthly) |
| Consent records | 5 years from collection | Archived, then purged |
| Raw CV text | Until account deletion or 2 years inactivity | Secure overwrite |
| Match results | Recalculated on each match run | No permanent storage needed |

---

# 14. Field Similarity Mapping

## 14.1 Problem Statement

The original `isFieldRelated()` used naive `String.includes()` matching, which produced false positives (e.g., "Business" matching "Business Journalism") and false negatives (e.g., "Commerce" not matching "Business Administration").

This section replaces that with a **predefined related-fields matrix** using three-tier matching: exact, group-based, and partial-word.

## 14.2 Updated isFieldRelated() Implementation

```typescript
// lib/field-mapping.ts

/**
 * Predefined mapping of related education fields.
 * Each key is a canonical field name; values are known aliases/related fields.
 * This replaces the naive includes() check.
 */
export const RELATED_FIELDS: Record<string, string[]> = {
    // Business and Commerce
    'business': [
        'commerce', 'business administration', 'business management',
        'marketing', 'finance', 'accounting', 'management',
        'entrepreneurship', 'international business', 'supply chain'
    ],
    
    // Technology and Computing
    'computing': [
        'computer science', 'information technology', 'software engineering',
        'data science', 'programming', 'systems analysis', 'web development',
        'cybersecurity', 'networking', 'database management', 'ai', 'machine learning'
    ],
    
    // Engineering
    'engineering': [
        'mechanical engineering', 'civil engineering', 'electrical engineering',
        'automotive engineering', 'structural engineering', 'chemical engineering',
        'industrial engineering', 'aerospace engineering', 'mechatronics'
    ],
    
    // Health and Medical
    'health': [
        'medicine', 'nursing', 'clinical medicine', 'pharmacy', 'public health',
        'healthcare', 'biomedical', 'physiotherapy', 'dentistry', 'nutrition'
    ],
    
    // Education and Teaching
    'education': [
        'teaching', 'training', 'curriculum development', 'pedagogy',
        'instruction', 'educational leadership', 'special education'
    ],
    
    // Economics and Finance
    'economics': [
        'econometrics', 'finance', 'statistics', 'actuarial science',
        'investment', 'banking', 'financial management'
    ],
    
    // Law and Legal
    'law': [
        'legal', 'jurisprudence', 'advocacy', 'constitutional law',
        'criminal law', 'contract law', 'property law', 'arbitration'
    ],
    
    // Arts and Humanities
    'arts': [
        'humanities', 'social sciences', 'literature', 'history',
        'sociology', 'psychology', 'political science', 'anthropology'
    ],
    
    // Sciences
    'science': [
        'biology', 'chemistry', 'physics', 'mathematics', 'geology',
        'environmental science', 'agriculture', 'biotechnology', 'zoology'
    ],
    
    // Hospitality and Tourism
    'hospitality': [
        'hotel management', 'tourism', 'travel', 'catering',
        'event management', 'culinary arts', 'leisure management'
    ],
    
    // Construction and Architecture
    'construction': [
        'architecture', 'quantity surveying', 'construction management',
        'urban planning', 'building technology', 'land surveying'
    ],
    
    // Media and Communications
    'media': [
        'journalism', 'mass communication', 'public relations',
        'marketing communications', 'digital media', 'broadcasting',
        'content creation'
    ]
};

/**
 * Stopwords to exclude from partial-word matching.
 * Common short words that appear in many unrelated fields.
 */
const FIELD_STOPWORDS = new Set([
    'and', 'of', 'the', 'in', 'for', 'to', 'with', 'studies',
    'science', 'arts', 'technology'
]);

/**
 * Check if two education fields are related using the mapping matrix.
 * Three-tier matching: exact -> group-based -> partial-word
 * Returns true if fields are related, false otherwise.
 */
export function isFieldRelated(candidateField: string, jobField: string): boolean {
    if (!candidateField || !jobField) return false;
    
    const c = candidateField.toLowerCase().trim();
    const j = jobField.toLowerCase().trim();
    
    // Tier 1: Exact match
    if (c === j) return true;
    
    // Tier 2: Group-based matching via RELATED_FIELDS matrix
    for (const [key, related] of Object.entries(RELATED_FIELDS)) {
        const candidateIsRelated = related.some(r => r === c);
        const jobIsRelated = related.some(r => r === j);
        
        // Both fields belong to the same group
        if (candidateIsRelated && jobIsRelated) return true;
        
        // Candidate field is the group key, job field is in its related list
        if (c === key && related.some(r => r === j)) return true;
        
        // Job field is the group key, candidate field is in its related list
        if (j === key && related.some(r => r === c)) return true;
    }
    
    // Tier 3: Partial-word matching (only for multi-word fields)
    const cWords = c.split(/\s+/).filter(w => !FIELD_STOPWORDS.has(w));
    const jWords = j.split(/\s+/).filter(w => !FIELD_STOPWORDS.has(w));
    
    if (cWords.length > 1 || jWords.length > 1) {
        // At least one significant word matches
        const commonWords = cWords.filter(w =>
            w.length > 3 && jWords.includes(w)
        );
        if (commonWords.length > 0) return true;
    }
    
    return false;
}

/**
 * Get all fields related to a given field (useful for UI display).
 */
export function getRelatedFields(field: string): string[] {
    if (!field) return [];
    
    const lower = field.toLowerCase().trim();
    const result = new Set<string>();
    
    if (RELATED_FIELDS[lower]) {
        RELATED_FIELDS[lower].forEach(r => result.add(r));
    }
    
    for (const [key, related] of Object.entries(RELATED_FIELDS)) {
        if (related.includes(lower)) {
            result.add(key);
            related.forEach(r => result.add(r));
        }
    }
    
    return Array.from(result);
}
```

## 14.3 Test Cases

```typescript
// === Tier 1: Exact Match ===
console.log(isFieldRelated('Commerce', 'Commerce'));                  // true

// === Tier 2: Group-Based Matching ===
console.log(isFieldRelated('Commerce', 'Business Administration'));  // true
console.log(isFieldRelated('Commerce', 'Business Journalism'));       // false
console.log(isFieldRelated('Computer Science', 'IT'));                // true
console.log(isFieldRelated('Computer Science', 'Business'));          // false
console.log(isFieldRelated('Business', 'Commerce'));                  // true
console.log(isFieldRelated('Economics', 'Finance'));                  // true
console.log(isFieldRelated('Economics', 'Statistics'));              // true
console.log(isFieldRelated('Economics', 'Engineering'));              // false
console.log(isFieldRelated('Mechanical Engineering', 'Engineering')); // true
console.log(isFieldRelated('Nursing', 'Medicine'));                   // true
console.log(isFieldRelated('Nursing', 'Engineering'));                // false

// === Tier 3: Partial-Word Matching ===
console.log(isFieldRelated('Business Administration', 'Business Management')); // true
console.log(isFieldRelated('Public Health', 'Public Policy'));                   // false
```

## 14.4 Integration with Matching Algorithm

The field similarity mapping is used in the education bonus scoring (Section 6.2, Step 2). Here is the updated integration:

```typescript
// In calculateMatchScore():

// 3. Education Match (15 points)
const highestLevel = getHighestEducationLevel(candidate.education);
if (job.required_education.level) {
    const eduScore = compareEducation(
        highestLevel,
        job.required_education.level
    );
    score += eduScore * 15;
    
    // Bonus for field relevance (5 points) -- NOW USING PROPER MAPPING
    if (job.required_education.field && 
        job.required_education.field !== "Any") {
        
        let isRelated = false;
        for (const edu of candidate.education || []) {
            if (isFieldRelated(edu.field, job.required_education.field)) {
                isRelated = true;
                break;  // Only need one education entry to match
            }
        }
        if (isRelated) score += 5;
    }
}
```

## 14.5 Future Improvements

- **Weighted similarity:** Return a similarity score (0.0-1.0) instead of boolean, allowing partial field-match bonuses
- **Kenyan qualification mapping:** Add CPA, ACCA, CISA, KASNEB, CFA to the Finance/Accounting group
- **Dynamic learning:** Log field-pair approvals from candidate feedback to improve mappings over time
- **Cross-category overlaps:** Handle fields that legitimately span categories (e.g., "Public Relations" in both Marketing and Media)

"""

# Split new_sections into lines and insert
new_lines = new_sections.split("\n")
# Ensure each line ends with newline
new_lines = [l + "\n" if not l.endswith("\n") else l for l in new_lines]

# Insert before the "---" that precedes the Summary section
lines = lines[:insert_idx] + new_lines + lines[insert_idx:]

# Now update the Summary of Key Decisions table - add two new rows after "Normalization" line
for i, line in enumerate(lines):
    if "Normalization" in line and "Word-boundary" in line and "|" in line:
        lines.insert(i + 1, "| **Data Privacy** | ✅ DPA Compliant | Kenya DPA 2019, consent, retention, breach notification |\n")
        lines.insert(i + 2, "| **Field Similarity** | ✅ Predefined Matrix | Replaces naive includes() with 3-tier matching |\n")
        break

# Find and update the version history - add v4.0 row
for i, line in enumerate(lines):
    if "3.0 | May 2026 | Added authentication" in line:
        lines.insert(i + 1, "| 4.0 | July 2026 | Added data privacy & DPA compliance (Section 13), field similarity mapping (Section 14), breach notification, data retention policy |\n")
        break

with open(INPUT, "w") as f:
    f.writelines(lines)

print(f"Document updated successfully. Total lines: {len(lines)}")
