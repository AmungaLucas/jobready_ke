// ============================================================================
// lib/matching.ts
// Scoring algorithm (Section 6 of v4.0 doc)
// Max 100 points across 5 dimensions:
//   - Job Title match:    40 pts
//   - Skills match:       35 pts
//   - Education Level:    15 pts
//   - Education Field:     5 pts
//   - Experience Years:   10 pts
// Function match is a hard requirement (filter, not scored).
// Missing data never disqualifies — it just scores 0 for that dimension.
// ============================================================================

import {
  EducationLevel,
  JobFunction,
  compareEducationLevels,
  educationLevelIndex,
  EDUCATION_ORDER,
} from './normalization';
import { scoreFieldRelatedness } from './field-mapping';

// Score weights (must sum to 100)
export const SCORE_WEIGHTS = {
  TITLE: 40,
  SKILLS: 35,
  EDUCATION_LEVEL: 15,
  EDUCATION_FIELD: 5,
  EXPERIENCE: 10,
} as const;

export interface ClusterForScoring {
  id: string;
  function: JobFunction;
  jobTitles: string[];     // e.g. ["Accountant", "Senior Accountant"]
  skills: string[];        // normalized lowercase
  yearsExperience: number;
}

export interface JobForScoring {
  id: string;
  function: JobFunction;
  title: string;
  requiredSkills: string[];   // normalized lowercase
  preferredSkills?: string[];
  minEducation: EducationLevel;
  educationField: string;
  minExperience: number;      // years
}

export interface EducationForScoring {
  level: EducationLevel;
  field: string;
}

export interface ScoreBreakdown {
  totalScore: number;
  titleScore: number;
  skillsScore: number;
  educationScore: number;
  fieldScore: number;
  experienceScore: number;
  explanations: MatchExplanation[];
}

export type MatchExplanation =
  | 'exact_function_match'
  | 'strong_skill_overlap'
  | 'education_meets_minimum'
  | 'education_field_related'
  | 'experience_meets_minimum'
  | 'title_keyword_overlap';

// ============================================================================
// Title scoring (max 40 pts)
// Word-boundary keyword overlap between cluster titles and job title
// ============================================================================

export function scoreTitle(clusterTitles: string[], jobTitle: string): {
  score: number;
  matched: boolean;
} {
  if (!clusterTitles.length || !jobTitle) {
    return { score: 0, matched: false };
  }

  // Extract significant words from the job title (length > 2, no stopwords)
  const STOPWORDS = new Set([
    'and', 'the', 'for', 'with', 'junior', 'senior', 'lead', 'principal',
    'chief', 'head', 'of', 'in', 'to', 'a', 'an',
  ]);

  const jobWords = new Set(
    jobTitle
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^\w]/g, ''))
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );

  if (jobWords.size === 0) {
    return { score: 0, matched: false };
  }

  let bestScore = 0;
  let matched = false;

  for (const clusterTitle of clusterTitles) {
    const clusterWords = clusterTitle
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^\w]/g, ''))
      .filter((w) => w.length > 2 && !STOPWORDS.has(w));

    if (clusterWords.length === 0) continue;

    // Count overlapping words
    const clusterWordSet = new Set(clusterWords);
    let overlap = 0;
    for (const word of jobWords) {
      if (clusterWordSet.has(word)) overlap++;
    }

    if (overlap > 0) {
      matched = true;
      // Score is overlap ratio * max weight
      const ratio = overlap / Math.max(jobWords.size, clusterWordSet.size);
      const score = Math.round(ratio * SCORE_WEIGHTS.TITLE);
      bestScore = Math.max(bestScore, score);
    }
  }

  return { score: bestScore, matched };
}

// ============================================================================
// Skills scoring (max 35 pts)
// Weighted by overlap count, with required skills weighted more than preferred
// ============================================================================

export function scoreSkills(
  clusterSkills: string[],
  requiredSkills: string[],
  preferredSkills: string[] = [],
): { score: number; overlapCount: number; isStrong: boolean } {
  if (!clusterSkills.length || (!requiredSkills.length && !preferredSkills.length)) {
    return { score: 0, overlapCount: 0, isStrong: false };
  }

  const candidateSkillSet = new Set(clusterSkills.map((s) => s.toLowerCase().trim()));

  let requiredOverlap = 0;
  let preferredOverlap = 0;

  for (const skill of requiredSkills) {
    const s = skill.toLowerCase().trim();
    if (candidateSkillSet.has(s)) requiredOverlap++;
  }
  for (const skill of preferredSkills) {
    const s = skill.toLowerCase().trim();
    if (candidateSkillSet.has(s)) preferredOverlap++;
  }

  // Required skills weighted 2x preferred
  const totalRequired = requiredSkills.length || 1;
  const totalPreferred = preferredSkills.length || 1;
  const requiredRatio = requiredOverlap / totalRequired;
  const preferredRatio = preferredOverlap / totalPreferred;

  // Composite: 70% weight on required, 30% on preferred
  const composite = 0.7 * requiredRatio + 0.3 * preferredRatio;
  const score = Math.round(Math.min(1, composite) * SCORE_WEIGHTS.SKILLS);

  const totalOverlap = requiredOverlap + preferredOverlap;
  // "Strong" overlap = at least 50% of required skills match
  const isStrong = requiredSkills.length > 0 && requiredOverlap / requiredSkills.length >= 0.5;

  return {
    score,
    overlapCount: totalOverlap,
    isStrong,
  };
}

// ============================================================================
// Education level scoring (max 15 pts)
// Sliding scale based on candidate's highest level vs job's minimum
// ============================================================================

export function scoreEducationLevel(
  candidateHighestLevel: EducationLevel | null,
  jobMinimum: EducationLevel,
): { score: number; meetsMinimum: boolean } {
  if (!candidateHighestLevel) {
    return { score: 0, meetsMinimum: false };
  }

  const diff = compareEducationLevels(candidateHighestLevel, jobMinimum);

  // meetsMinimum = candidate level >= job minimum
  const meetsMinimum = diff >= 0;

  let score: number;
  if (diff >= 2) score = 15;        // Exceeds by 2+ levels
  else if (diff === 1) score = 13;  // Exceeds by 1 level
  else if (diff === 0) score = 12;  // Exactly meets minimum
  else if (diff === -1) score = 6;  // One level below
  else if (diff === -2) score = 2;  // Two levels below
  else score = 0;                   // Three or more below

  return { score, meetsMinimum };
}

// ============================================================================
// Education field scoring (max 5 pts)
// Delegates to field-mapping.ts 3-tier matching
// ============================================================================

export function scoreEducationField(
  candidateField: string | null,
  jobField: string,
): { score: number; isRelated: boolean } {
  if (!candidateField) {
    return { score: 0, isRelated: false };
  }
  const score = scoreFieldRelatedness(candidateField, jobField);
  return { score, isRelated: score > 0 };
}

// ============================================================================
// Experience scoring (max 10 pts)
// Sliding scale: ratio of candidate years to job minimum
// ============================================================================

export function scoreExperience(
  candidateYears: number,
  jobMinimum: number,
): { score: number; meetsMinimum: boolean } {
  if (candidateYears <= 0 || jobMinimum <= 0) {
    // If job has no minimum, full credit
    if (jobMinimum <= 0) return { score: 10, meetsMinimum: true };
    return { score: 0, meetsMinimum: false };
  }

  const ratio = candidateYears / jobMinimum;
  const meetsMinimum = ratio >= 1;

  let score: number;
  if (ratio >= 1) score = 10;
  else if (ratio >= 0.75) score = 7;
  else if (ratio >= 0.5) score = 4;
  else if (ratio >= 0.25) score = 2;
  else score = 0;

  return { score, meetsMinimum };
}

// ============================================================================
// Main scoring function
// Combines all dimensions and produces a ScoreBreakdown
// ============================================================================

export function scoreMatch(
  cluster: ClusterForScoring,
  job: JobForScoring,
  candidateEducation: EducationForScoring[],  // array per Section 3.1
): ScoreBreakdown {
  const explanations: MatchExplanation[] = ['exact_function_match'];

  // 1. Title score
  const title = scoreTitle(cluster.jobTitles, job.title);
  if (title.matched) explanations.push('title_keyword_overlap');

  // 2. Skills score
  const skills = scoreSkills(cluster.skills, job.requiredSkills, job.preferredSkills);
  if (skills.isStrong) explanations.push('strong_skill_overlap');

  // 3. Education level — use candidate's HIGHEST level
  const highestLevel = candidateEducation.reduce<EducationLevel | null>((highest, edu) => {
    if (!highest) return edu.level;
    return educationLevelIndex(edu.level) > educationLevelIndex(highest) ? edu.level : highest;
  }, null);
  const eduLevel = scoreEducationLevel(highestLevel, job.minEducation);
  if (eduLevel.meetsMinimum) explanations.push('education_meets_minimum');

  // 4. Education field — check if ANY candidate education field is related to job field
  let bestFieldScore = 0;
  let fieldIsRelated = false;
  for (const edu of candidateEducation) {
    const fieldResult = scoreEducationField(edu.field, job.educationField);
    if (fieldResult.score > bestFieldScore) {
      bestFieldScore = fieldResult.score;
      fieldIsRelated = fieldResult.isRelated;
    }
  }
  if (fieldIsRelated) explanations.push('education_field_related');

  // 5. Experience score
  const experience = scoreExperience(cluster.yearsExperience, job.minExperience);
  if (experience.meetsMinimum) explanations.push('experience_meets_minimum');

  // Sum (max 100)
  const totalScore = Math.min(
    100,
    title.score + skills.score + eduLevel.score + bestFieldScore + experience.score,
  );

  return {
    totalScore,
    titleScore: title.score,
    skillsScore: skills.score,
    educationScore: eduLevel.score,
    fieldScore: bestFieldScore,
    experienceScore: experience.score,
    explanations,
  };
}

// ============================================================================
// Function filter check (hard requirement, not scored)
// ============================================================================

/**
 * Returns true if the cluster's function matches the job's function.
 * This is a hard filter — non-matching clusters are excluded from scoring entirely.
 */
export function isFunctionMatch(
  clusterFunction: JobFunction,
  jobFunction: JobFunction,
): boolean {
  return clusterFunction === jobFunction;
}
