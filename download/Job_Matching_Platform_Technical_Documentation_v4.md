# Job Matching Platform - Technical Documentation

## Version 4.0 | July 2026

---

# Table of Contents

1. [Platform Philosophy](#1-platform-philosophy)
2. [System Architecture](#2-system-architecture)
3. [Data Schemas](#3-data-schemas)
4. [Data Normalization & Enums](#4-data-normalization--enums)
5. [LLM Extraction](#5-llm-extraction)
6. [Matching Algorithm](#6-matching-algorithm)
7. [Database Schema](#7-database-schema)
8. [Tech Stack Recommendations](#8-tech-stack-recommendations)
9. [API Endpoints](#9-api-endpoints)
10. [User Interface Flows](#10-user-interface-flows)
11. [Background Jobs](#11-background-jobs)
12. [Implementation Roadmap](#12-implementation-roadmap)
13. [Data Privacy & DPA Compliance](#13-data-privacy--dpa-compliance)
14. [Field Similarity Mapping](#14-field-similarity-mapping)

---

# 1. Platform Philosophy

## Core Principle: Candidate Empowerment, Not Disqualification

Our platform is designed to **open doors** for job seekers, not close them.

### The Kenyan Reality:
- A graduate may work multiple jobs for survival
- A BCom graduate might be: Cashier (Today) → Teller (Next Year) → Auditor (Following Year)
- Job seekers have **multiple professional identities**, not one fixed career path

### What We Do:
- Acknowledge all work experiences as valid
- Present jobs that match **ANY** of the candidate's experiences
- Allow candidates to choose up to **3 career trajectories** to focus on
- Never disqualify candidates based on missing constraints
- Let candidates decide if they meet administrative requirements (e.g., driving license, age)
- Rank jobs so best matches appear first, but all matching jobs are visible
- Show location as information, never as a filter

### What We Don't Do:
- Penalize candidates for having unknown employers
- Lock candidates into a single career path
- Use hard filters that reject candidates
- Extract or rely on ambiguous data like company sector from CVs
- Match on administrative requirements (license, age, nationality, languages)
- Force candidates into rigid career categories
- Filter jobs by location (candidates decide if they want to relocate)

---

# 2. System Architecture

## 2.1 The "Extract Once, Compute Many" Approach

**Key Decision:** LLM fires **ONCE** for CV parsing and **ONLY WHEN NEEDED** for JD parsing. All matching happens in the database/backend using structured data.

### Why This Approach:

| Factor | Traditional (LLM Every Time) | Our Approach (Extract Once) |
|--------|------------------------------|------------------------------|
| **Cost** | $0.001 per match | $0.001 per upload + $0 for matches |
| **Speed** | Slow (LLM latency) | Instant (DB query) |
| **Scalability** | Linear cost scaling | Fixed cost per upload |
| **Accuracy** | Inconsistent (LLM varies) | Deterministic (math) |

### Architecture Flow Diagram:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER UPLOADS CV                                   │
│              (PDF/DOCX/Paste/Fill Form)                                    │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
                        ┌─────────────────┐
                        │  Text Extract   │ (pdf-parse, mammoth, etc.)
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  LLM (1st Fire) │ (Costs ~$0.001)
                        │  Parse to JSON  │
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │   Normalize     │ (Clean up strings, standardize dates)
                        │   & Store       │
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │   MySQL         │ (Structured JSON stored)
                        └────────┬────────┘
                                 │
                                 │
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ADMIN POSTS JOB                                  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  OPTION 1: PASTE JD TEXT → LLM (2nd Fire) → Auto-fill              │   │
│  │  OPTION 2: UPLOAD FILE → Extract → LLM (2nd Fire) → Auto-fill      │   │
│  │  OPTION 3: PASTE JSON → Validate → Pre-fill (NO LLM)               │   │
│  │  OPTION 4: FILL FORM → Direct Save (NO LLM)                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
                        ┌─────────────────┐
                        │   Normalize     │
                        │   & Store       │
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │   MySQL         │ (Structured JSON stored)
                        └────────┬────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  BACKGROUND MATCHING (NO LLM INVOLVED)                    │
│                                                                           │
│  1. Cron Job runs every 5 minutes                                         │
│  2. Query DB: Find candidates with matching function (indexed)            │
│  3. Calculate Score: Skills + Education + Experience                     │
│  4. Save Match Result to job_matches table                               │
│  5. Cost: ZERO USD                                                        │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CANDIDATE DASHBOARD LOADS                              │
│                                                                           │
│   "SELECT * FROM job_matches WHERE candidate_id = X ORDER BY score DESC"  │
│   (Instant display, no LLM waiting time)                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# 3. Data Schemas

## 3.1 Candidate Schema (Stored in Database)

### Core Fields (Used for Matching)

```json
{
  "candidate_id": "cand_12345",
  
  "profile": {
    "full_name": "John Mwangi",
    "phone": "+254712345678",
    "email": "john.mwangi@gmail.com",
    "location": "Nairobi, Kenya"
  },
  
  "education": [
    {
      "level": "Bachelor",        // Enum: PhD|Masters|Bachelor|Diploma|Certificate|None
      "field": "Commerce",
      "institution": "University of Nairobi",
      "start_year": 2019,
      "end_year": 2022
    },
    {
      "level": "Certificate",
      "field": "CPA",
      "institution": "ICPAK",
      "start_year": 2020,
      "end_year": 2022
    }
  ],
  
  "work_experience": [
    {
      "cluster_id": "exp_001",
      "function": "Administration",      // Enum from FUNCTION_ENUMS
      "job_titles": ["Admin Assistant", "Office Administrator"],
      "skills": ["Filing", "Scheduling", "Customer Service", "MS Office"],
      "years_experience": 3.5,
      "representative_company": "Amunga & Sons Ltd",
      "selected": true                   // User selected this trajectory
    },
    {
      "cluster_id": "exp_002",
      "function": "Finance",
      "job_titles": ["Accounts Assistant", "Bookkeeper"],
      "skills": ["Bookkeeping", "Reconciliation", "QuickBooks"],
      "years_experience": 2.0,
      "representative_company": "KCB Bank",
      "selected": false                  // User did NOT select this trajectory
    },
    {
      "cluster_id": "exp_003",
      "function": "Sales",
      "job_titles": ["Cashier", "Sales Associate"],
      "skills": ["POS", "Cash Handling", "Sales"],
      "years_experience": 1.5,
      "representative_company": "Naivas Supermarket",
      "selected": false                  // User did NOT select this trajectory
    }
  ],
  
  "created_at": "2026-04-25T10:00:00Z",
  "updated_at": "2026-04-25T10:00:00Z"
}
```

### Field Definitions:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `profile.full_name` | String | Candidate's full name | "John Mwangi" |
| `profile.phone` | String | Phone number | "+254712345678" |
| `profile.email` | String | Email address | "john@gmail.com" |
| `profile.location` | String | Current location | "Nairobi, Kenya" |
| `education[].level` | Enum | Highest education level | "Bachelor" |
| `education[].field` | String | Field of study | "Commerce" |
| `education[].institution` | String | Institution name | "University of Nairobi" |
| `work_experience[].function` | Enum | Broad career function | "Administration" |
| `work_experience[].job_titles` | Array | Actual role titles | ["Admin Assistant"] |
| `work_experience[].skills` | Array | Hard skills | ["Filing", "Scheduling"] |
| `work_experience[].years_experience` | Float | Years in this cluster | 3.5 |
| `work_experience[].selected` | Boolean | User-selected trajectory | true |

---

## 3.2 Extra Fields (Stored for Resume Builder, NOT Used for Matching)

```json
{
  "extras": {
    "certifications": [
      {
        "name": "CPA Part 1",
        "institution": "ICPAK",
        "year": 2021
      }
    ],
    "referees": [
      {
        "name": "John Okanga",
        "title": "CEO",
        "company": "TAABCO Research",
        "phone": "+254722389941",
        "email": "jokanga@taabco.org"
      }
    ],
    "languages": ["English", "Kiswahili"],
    "professional_memberships": ["KISM"],
    "trainings": [
      {
        "name": "Leadership Training",
        "institution": "USAID",
        "year": 2015
      }
    ]
  }
}
```

---

## 3.3 Job Schema (Stored in Database)

### Core Fields (Used for Matching)

```json
{
  "job_id": "job_67890",
  
  "job": {
    "title": "Admin Assistant",
    "company": "Aga Khan Hospital",
    "sector": "Healthcare",                    // Enum from SECTOR_ENUMS
    "job_function": "Administration",          // Enum from FUNCTION_ENUMS
    "location": "Nairobi, Kenya",
    "job_type": "Full-time",                  // Full-time|Part-time|Contract|Internship
    
    "required_skills": [
      "Filing",
      "Scheduling", 
      "Customer Service",
      "MS Office"
    ],
    
    "required_education": {
      "level": "Diploma",                     // Enum from EDUCATION_LEVEL_ENUMS
      "field": "Business Administration"
    },
    
    "required_experience_years": 2,
    
    "description": "Full job description text...",
    "application_deadline": "2026-06-30",
    
    "posted_by": "admin_001",
    "created_at": "2026-04-25T10:00:00Z"
  }
}
```

### Field Definitions:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `title` | String | Job title | "Admin Assistant" |
| `company` | String | Company name | "Aga Khan Hospital" |
| `sector` | Enum | Industry sector | "Healthcare" |
| `job_function` | Enum | Broad job function | "Administration" |
| `location` | String | Job location | "Nairobi, Kenya" |
| `job_type` | Enum | Employment type | "Full-time" |
| `required_skills` | Array | Required hard skills | ["Filing", "Scheduling"] |
| `required_education.level` | Enum | Minimum education level | "Diploma" |
| `required_education.field` | String | Preferred field | "Business Administration" |
| `required_experience_years` | Integer | Minimum years | 2 |

---

# 4. Data Normalization & Enums

## 4.1 Why Normalization Matters

Without normalization, the same concept appears in multiple forms:

| Raw LLM Output | Issue |
|----------------|-------|
| "BSc", "B.Sc", "Bachelor of Science", "Bachelors" | 4 variations of "Bachelor" |
| "Admin", "Administration", "Office Admin" | 3 variations of "Administration" |
| "Telco", "Telecom", "Telecommunications" | 3 variations of "Telecommunications" |

**Normalization** maps all variations to a single canonical value.

## 4.2 Education Level Enums

```javascript
export const EDUCATION_LEVEL_ENUMS = {
    'PhD': ['phd', 'doctorate', 'doctor of', 'd.phil', 'ph.d'],
    'Masters': ['masters', 'master of', 'msc', 'ma', 'm.a', 'm.sc', 'mba', 'llm', 'm.ed'],
    'Bachelor': ['bachelor', 'bsc', 'b.a', 'ba', 'b.com', 'bcom', 'b.ed', 'b.eng', 'llb', 'bachelor of'],
    'Diploma': ['diploma', 'dip', 'dipl'],
    'Certificate': ['certificate', 'cert', 'certif'],
    'None': ['none', 'n/a', 'nil']
};
```

## 4.3 Job Function Enums

```javascript
export const FUNCTION_ENUMS = {
    'Administration': ['admin', 'administrative', 'office admin', 'office manager', 'executive assistant', 'clerk'],
    'Finance': ['finance', 'accounting', 'accountant', 'audit', 'auditor', 'financial', 'bookkeeping', 'treasury'],
    'IT': ['it', 'information technology', 'computer', 'software', 'programming', 'developer', 'network', 'cybersecurity', 'systems'],
    'Engineering': ['engineering', 'engineer', 'civil', 'mechanical', 'electrical', 'automotive', 'structural'],
    'Sales': ['sales', 'selling', 'business development', 'relationship officer', 'account manager'],
    'Marketing': ['marketing', 'brand', 'digital marketing', 'communications', 'pr', 'public relations'],
    'Healthcare': ['healthcare', 'medical', 'nursing', 'clinical', 'doctor', 'lab', 'pharmacy', 'therapist'],
    'Education': ['education', 'teaching', 'lecturer', 'trainer', 'instructor', 'tutor', 'faculty'],
    'Hospitality': ['hospitality', 'hotel', 'restaurant', 'catering', 'chef', 'cook', 'lodging'],
    'Logistics': ['logistics', 'supply chain', 'procurement', 'warehouse', 'transport', 'fleet', 'purchasing'],
    'Legal': ['legal', 'law', 'lawyer', 'advocate', 'paralegal', 'counsel'],
    'Customer Service': ['customer service', 'customer care', 'call center', 'front desk', 'reception', 'support'],
    'Operations': ['operations', 'operational', 'production', 'manufacturing', 'facilities'],
    'Human Resources': ['hr', 'human resources', 'recruitment', 'people', 'talent', 'staffing'],
    'Other': []
};
```

## 4.4 Sector Enums (Job Only)

```javascript
export const SECTOR_ENUMS = {
    'Agriculture': ['agriculture', 'agri', 'farming', 'horticulture', 'agribusiness'],
    'Banking': ['banking', 'financial services', 'bank', 'microfinance'],
    'Construction': ['construction', 'building', 'real estate', 'property'],
    'Education': ['education', 'school', 'university', 'college', 'academy'],
    'Energy': ['energy', 'oil', 'gas', 'power', 'electric', 'renewable'],
    'Finance': ['finance', 'investment', 'asset management', 'wealth'],
    'Government': ['government', 'public service', 'county', 'state', 'parastatal'],
    'Healthcare': ['healthcare', 'hospital', 'clinic', 'medical', 'pharma', 'health'],
    'Hospitality': ['hospitality', 'hotel', 'restaurant', 'tourism', 'travel'],
    'Insurance': ['insurance', 'assurance', 'risk'],
    'IT/Technology': ['it', 'technology', 'software', 'tech', 'telecom'],
    'Legal': ['legal', 'law firm', 'advocates', 'courts'],
    'Manufacturing': ['manufacturing', 'production', 'factory', 'industrial', 'fmcg'],
    'Media': ['media', 'broadcasting', 'publishing', 'news', 'content'],
    'NGO/Development': ['ngo', 'non-profit', 'development', 'humanitarian', 'aid'],
    'Real Estate': ['real estate', 'property', 'housing', 'realtor'],
    'Retail': ['retail', 'supermarket', 'store', 'e-commerce', 'wholesale'],
    'Telecommunications': ['telecom', 'telco', 'mobile', 'internet', 'communications'],
    'Transport/Logistics': ['transport', 'logistics', 'shipping', 'aviation', 'cargo'],
    'Other': []
};
```

## 4.5 Job Type Enums

```javascript
export const JOB_TYPE_ENUMS = {
    'Full-time': ['full-time', 'full time', 'permanent', 'fulltime'],
    'Part-time': ['part-time', 'part time', 'parttime'],
    'Contract': ['contract', 'contractual', 'temporary'],
    'Internship': ['internship', 'intern', 'trainee', 'graduate trainee']
};
```

## 4.6 Normalization Implementation

### Word-Boundary Matching (Avoids False Positives)

```javascript
// lib/normalize.js
import { EDUCATION_LEVEL_ENUMS, FUNCTION_ENUMS, SECTOR_ENUMS } from './enums';

/**
 * Normalize using word-boundary regex to avoid false matches
 * "hr" matches "hr" but NOT "research" or "architecture"
 */
function normalizeWithWordBoundaries(raw, enumMap, defaultVal = 'Other') {
    if (!raw) return defaultVal;
    const lower = raw.toLowerCase().trim();
    
    for (const [canonical, variations] of Object.entries(enumMap)) {
        for (const variation of variations) {
            // Use word boundaries to avoid substring false positives
            const regex = new RegExp(`\\b${variation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
            if (regex.test(lower)) {
                return canonical;
            }
        }
    }
    return defaultVal;
}

export function normalizeEducationLevel(raw) {
    return normalizeWithWordBoundaries(raw, EDUCATION_LEVEL_ENUMS, 'None');
}

export function normalizeFunction(raw) {
    return normalizeWithWordBoundaries(raw, FUNCTION_ENUMS, 'Other');
}

export function normalizeSector(raw) {
    return normalizeWithWordBoundaries(raw, SECTOR_ENUMS, 'Other');
}

export function normalizeCandidate(rawJson) {
    if (!rawJson) return null;
    
    // Education is now an array
    if (rawJson.education && Array.isArray(rawJson.education)) {
        for (const edu of rawJson.education) {
            edu.level = normalizeEducationLevel(edu.level);
        }
    }
    
    // Normalize work experience clusters
    if (rawJson.work_experience) {
        for (const cluster of rawJson.work_experience) {
            cluster.function = normalizeFunction(cluster.function);
            
            // De-duplicate skills
            if (cluster.skills) {
                cluster.skills = [...new Set(cluster.skills.map(s => s.trim()))];
            }
        }
    }
    
    return rawJson;
}

export function normalizeJob(rawJson) {
    if (!rawJson) return null;
    
    if (rawJson.job) {
        rawJson.job.sector = normalizeSector(rawJson.job.sector);
        rawJson.job.job_function = normalizeFunction(rawJson.job.job_function);
        if (rawJson.job.required_education) {
            rawJson.job.required_education.level = normalizeEducationLevel(
                rawJson.job.required_education.level
            );
        }
    }
    
    return rawJson;
}
```

## 4.7 Field Relatedness Mapping

```javascript
// lib/field-mapping.js
export const RELATED_FIELDS = {
    'business': ['commerce', 'business administration', 'marketing', 'finance', 'accounting', 'management'],
    'computing': ['computer science', 'it', 'information technology', 'software', 'data science', 'programming'],
    'engineering': ['mechanical engineering', 'civil engineering', 'electrical engineering', 'automotive engineering', 'structural engineering'],
    'health': ['medicine', 'nursing', 'clinical', 'pharmacy', 'public health', 'healthcare'],
    'education': ['teaching', 'training', 'curriculum', 'pedagogy', 'instruction'],
    'economics': ['econometrics', 'finance', 'statistics', 'actuarial science'],
    'law': ['legal', 'jurisprudence', 'advocacy', 'constitutional law'],
    'arts': ['humanities', 'social sciences', 'literature', 'history', 'sociology']
};

export function isFieldRelated(candidateField, jobField) {
    if (!candidateField || !jobField) return false;
    const c = candidateField.toLowerCase().trim();
    const j = jobField.toLowerCase().trim();
    
    // Direct match
    if (c === j) return true;
    
    // Check if one contains the other (but avoid false positives)
    if (c.includes(j) || j.includes(c)) {
        // Only return true if the shorter string is at least 3 characters
        // and the match is at a word boundary
        const shorter = c.length <= j.length ? c : j;
        const longer = c.length > j.length ? c : j;
        if (shorter.length >= 3 && longer.includes(shorter)) {
            // Check if it's a word boundary match
            const regex = new RegExp(`\\b${shorter}\\b`, 'i');
            if (regex.test(longer)) return true;
        }
    }
    
    // Check related fields map
    for (const [key, related] of Object.entries(RELATED_FIELDS)) {
        const isCandidateRelated = related.some(r => c.includes(r) || r.includes(c));
        const isJobRelated = related.some(r => j.includes(r) || r.includes(j));
        if (isCandidateRelated && isJobRelated) return true;
    }
    
    return false;
}
```

---

# 5. LLM Extraction

## 5.1 Technology Choice: LLM-Based Extraction

**Why LLM over Regex?**

| Challenge | Regex/NLP | LLM |
|-----------|-----------|-----|
| Messy formatting (tables, columns) | ❌ Breaks | ✅ Handles naturally |
| Inconsistent headers | ❌ Requires exhaustive rules | ✅ Understands context |
| Skills scattered across sections | ❌ Difficult to capture | ✅ Extracts from anywhere |
| Dates in various formats | ❌ Complex parsing | ✅ Standardizes output |
| Context understanding | ❌ Ambiguous | ✅ Infers correctly |

**Recommended LLM:**
- **Gemini 1.5 Flash** or **GPT-4o-mini**
- Low cost (~$0.001 per CV)
- Fast processing (2-5 seconds)
- Large context windows (1M+ tokens)

## 5.2 CV Extraction Prompt

```
You are an expert CV parser. Extract structured information from the following Kenyan CV.

Extract the following JSON structure:

{
  "profile": {
    "full_name": "string",
    "phone": "string",
    "email": "string",
    "location": "string"
  },
  "education": [
    {
      "level": "string (PhD|Masters|Bachelor|Diploma|Certificate|None)",
      "field": "string",
      "institution": "string",
      "start_year": "YYYY",
      "end_year": "YYYY"
    }
  ],
  "work_experience": [
    {
      "function": "string (Administration|Finance|IT|Engineering|Sales|Marketing|Healthcare|Education|Hospitality|Logistics|Legal|Customer Service|Operations|Human Resources|Other)",
      "job_titles": ["string"],
      "skills": ["string"],
      "years_experience": "number",
      "representative_company": "string (optional)"
    }
  ],
  "extras": {
    "certifications": [{"name": "string", "institution": "string", "year": "YYYY"}],
    "referees": [{"name": "string", "title": "string", "company": "string", "phone": "string", "email": "string"}],
    "languages": ["string"],
    "professional_memberships": ["string"],
    "trainings": [{"name": "string", "institution": "string", "year": "YYYY"}]
  }
}

Instructions:
1. Group similar job experiences into clusters based on function
2. Extract hard skills only (e.g., "Microsoft Excel", "Bookkeeping", "Cisco")
3. DO NOT extract soft skills like "hardworking", "team player" unless explicitly listed as core competencies
4. Calculate years of experience for each cluster
5. DO NOT extract company sector/industry
6. DO NOT extract date of birth, nationality, or grade/class
7. DO NOT extract administrative requirements
8. If any field cannot be determined, use null
9. Output ONLY valid JSON
```

## 5.3 Job Description Extraction Prompt

```
You are an expert job description parser. Extract structured information from the following job posting.

Extract the following JSON structure:

{
  "job": {
    "title": "string",
    "company": "string",
    "sector": "string (Agriculture|Banking|Construction|Education|Energy|Finance|Government|Healthcare|Hospitality|Insurance|IT/Technology|Legal|Manufacturing|Media|NGO/Development|Real Estate|Retail|Telecommunications|Transport/Logistics|Other)",
    "job_function": "string (Administration|Finance|IT|Engineering|Sales|Marketing|Healthcare|Education|Hospitality|Logistics|Legal|Customer Service|Operations|Human Resources|Other)",
    "location": "string",
    "job_type": "string (Full-time|Part-time|Contract|Internship)",
    "required_skills": ["string"],
    "required_education": {
      "level": "string (PhD|Masters|Bachelor|Diploma|Certificate|None)",
      "field": "string (or 'Any' if not specified)"
    },
    "required_experience_years": "number (0 if not specified)"
  }
}

Instructions:
1. Sector should be inferred from the company type, or 'Other' if unknown
2. Job function should be inferred from the title and responsibilities
3. Required skills: Look for explicit requirements. Include software tools, certifications, and hard skills
4. For education: If "Any" or "Related field" mentioned, set field = "Any"
5. For experience: Convert "3+ years" to 3, "5-7 years" to the minimum (5)
6. DO NOT extract administrative requirements like license, age, nationality
7. Output ONLY valid JSON
```

## 5.4 LLM Error Handling & Retry Logic

```javascript
// lib/llm.js
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

async function parseWithRetry(prompt, maxRetries = 3) {
    let lastError = null;
    let attempt = 0;
    
    while (attempt < maxRetries) {
        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const jsonText = response.text();
            
            // Try to parse JSON
            const parsed = JSON.parse(jsonText);
            
            // Basic validation
            if (!parsed.profile?.full_name && attempt < 2) {
                throw new Error('Missing required field: full_name');
            }
            
            return parsed;
            
        } catch (error) {
            lastError = error;
            attempt++;
            console.warn(`LLM attempt ${attempt} failed:`, error.message);
            
            if (attempt < maxRetries) {
                await sleep(1000 * attempt); // Exponential backoff
            }
        }
    }
    
    // All retries failed - log for manual review
    await logFailedParsing(prompt, lastError);
    
    return {
        _error: true,
        _message: 'Failed to parse. Please review manually.',
        _raw_text: prompt.substring(0, 500) // Truncate for logging
    };
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function logFailedParsing(text, error) {
    // Log to database for manual review
    await query(
        `INSERT INTO parse_failures (raw_text, error_message, created_at) 
         VALUES (?, ?, NOW())`,
        [text.substring(0, 10000), error.message]
    );
}

export async function parseCV(text) {
    const prompt = `...`; // Full prompt from above
    return await parseWithRetry(prompt);
}

export async function parseJD(text) {
    const prompt = `...`; // Full prompt from above
    return await parseWithRetry(prompt);
}
```

---

# 6. Matching Algorithm

## 6.1 Core Principles

| Principle | Implementation |
|-----------|----------------|
| **Inclusive** | Never hides jobs based on missing data |
| **Function-Based** | Primary match is on job function |
| **Ranked** | Best matches appear first |
| **Explainable** | Each match shows why it was recommended |
| **User-Controlled** | Only selected trajectories are matched |
| **Scalable** | Uses database indexing for efficient queries |

## 6.2 Step-by-Step Logic

### Step 1: Function Match (Gateway Filter)

```javascript
// lib/matching.js
function isFunctionMatch(candidate, job) {
    // Only check selected clusters
    const activeClusters = candidate.work_experience.filter(c => c.selected);
    
    for (const cluster of activeClusters) {
        if (cluster.function.toLowerCase() === job.job_function.toLowerCase()) {
            return true;
        }
    }
    return false;
}
```

**Outcome:**
- If **any** selected cluster matches → Show the job
- If **no** selected cluster matches → Hide the job

### Step 2: Calculate Match Score (Ranking)

```javascript
function calculateMatchScore(cluster, job, candidate) {
    let score = 0;
    
    // 1. Job Title Match (40 points)
    const jobTitleLower = job.title.toLowerCase();
    const hasExactMatch = cluster.job_titles.some(
        t => t.toLowerCase() === jobTitleLower
    );
    
    if (hasExactMatch) {
        score += 40;
    } else {
        // Partial match - check for keyword overlap
        const jobKeywords = new Set(job.title.toLowerCase().split(' '));
        const titleKeywords = new Set(
            cluster.job_titles.join(' ').toLowerCase().split(' ')
        );
        const overlap = [...jobKeywords].filter(k => titleKeywords.has(k));
        if (overlap.length > 0) {
            score += Math.min(20, overlap.length * 5);
        }
    }
    
    // 2. Skills Match (35 points)
    const matchedSkills = job.required_skills.filter(
        skill => cluster.skills.some(s => s.toLowerCase() === skill.toLowerCase())
    );
    
    if (job.required_skills.length > 0) {
        const skillPercentage = matchedSkills.length / job.required_skills.length;
        score += skillPercentage * 35;
    }
    
    // 3. Education Match (15 points)
    // Use highest education level from array
    const highestLevel = getHighestEducationLevel(candidate.education);
    if (job.required_education.level) {
        const eduScore = compareEducation(
            highestLevel,
            job.required_education.level
        );
        score += eduScore * 15;
        
        // Bonus for field relevance (5 points)
        if (job.required_education.field && 
            job.required_education.field !== "Any") {
            const isRelated = isFieldRelated(
                candidate.education[0]?.field,
                job.required_education.field
            );
            if (isRelated) score += 5;
        }
    }
    
    // 4. Experience Match (10 points)
    if (job.required_experience_years > 0) {
        const expRatio = Math.min(
            1.0,
            cluster.years_experience / job.required_experience_years
        );
        score += expRatio * 10;
    }
    
    return Math.round(score);
}

function getHighestEducationLevel(educationArray) {
    const levels = ['None', 'Certificate', 'Diploma', 'Bachelor', 'Masters', 'PhD'];
    let highest = 'None';
    for (const edu of educationArray || []) {
        const idx = levels.indexOf(edu.level);
        const currentIdx = levels.indexOf(highest);
        if (idx > currentIdx) {
            highest = edu.level;
        }
    }
    return highest;
}
```

### Step 3: Education Level Comparison

```javascript
const EDUCATION_LEVELS = {
    'PhD': 5,
    'Masters': 4,
    'Bachelor': 3,
    'Diploma': 2,
    'Certificate': 1,
    'None': 0
};

function compareEducation(candidateLevel, jobRequiredLevel) {
    const candidateValue = EDUCATION_LEVELS[candidateLevel] || 0;
    const requiredValue = EDUCATION_LEVELS[jobRequiredLevel] || 0;
    
    if (candidateValue >= requiredValue) {
        return 1.0;
    } else if (candidateValue === requiredValue - 1) {
        return 0.7;
    } else if (candidateValue === requiredValue - 2) {
        return 0.3;
    } else {
        return 0.0;
    }
}
```

### Step 4: Generate Explanation

```javascript
function generateExplanation(cluster, job) {
    const matchedSkills = job.required_skills.filter(
        skill => cluster.skills.some(s => s.toLowerCase() === skill.toLowerCase())
    );
    
    const sampleTitle = cluster.job_titles[0] || 'your experience';
    let explanation = `This job matches your experience as a ${sampleTitle}`;
    
    if (matchedSkills.length > 0) {
        const skillList = matchedSkills.slice(0, 3).join(', ');
        explanation += ` and your skills in ${skillList}`;
        if (matchedSkills.length > 3) {
            explanation += ` and ${matchedSkills.length - 3} other skills`;
        }
    }
    
    return explanation;
}
```

### Step 5: Final Ranking with Scalable Query

```javascript
async function rankJobsForCandidate(candidateId, jobId) {
    // Get candidate with their clusters
    const candidate = await getCandidateWithClusters(candidateId);
    const job = await getJob(jobId);
    
    // Only match if function exists
    const activeClusters = candidate.work_experience.filter(c => c.selected);
    let bestScore = 0;
    let bestCluster = null;
    
    for (const cluster of activeClusters) {
        if (cluster.function.toLowerCase() === job.job_function.toLowerCase()) {
            const score = calculateMatchScore(cluster, job, candidate);
            if (score > bestScore) {
                bestScore = score;
                bestCluster = cluster;
            }
        }
    }
    
    if (bestCluster) {
        return {
            candidate_id: candidateId,
            job_id: jobId,
            match_score: bestScore,
            matched_cluster_id: bestCluster.cluster_id,
            explanation: generateExplanation(bestCluster, job)
        };
    }
    
    return null;
}
```

## 6.3 What We Match On vs What We Don't

### ✅ MATCH ON:

| Factor | Weight | Purpose |
|--------|--------|---------|
| **Function** | Required | Primary filter - job must match a candidate cluster |
| **Job Titles** | 40 points | Exact or partial title match |
| **Skills** | 35 points | Percentage of required skills present |
| **Education Level** | 15 points | Higher or equal to requirement |
| **Education Field** | 5 points (bonus) | Related field |
| **Experience Years** | 10 points | Years in matching cluster |

### ❌ DO NOT MATCH ON:

| Factor | Reason |
|--------|--------|
| **Driver's License** | Administrative requirement - candidate decides |
| **Age** | Not relevant for matching |
| **Nationality** | Not relevant for matching |
| **Languages** | Not relevant for matching |
| **Certifications** | Too varied, hard to standardize |
| **Referees** | Not relevant for matching |
| **Company Sector** | Too ambiguous to extract from CV |
| **Grade/Class** | Not relevant for matching |
| **Location** | Candidate decides if they want to relocate |

---

# 7. Database Schema

## 7.1 MySQL Schema

```sql
-- ============================================
-- CANDIDATES TABLE
-- ============================================
CREATE TABLE candidates (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    full_name VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255) UNIQUE,
    location VARCHAR(255),
    
    -- Raw data
    raw_cv_text LONGTEXT,
    parsed_data JSON,  -- Full candidate JSON
    
    -- Authentication
    password_hash VARCHAR(255),
    auth_provider ENUM('email', 'google') DEFAULT 'email',
    auth_id VARCHAR(255),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_email (email)
);

-- ============================================
-- CANDIDATE EDUCATION (Array)
-- ============================================
CREATE TABLE candidate_education (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    candidate_id VARCHAR(36) NOT NULL,
    
    level ENUM('PhD','Masters','Bachelor','Diploma','Certificate','None'),
    field VARCHAR(255),
    institution VARCHAR(255),
    start_year INT,
    end_year INT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    INDEX idx_candidate (candidate_id),
    INDEX idx_level (level)
);

-- ============================================
-- CANDIDATE WORK EXPERIENCE (Clusters)
-- ============================================
CREATE TABLE candidate_clusters (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    candidate_id VARCHAR(36) NOT NULL,
    
    -- Normalized fields
    function ENUM('Administration','Finance','IT','Engineering','Sales','Marketing','Healthcare','Education','Hospitality','Logistics','Legal','Customer Service','Operations','Human Resources','Other'),
    job_titles JSON,  -- Array of strings
    skills JSON,      -- Array of strings
    years_experience DECIMAL(5,2),
    representative_company VARCHAR(255),
    
    -- User selection
    selected BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    INDEX idx_candidate (candidate_id),
    INDEX idx_function (function),
    INDEX idx_selected (selected)
);

-- ============================================
-- CANDIDATE EXTRAS (Resume Builder)
-- ============================================
CREATE TABLE candidate_extras (
    candidate_id VARCHAR(36) PRIMARY KEY,
    certifications JSON,
    referees JSON,
    languages JSON,
    professional_memberships JSON,
    trainings JSON,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
);

-- ============================================
-- JOBS TABLE
-- ============================================
CREATE TABLE jobs (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    title VARCHAR(255),
    company VARCHAR(255),
    
    -- Normalized fields
    sector ENUM('Agriculture','Banking','Construction','Education','Energy','Finance','Government','Healthcare','Hospitality','Insurance','IT/Technology','Legal','Manufacturing','Media','NGO/Development','Real Estate','Retail','Telecommunications','Transport/Logistics','Other'),
    job_function ENUM('Administration','Finance','IT','Engineering','Sales','Marketing','Healthcare','Education','Hospitality','Logistics','Legal','Customer Service','Operations','Human Resources','Other'),
    
    location VARCHAR(255),
    job_type ENUM('Full-time','Part-time','Contract','Internship'),
    
    required_skills JSON,  -- Array of strings
    required_education_level ENUM('PhD','Masters','Bachelor','Diploma','Certificate','None'),
    required_education_field VARCHAR(255),
    required_experience_years INT DEFAULT 0,
    
    description LONGTEXT,
    application_deadline DATE,
    posted_by VARCHAR(36),
    
    -- Raw data
    raw_jd_text LONGTEXT,
    parsed_data JSON,  -- Full job JSON
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_job_function (job_function),
    INDEX idx_sector (sector),
    INDEX idx_job_type (job_type),
    INDEX idx_created_at (created_at)
);

-- ============================================
-- JOB MATCHES (Pre-computed)
-- ============================================
CREATE TABLE job_matches (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    candidate_id VARCHAR(36) NOT NULL,
    job_id VARCHAR(36) NOT NULL,
    match_score INT,
    matched_cluster_id VARCHAR(36),
    explanation TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (matched_cluster_id) REFERENCES candidate_clusters(id) ON DELETE SET NULL,
    
    UNIQUE KEY unique_match (candidate_id, job_id),
    INDEX idx_candidate (candidate_id),
    INDEX idx_job (job_id),
    INDEX idx_score (match_score DESC)
);

-- ============================================
-- PARSE FAILURES (LLM Error Logging)
-- ============================================
CREATE TABLE parse_failures (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    raw_text TEXT,
    error_message TEXT,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_resolved (resolved),
    INDEX idx_created (created_at)
);
```

---

# 8. Tech Stack Recommendations

## 8.1 Overview

| Component | Technology | Reason |
|-----------|-----------|--------|
| **Frontend** | Next.js 15+ (React) | Full-stack framework, API routes, server components |
| **Backend** | Next.js API Routes | Unified codebase, easy deployment |
| **Database** | MySQL 8.0+ | Reliable, widely used, JSON support |
| **ORM** | Prisma or Drizzle | Type-safe database access |
| **LLM** | Gemini 1.5 Flash | Cheap ($0.001/call), fast, large context |
| **Background Jobs** | Cron Jobs / GitHub Actions | Simple, reliable, no extra infra |
| **Authentication** | NextAuth.js | Built for Next.js, OAuth support |
| **Language** | TypeScript | Type safety, better DX |
| **Testing** | Jest + React Testing Library | Unit and integration tests |
| **Hosting** | Vercel / AWS | Scalable, easy deployment |

## 8.2 Project Structure

```
project/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   │       └── route.ts         # NextAuth.js setup
│   │   ├── candidates/
│   │   │   ├── route.ts             # POST - Upload CV
│   │   │   └── [id]/
│   │   │       ├── route.ts         # GET - Candidate details
│   │   │       ├── matches/
│   │   │       │   └── route.ts     # GET - Candidate matches
│   │   │       └── trajectories/
│   │   │           └── route.ts     # PUT - Update selections
│   │   ├── jobs/
│   │   │   ├── route.ts             # POST - Post job
│   │   │   └── [id]/
│   │   │       └── route.ts         # GET - Job details
│   │   ├── match/
│   │   │   └── route.ts             # POST - Trigger matching
│   │   └── cron/
│   │       └── matching/
│   │           └── route.ts         # Cron endpoint
│   ├── dashboard/
│   │   ├── candidate/
│   │   │   └── page.tsx             # Candidate dashboard
│   │   └── admin/
│   │       ├── page.tsx             # Admin dashboard
│   │       └── jobs/
│   │           └── new/
│   │               └── page.tsx     # Post job page
│   └── page.tsx                     # Landing page
├── lib/
│   ├── db.ts                        # Database connection
│   ├── llm.ts                       # LLM integration
│   ├── normalize.ts                 # Normalization helpers
│   ├── matching.ts                  # Matching algorithm
│   ├── enums.ts                     # Enum definitions
│   └── field-mapping.ts             # Related fields mapping
├── models/
│   ├── Candidate.ts
│   ├── Job.ts
│   └── JobMatch.ts
├── scripts/
│   └── run-matching.ts              # Cron job script
├── types/
│   └── index.ts                     # TypeScript types
├── middleware.ts                    # NextAuth middleware
├── prisma/
│   └── schema.prisma                # Prisma schema (optional)
├── package.json
├── tsconfig.json
└── .env.local
```

## 8.3 Key Dependencies

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "@prisma/client": "^5.0.0",
    "next-auth": "^4.24.0",
    "@google/generative-ai": "^1.0.0",
    "pdf-parse": "^1.1.1",
    "mammoth": "^1.6.0",
    "zod": "^3.22.0",
    "bcryptjs": "^2.4.3"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "typescript": "^5.0.0",
    "prisma": "^5.0.0",
    "jest": "^29.0.0",
    "@testing-library/react": "^14.0.0"
  }
}
```

## 8.4 Authentication Setup

```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

export const authOptions = {
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
        Credentials({
            name: 'Email',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' }
            },
            async authorize(credentials) {
                const users = await query(
                    'SELECT * FROM candidates WHERE email = ?',
                    [credentials?.email]
                );
                const user = users[0];
                if (user && await bcrypt.compare(credentials!.password, user.password_hash)) {
                    return { id: user.id, name: user.full_name, email: user.email, role: 'candidate' };
                }
                return null;
            }
        })
    ],
    callbacks: {
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.sub!;
                session.user.role = token.role as string;
            }
            return session;
        },
        async jwt({ token, user }) {
            if (user) {
                token.role = (user as any).role || 'candidate';
            }
            return token;
        }
    },
    pages: {
        signIn: '/login',
        signUp: '/register'
    }
};

export const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

```typescript
// middleware.ts
import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token;
        const path = req.nextUrl.pathname;
        
        // Admin routes protection
        if (path.startsWith('/dashboard/admin') && token?.role !== 'admin') {
            return NextResponse.redirect(new URL('/dashboard/candidate', req.url));
        }
        
        return NextResponse.next();
    },
    {
        callbacks: {
            authorized: ({ token }) => !!token
        }
    }
);

export const config = {
    matcher: ['/dashboard/:path*', '/api/protected/:path*']
};
```

---

# 9. API Endpoints

## 9.1 Candidate APIs

### POST /api/candidates
**Upload and parse CV**

```typescript
// app/api/candidates/route.ts
import { parseCV } from '@/lib/llm';
import { normalizeCandidate } from '@/lib/normalize';
import { query } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
        const formData = await request.formData();
        const file = formData.get('cv');
        const text = await extractText(file);
        
        // LLM Parsing with retry
        const rawJson = await parseCV(text);
        if (!rawJson || rawJson._error) {
            return Response.json({ 
                error: 'Failed to parse CV',
                details: rawJson?._message || 'Unknown error'
            }, { status: 400 });
        }
        
        // Normalization
        const normalized = normalizeCandidate(rawJson);
        
        // Store candidate
        const result = await query(
            `INSERT INTO candidates (
                full_name, phone, email, location,
                raw_cv_text, parsed_data
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [
                normalized.profile.full_name,
                normalized.profile.phone,
                normalized.profile.email,
                normalized.profile.location,
                text,
                JSON.stringify(normalized)
            ]
        );
        
        const candidateId = result.insertId;
        
        // Store education (array)
        for (const edu of normalized.education || []) {
            await query(
                `INSERT INTO candidate_education (
                    candidate_id, level, field, institution,
                    start_year, end_year
                ) VALUES (?, ?, ?, ?, ?, ?)`,
                [candidateId, edu.level, edu.field, edu.institution, edu.start_year, edu.end_year]
            );
        }
        
        // Store clusters
        for (const cluster of normalized.work_experience || []) {
            await query(
                `INSERT INTO candidate_clusters (
                    candidate_id, function, job_titles, skills,
                    years_experience, representative_company, selected
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    candidateId,
                    cluster.function,
                    JSON.stringify(cluster.job_titles),
                    JSON.stringify(cluster.skills),
                    cluster.years_experience,
                    cluster.representative_company,
                    true
                ]
            );
        }
        
        // Store extras
        if (normalized.extras) {
            await query(
                `INSERT INTO candidate_extras (
                    candidate_id, certifications, referees, languages,
                    professional_memberships, trainings
                ) VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    candidateId,
                    JSON.stringify(normalized.extras.certifications || []),
                    JSON.stringify(normalized.extras.referees || []),
                    JSON.stringify(normalized.extras.languages || []),
                    JSON.stringify(normalized.extras.professional_memberships || []),
                    JSON.stringify(normalized.extras.trainings || [])
                ]
            );
        }
        
        // Trigger initial matching for this candidate against all jobs
        await triggerMatchingForCandidate(candidateId);
        
        return Response.json({
            success: true,
            candidate_id: candidateId,
            message: 'CV uploaded and parsed successfully'
        });
        
    } catch (error) {
        console.error('Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
```

### GET /api/candidates/[id]/matches

```typescript
// app/api/candidates/[id]/matches/route.ts
import { query } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.id !== params.id) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
        const { id } = params;
        
        const matches = await query(
            `SELECT 
                j.id as job_id,
                j.title,
                j.company,
                j.sector,
                j.location,
                j.job_type,
                j.required_skills,
                j.required_education_level,
                j.required_experience_years,
                jm.match_score,
                jm.explanation,
                jm.created_at as matched_at
            FROM job_matches jm
            JOIN jobs j ON jm.job_id = j.id
            WHERE jm.candidate_id = ?
            ORDER BY jm.match_score DESC
            LIMIT 50`,
            [id]
        );
        
        return Response.json({
            success: true,
            matches
        });
        
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
```

### PUT /api/candidates/[id]/trajectories

```typescript
// app/api/candidates/[id]/trajectories/route.ts
import { query } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { triggerMatchingForCandidate } from '@/lib/matching';

export async function PUT(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.id !== params.id) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
        const { selected_clusters } = await request.json();
        
        // Validate max 3 selections
        if (selected_clusters.length > 3) {
            return Response.json({ 
                error: 'You can select a maximum of 3 trajectories' 
            }, { status: 400 });
        }
        
        // Reset all selections
        await query(
            `UPDATE candidate_clusters 
             SET selected = FALSE 
             WHERE candidate_id = ?`,
            [params.id]
        );
        
        // Set selected ones
        if (selected_clusters.length > 0) {
            await query(
                `UPDATE candidate_clusters 
                 SET selected = TRUE 
                 WHERE id IN (?) AND candidate_id = ?`,
                [selected_clusters, params.id]
            );
        }
        
        // Trigger re-matching with updated preferences
        await triggerMatchingForCandidate(params.id);
        
        return Response.json({
            success: true,
            message: 'Trajectories updated successfully'
        });
        
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
```

## 9.2 Job APIs

### POST /api/jobs

```typescript
// app/api/jobs/route.ts
import { parseJD } from '@/lib/llm';
import { normalizeJob } from '@/lib/normalize';
import { query } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { triggerMatchingForJob } from '@/lib/matching';

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== 'admin') {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
        const body = await request.json();
        const { input_type, data } = body;
        
        let normalizedData = null;
        let rawJdText = null;
        
        switch (input_type) {
            case 'paste':
                // Raw JD text → LLM extraction
                rawJdText = data;
                const llmResult = await parseJD(data);
                if (llmResult._error) {
                    return Response.json({ 
                        error: 'Failed to parse job description',
                        details: llmResult._message
                    }, { status: 400 });
                }
                normalizedData = normalizeJob(llmResult);
                break;
                
            case 'upload':
                // File upload → extract text → LLM
                const file = data.file;
                const extractedText = await extractText(file);
                rawJdText = extractedText;
                const llmResult2 = await parseJD(extractedText);
                if (llmResult2._error) {
                    return Response.json({ 
                        error: 'Failed to parse job description',
                        details: llmResult2._message
                    }, { status: 400 });
                }
                normalizedData = normalizeJob(llmResult2);
                break;
                
            case 'json':
                // Already structured JSON → validate → use directly
                try {
                    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
                    // Validate schema
                    validateJobSchema(parsed);
                    normalizedData = normalizeJob(parsed);
                } catch (e) {
                    return Response.json({ error: 'Invalid JSON format' }, { status: 400 });
                }
                break;
                
            case 'form':
                // Already structured from form fields
                normalizedData = normalizeJob({ job: data });
                break;
                
            default:
                return Response.json({ error: 'Invalid input type' }, { status: 400 });
        }
        
        // Store job
        const result = await query(
            `INSERT INTO jobs (
                title, company, sector, job_function,
                location, job_type, required_skills,
                required_education_level, required_education_field,
                required_experience_years, description,
                application_deadline, posted_by, raw_jd_text, parsed_data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                normalizedData.job.title,
                normalizedData.job.company,
                normalizedData.job.sector,
                normalizedData.job.job_function,
                normalizedData.job.location,
                normalizedData.job.job_type,
                JSON.stringify(normalizedData.job.required_skills || []),
                normalizedData.job.required_education?.level || 'None',
                normalizedData.job.required_education?.field || 'Any',
                normalizedData.job.required_experience_years || 0,
                data.description || '',
                data.application_deadline || null,
                session.user.id,
                rawJdText,
                JSON.stringify(normalizedData)
            ]
        );
        
        const jobId = result.insertId;
        
        // Trigger background matching for this job
        await triggerMatchingForJob(jobId);
        
        return Response.json({
            success: true,
            job_id: jobId,
            message: 'Job posted successfully'
        });
        
    } catch (error) {
        console.error('Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
```

### GET /api/jobs/[id]

```typescript
// app/api/jobs/[id]/route.ts
import { query } from '@/lib/db';

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const job = await query(
            `SELECT * FROM jobs WHERE id = ?`,
            [params.id]
        );
        
        if (job.length === 0) {
            return Response.json({ error: 'Job not found' }, { status: 404 });
        }
        
        return Response.json({
            success: true,
            job: job[0]
        });
        
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
```

---

# 10. User Interface Flows

## 10.1 Candidate Onboarding: Trajectory Selection

```
┌─────────────────────────────────────────────────────────────────────┐
│  We've Analyzed Your CV!                                          │
│                                                                     │
│  We found these work experiences:                                 │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ☑ Trajectory 1: Administration (3.5 years)                │   │
│  │     Roles: Admin Assistant, Office Administrator           │   │
│  │     Skills: Filing, Scheduling, Customer Service           │   │
│  │     Company: Amunga & Sons Ltd                             │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │  ☑ Trajectory 2: Finance (2.0 years)                      │   │
│  │     Roles: Accounts Assistant, Bookkeeper                  │   │
│  │     Skills: Bookkeeping, Reconciliation, QuickBooks        │   │
│  │     Company: KCB Bank                                      │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │  ☑ Trajectory 3: Sales (1.5 years)                        │   │
│  │     Roles: Cashier, Sales Associate                        │   │
│  │     Skills: POS, Cash Handling, Sales                      │   │
│  │     Company: Naivas Supermarket                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Select up to 3 trajectories you want to focus on:                 │
│  (You can change this anytime)                                     │
│                                                                     │
│  [Save Preferences]  [Skip for Now]                                │
└─────────────────────────────────────────────────────────────────────┘
```

## 10.2 Candidate Dashboard

```
┌─────────────────────────────────────────────────────────────────────┐
│  Welcome, John Mwangi!                                             │
│                                                                     │
│  Your Focus Areas: Administration, Finance, Sales                  │
│  [Change Focus Areas]                                              │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Your Matches (15 jobs)                          [Filter ▼] │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │                                                             │   │
│  │  ★ Admin Assistant - Aga Khan Hospital                    │   │
│  │    Match: 92% • Sector: Healthcare                        │   │
│  │    📍 Nairobi (You are in Nairobi)                        │   │
│  │    Matches your Admin Assistant experience                │   │
│  │    Skills: Filing, Scheduling, Customer Service           │   │
│  │    [Apply Now]  [Save]                                    │   │
│  │                                                             │   │
│  │  ★ Office Administrator - KCB Bank                       │   │
│  │    Match: 85% • Sector: Banking                          │   │
│  │    📍 Mombasa (You are in Nairobi - 480km away)          │   │
│  │    Matches your Office Administrator experience          │   │
│  │    Skills: MS Office, Scheduling, Records Mgmt           │   │
│  │    [Apply Now]  [Save]                                    │   │
│  │                                                             │   │
│  │  ★ Accounts Assistant - Safaricom                        │   │
│  │    Match: 78% • Sector: Telecom                          │   │
│  │    📍 Nairobi (You are in Nairobi)                        │   │
│  │    Matches your Accounts Assistant experience            │   │
│  │    Skills: Bookkeeping, Reconciliation, QuickBooks       │   │
│  │    [Apply Now]  [Save]                                    │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  My Profile | My Applications | Job Feed                           │
└─────────────────────────────────────────────────────────────────────┘
```

## 10.3 Admin Job Posting

```
┌─────────────────────────────────────────────────────────────────────┐
│  Post a New Job                                                    │
│                                                                     │
│  How do you want to create this job?                               │
│                                                                     │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌─────────────┐ │
│  │  📝 Paste JD  │  │  📄 Upload    │  │  📋 Paste JSON│  │  ✏️ Fill     │ │
│  │  Text         │  │  File         │  │  (Power User) │  │  Form       │ │
│  └───────────────┘  └───────────────┘  └───────────────┘  └─────────────┘ │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  [Paste your job description here...]                              │   │
│  │                                                                     │   │
│  │  Or upload a file: [Choose File]                                   │   │
│  │                                                                     │   │
│  │  Or paste JSON:                                                    │   │
│  │  { "title": "Sales Van Representative", ... }                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  [  Auto-Extract  ]  [  Continue  ]                                       │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────── │
│                                                                             │
│  Job Title:    [Sales Van Representative     ]                            │
│  Company:      [HCS Affiliates Group         ]                            │
│  Sector:       [Telecommunications ▼]                                     │
│  Job Function: [Sales ▼]                                                  │
│  Location:     [North Rift, Kenya           ]                            │
│  Job Type:     [Full-time ▼]                                              │
│                                                                             │
│  Required Skills:                                                          │
│  [Sales] [Merchandising] [Negotiation] [Customer Focus] [+ Add]          │
│                                                                             │
│  Required Education:                                                       │
│  Level: [Diploma ▼]    Field: [Business ]                                 │
│                                                                             │
│  Minimum Experience: [1] years                                            │
│                                                                             │
│  [Preview Job]  [Post Job]                                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

# 11. Background Jobs

## 11.1 Matching Cron Job

### Option A: GitHub Actions (Recommended)

```yaml
# .github/workflows/matching.yml
name: Run Matching

on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:  # Manual trigger

jobs:
  run-matching:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm install
      - name: Run matching
        run: npx prisma generate && npx ts-node scripts/run-matching.ts
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
```

### Option B: Vercel Cron Jobs

```typescript
// app/api/cron/matching/route.ts
import { runMatching } from '@/lib/matching';

export async function GET(request: Request) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    try {
        const result = await runMatching();
        return Response.json({ success: true, result });
    } catch (error) {
        console.error('Cron job failed:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
```

### Matching Script with Scalable Query

```typescript
// scripts/run-matching.ts
import { query } from '../lib/db';
import { rankJobsForCandidate } from '../lib/matching';

async function runMatching() {
    console.log('🔄 Starting matching job...');
    
    // Get jobs posted in the last hour (incremental)
    const jobs = await query(
        `SELECT * FROM jobs 
         WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
         ORDER BY created_at DESC`
    );
    
    if (jobs.length === 0) {
        console.log('No new jobs to match');
        return { processed: 0, matches: 0 };
    }
    
    console.log(`📋 Found ${jobs.length} new job(s) to match`);
    let totalMatches = 0;
    
    for (const job of jobs) {
        console.log(`  🔍 Matching job: ${job.title} (${job.job_function})`);
        
        // SCALABLE: Only get candidates with matching function
        const candidates = await query(
            `SELECT DISTINCT c.* 
             FROM candidates c
             JOIN candidate_clusters cc ON c.id = cc.candidate_id
             WHERE cc.function = ? 
               AND cc.selected = TRUE
             ORDER BY c.created_at DESC`,
            [job.job_function]
        );
        
        console.log(`    Found ${candidates.length} candidates with matching function`);
        
        for (const candidate of candidates) {
            // Get candidate clusters
            const clusters = await query(
                `SELECT * FROM candidate_clusters 
                 WHERE candidate_id = ? AND selected = TRUE`,
                [candidate.id]
            );
            
            const candidateWithClusters = {
                ...candidate,
                work_experience: clusters,
                education: await query(
                    `SELECT * FROM candidate_education 
                     WHERE candidate_id = ?`,
                    [candidate.id]
                )
            };
            
            // Calculate match
            const match = await rankJobsForCandidate(
                candidate.id,
                job.id,
                candidateWithClusters
            );
            
            if (match) {
                await query(
                    `INSERT INTO job_matches (
                        candidate_id, job_id, match_score,
                        matched_cluster_id, explanation
                    ) VALUES (?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        match_score = VALUES(match_score),
                        explanation = VALUES(explanation),
                        updated_at = CURRENT_TIMESTAMP`,
                    [
                        candidate.id,
                        job.id,
                        match.match_score,
                        match.matched_cluster_id,
                        match.explanation
                    ]
                );
                totalMatches++;
            }
        }
    }
    
    console.log(`✅ Matching completed: ${totalMatches} matches created/updated`);
    return { processed: jobs.length, matches: totalMatches };
}

// Run if called directly
if (require.main === module) {
    runMatching()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('❌ Fatal error:', error);
            process.exit(1);
        });
}

export { runMatching };
```

---

# 12. Implementation Roadmap

## Phase 1: Foundation (2 Weeks)

| Task | Description | Effort |
|------|-------------|--------|
| Database Setup | Create MySQL database, tables, indexes | 2 days |
| LLM Integration | Setup Gemini API, test prompts | 3 days |
| Normalization Layer | Implement enum mapping functions | 2 days |
| Authentication | Setup NextAuth.js with Google + Email | 2 days |
| Basic API Routes | Candidate upload, job posting | 3 days |

**Deliverables:**
- ✅ Working database schema with indexes
- ✅ LLM extraction working for CVs and JDs
- ✅ Normalization pipeline with word-boundary matching
- ✅ Authentication working (login, signup, session)
- ✅ API endpoints for upload/post

---

## Phase 2: Matching Engine (2 Weeks)

| Task | Description | Effort |
|------|-------------|--------|
| Matching Algorithm | Implement function + skills + education + experience scoring | 3 days |
| Ranking Logic | Calculate match scores, sort results | 2 days |
| Match Storage | Store matches in database, handle updates | 2 days |
| Background Job | Setup cron job for automatic matching | 3 days |

**Deliverables:**
- ✅ Matching algorithm working with scalable queries
- ✅ Matches stored in database
- ✅ Cron job running every 5 minutes
- ✅ Error handling for LLM failures

---

## Phase 3: User Interface (3 Weeks)

| Task | Description | Effort |
|------|-------------|--------|
| Landing Page | Homepage with job search | 3 days |
| Candidate Dashboard | Show matches, filter, sort | 5 days |
| Admin Dashboard | Post jobs (4 input methods), view applicants | 3 days |
| Trajectory Selection | UI for selecting focus areas (max 3) | 2 days |
| Job Detail Page | View job, apply, save | 2 days |

**Deliverables:**
- ✅ Candidate dashboard showing ranked matches
- ✅ Admin dashboard with 4 input methods (Paste, Upload, JSON, Form)
- ✅ Trajectory selection UI (max 3)
- ✅ Location displayed as information, not filter

---

## Phase 4: Polish & Launch (2 Weeks)

| Task | Description | Effort |
|------|-------------|--------|
| Testing | Unit tests, integration tests | 3 days |
| Edge Cases | Handle empty data, malformed CVs | 2 days |
| Performance | Query optimization, caching | 2 days |
| Documentation | API docs, user guides | 2 days |
| Deployment | Deploy to Vercel/AWS | 1 day |

**Deliverables:**
- ✅ Tested, production-ready platform
- ✅ Documentation complete
- ✅ Deployed live

---

## Total Timeline: ~9 Weeks

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Phase 1: Foundation | 2 Weeks | Week 2 |
| Phase 2: Matching Engine | 2 Weeks | Week 4 |
| Phase 3: User Interface | 3 Weeks | Week 7 |
| Phase 4: Polish & Launch | 2 Weeks | Week 9 |

---

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

-- Add soft-delete columns to the candidates table.
-- is_active = FALSE marks the account as deactivated (hidden from matching, hidden from admin lists).
-- deleted_at timestamps the deletion request so the purge cron can find records past their 30-day grace period.
ALTER TABLE candidates
ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN deleted_at DATETIME NULL,
ADD COLUMN consent_version VARCHAR(20) DEFAULT '1.0',
ADD COLUMN consent_date DATETIME NULL,
ADD INDEX idx_candidates_active_deleted (is_active, deleted_at);

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

export async function DELETE(request: Request) {
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
| Soft-deleted accounts | 30-day grace period, then permanent purge | Automated cron job (daily) |

Table 13.2: Data Retention Schedule

### 13.7.1 Purge Cron Job Implementation

The purge cron runs daily and permanently deletes candidates whose 30-day grace period has elapsed. Before purge, it records an audit trail in `deletion_requests.deleted_data` so the platform can prove compliance with DPA Section 40 (right to erasure) even after the data is gone.

```typescript
// app/cron/purge-deleted/route.ts
// Triggered daily at 02:00 EAT via GitHub Actions / Vercel Cron.
// Route is protected by a CRON_SECRET bearer token.

import { query } from '@/lib/db';

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Find candidates whose 30-day grace period has elapsed.
        const expired = await query(
            `SELECT id, email, full_name
               FROM candidates
              WHERE is_active = FALSE
                AND deleted_at IS NOT NULL
                AND deleted_at < (NOW() - INTERVAL 30 DAY)`
        );

        let purged = 0;
        for (const candidate of expired) {
            // 1. Capture audit trail (what is about to be deleted)
            await query(
                `UPDATE deletion_requests
                    SET status = 'processing',
                        deleted_data = JSON_OBJECT(
                            'email', ?,
                            'full_name', ?,
                            'purge_date', NOW(),
                            'cv_count', (SELECT COUNT(*) FROM candidate_clusters WHERE candidate_id = ?),
                            'match_count', (SELECT COUNT(*) FROM job_matches WHERE candidate_id = ?)
                        )
                  WHERE user_id = ? AND status = 'pending'`,
                [candidate.email, candidate.full_name, candidate.id, candidate.id, candidate.id]
            );

            // 2. Hard cascade delete (FK ON DELETE CASCADE handles child tables)
            await query(`DELETE FROM candidates WHERE id = ?`, [candidate.id]);

            // 3. Mark deletion request as completed
            await query(
                `UPDATE deletion_requests
                    SET status = 'completed', completion_date = NOW()
                  WHERE user_id = ?`,
                [candidate.id]
            );

            purged++;
        }

        return Response.json({
            success: true,
            purged_count: purged,
            checked_count: expired.length
        });
    } catch (error) {
        console.error('Purge cron failed:', error);
        return Response.json({ error: (error as Error).message }, { status: 500 });
    }
}
```

Listing 13.3: Daily purge cron job for completed soft-deletes

### 13.7.2 Inactivity Sweep Cron Job

Separate from the purge cron, an inactivity sweep runs monthly to identify candidates who have not logged in for 2 years. These candidates receive a warning email 14 days before scheduled deletion, giving them a chance to log in and reset their inactivity clock.

```yaml
# .github/workflows/data-retention.yml
name: Data Retention Sweep
on:
  schedule:
    - cron: '0 0 1 * *'  # 1st of every month at 00:00 UTC
jobs:
  sweep:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger inactivity sweep
        run: |
          curl -X POST ${{ secrets.PROD_URL }}/api/cron/inactivity-sweep \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
      - name: Trigger purge (daily, but also run on sweep day)
        run: |
          curl -X GET ${{ secrets.PROD_URL }}/api/cron/purge-deleted \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

Listing 13.4: Monthly retention sweep cron configuration

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


---

# 15. Appendix / Quick Reference

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

# Summary of Key Decisions

| Decision | Status | Reasoning |
|----------|--------|-----------|
| **Extract with LLM** | ✅ Yes | Handles messy Kenyan CVs better than regex |
| **Work Experience Clusters** | ✅ Yes | Candidates have multiple career paths |
| **Limit to 3 Trajectories** | ✅ Yes | Sweet spot between flexibility and focus |
| **Education as Array** | ✅ Yes | Many candidates have multiple qualifications |
| **Sector on Candidate** | ❌ Removed | Too ambiguous to extract reliably |
| **Sector on Job** | ✅ Included | Admin provides it for filters/labels |
| **Function Matching** | ✅ Required | Primary filter for showing jobs |
| **Skills Matching** | ✅ Ranking | Determines rank within matching functions |
| **Education Matching** | ✅ Ranking | Never disqualifies, only boosts rank |
| **Experience Matching** | ✅ Ranking | Never disqualifies, only boosts rank |
| **Administrative Requirements** | ❌ Not Matched | Candidate decides if they qualify |
| **Location** | ❌ Not Filtered | Candidate decides if they want to relocate |
| **Hard Disqualification** | ❌ Never | No candidate is ever locked out |
| **Extras (Certifications, Referees)** | ✅ Stored | For resume builder, NOT for matching |
| **LLM for JDs** | ⚠️ Conditional | Only for paste/upload, not for form/json |
| **Tech Stack** | Next.js 15 + TypeScript + Prisma | Modern, scalable, type-safe |
| **Background Jobs** | Cron Jobs | Simple, reliable, no extra infra |
| **Authentication** | NextAuth.js | Built for Next.js, OAuth support |
| **Normalization** | Word-boundary regex | Avoids false positives |
| **Data Privacy** | ✅ DPA Compliant | Kenya DPA 2019, consent, retention, breach notification |
| **Field Similarity** | ✅ Predefined Matrix | Replaces naive includes() with 3-tier matching |
| **Account Deletion** | ✅ Soft-delete | `is_active=FALSE` + 30-day purge window, user can revoke |
| **DELETE Method** | ✅ REST-correct | Privacy delete endpoint uses HTTP DELETE (not POST) |
| **Appendix (Sec 15)** | ✅ Added | Quick reference for scores, data matrix, API surface |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | April 2026 | Initial documentation |
| 2.0 | May 2026 | Added normalization, matching algorithm, database schema |
| 3.0 | May 2026 | Added authentication, education as array, word-boundary matching, LLM error handling, scalable matching, 4 input methods for jobs |
| 4.0 | July 2026 | Added data privacy & DPA compliance (Section 13), field similarity mapping (Section 14), breach notification, data retention policy, Appendix / Quick Reference (Section 15), soft-delete with 30-day grace period, REST-correct DELETE endpoint |

