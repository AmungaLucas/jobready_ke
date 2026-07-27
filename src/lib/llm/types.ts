// ============================================================================
// lib/llm/types.ts
// Shared types for LLM extraction (CV and JD).
// These types describe the JSON the LLM is asked to produce, BEFORE
// normalization to canonical enums. Normalization happens in the
// extract-*.ts modules after parsing.
// ============================================================================

// ─── CV extraction (raw LLM output) ─────────────────────────────────────────

export interface RawWorkExperience {
  jobTitle: string;
  company?: string;
  startDate?: string; // "2020-01" or "Jan 2020"
  endDate?: string; // "2022-03" or "Present"
  yearsExperience: number; // computed by LLM
  description?: string;
  function: string; // raw text — will be normalized to JobFunction
  specialization?: string; // e.g. "ITT-NET" — will be validated
  skills: string[];
}

export interface RawEducation {
  level: string; // raw text — will be normalized to EducationLevel
  field: string;
  institution?: string;
  graduationYear?: number;
}

export interface RawCluster {
  function: string; // canonical JobFunction string
  specialization?: string; // e.g. "ITT-NET"
  jobTitles: string[];
  skills: string[];
  yearsExperience: number;
}

export interface CVExtractionResult {
  workExperiences: RawWorkExperience[];
  education: RawEducation[];
  skills: string[]; // deduplicated across all experiences
  suggestedClusters: RawCluster[]; // up to 3, sorted by yearsExperience desc
}

// ─── JD extraction (raw LLM output) ─────────────────────────────────────────

export interface JDExtractionResult {
  title: string;
  function: string; // raw text — will be normalized
  specialization?: string; // e.g. "ITT-NET" — will be validated
  sector: string; // raw text — will be normalized
  jobType: string; // raw text — will be normalized
  minEducation: string; // raw text — will be normalized
  educationField: string;
  minExperience: number; // years
  requiredSkills: string[];
  preferredSkills: string[];
  description: string;
  location?: string;
  salaryRange?: string;
  applicationDeadline?: string; // ISO date or "2026-12-31"
  administrativeRequirements?: string[];
}

// ─── LLM call envelope ──────────────────────────────────────────────────────

export interface LLMResponse<T> {
  data: T;
  provider: 'gemini' | 'stub';
  tokensUsed?: number;
  durationMs: number;
}

export interface LLMError extends Error {
  code: 'PARSE_ERROR' | 'API_ERROR' | 'TIMEOUT' | 'VALIDATION_ERROR';
  rawResponse?: string;
}
