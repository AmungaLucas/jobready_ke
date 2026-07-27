// ============================================================================
// lib/matching.ts
// Scoring algorithm v2.0 — Career Family + Specialization architecture
//
// Raw scores sum to 135, normalized to 100:
//   - Title match:            45 pts (raw)
//   - Skills match:           40 pts (raw)
//   - Specialization match:   20 pts (raw)
//   - Family match:          10 pts (raw)
//   - Education Level:        10 pts (raw)
//   - Experience Years:       10 pts (raw)
//
// Function (Career Family) is NO LONGER a hard filter.
// Matching now cross-references all candidate clusters against all jobs.
// Specialization bonus provides precise matching within the same family.
// ============================================================================

import {
  EducationLevel,
  JobFunction,
  compareEducationLevels,
  educationLevelIndex,
  EDUCATION_ORDER,
} from './normalization';
import { scoreFieldRelatedness } from './field-mapping';
import { isValidSpecialization, getSpecializationsForFamily } from './taxonomy';

// Raw score weights (sum = 135, normalized to 100)
export const SCORE_WEIGHTS = {
  TITLE: 45,
  SKILLS: 40,
  SPECIALIZATION: 20,
  FAMILY: 10,
  EDUCATION_LEVEL: 10,
  EXPERIENCE: 10,
} as const;

const RAW_TOTAL = 135; // sum of all weights

export interface ClusterForScoring {
  id: string;
  function: JobFunction;
  specialization?: string | null;
  jobTitles: string[];     // e.g. ["Accountant", "Senior Accountant"]
  skills: string[];        // normalized lowercase
  yearsExperience: number;
}

export interface JobForScoring {
  id: string;
  function: JobFunction;
  specialization?: string | null;
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
  specializationScore: number;
  familyScore: number;
  educationScore: number;
  experienceScore: number;
  explanations: MatchExplanation[];
}

export type MatchExplanation =
  | 'exact_function_match'
  | 'strong_skill_overlap'
  | 'specialization_match'
  | 'education_meets_minimum'
  | 'education_field_related'
  | 'experience_meets_minimum'
  | 'title_keyword_overlap';

// ============================================================================
// Title scoring (max 45 pts raw)
// Word-boundary keyword overlap between cluster titles and job title
// ============================================================================

export function scoreTitle(clusterTitles: string[], jobTitle: string): {
  score: number;
  matched: boolean;
} {
  if (!clusterTitles.length || !jobTitle) {
    return { score: 0, matched: false };
  }

  const STOPWORDS = new Set([
    'and', 'the', 'for', 'with', 'junior', 'senior', 'lead', 'principal',
    'chief', 'head', 'of', 'in', 'to', 'a', 'an', 'at', 'i', 'ii', 'iii',
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

    const clusterWordSet = new Set(clusterWords);
    let overlap = 0;
    for (const word of jobWords) {
      if (clusterWordSet.has(word)) overlap++;
    }

    if (overlap > 0) {
      matched = true;
      const ratio = overlap / Math.max(jobWords.size, clusterWordSet.size);
      const score = Math.round(ratio * SCORE_WEIGHTS.TITLE);
      bestScore = Math.max(bestScore, score);
    }
  }

  return { score: bestScore, matched };
}

// ============================================================================
// Skills scoring (max 40 pts raw)
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

  const totalRequired = requiredSkills.length || 1;
  const totalPreferred = preferredSkills.length || 1;
  const requiredRatio = requiredOverlap / totalRequired;
  const preferredRatio = preferredOverlap / totalPreferred;

  const composite = 0.7 * requiredRatio + 0.3 * preferredRatio;
  const score = Math.round(Math.min(1, composite) * SCORE_WEIGHTS.SKILLS);

  const totalOverlap = requiredOverlap + preferredOverlap;
  const isStrong = requiredSkills.length > 0 && requiredOverlap / requiredSkills.length >= 0.5;

  return {
    score,
    overlapCount: totalOverlap,
    isStrong,
  };
}

// ============================================================================
// Specialization scoring (max 20 pts raw)
// Direct code match between candidate specialization and job specialization
// ============================================================================

export function scoreSpecialization(
  clusterSpec: string | null | undefined,
  jobSpec: string | null | undefined,
  clusterFamily: JobFunction,
  jobFamily: JobFunction,
): { score: number; matched: boolean } {
  if (!clusterSpec || !jobSpec) {
    return { score: 0, matched: false };
  }

  // Exact specialization code match (highest signal)
  if (clusterSpec.toUpperCase() === jobSpec.toUpperCase()) {
    return { score: SCORE_WEIGHTS.SPECIALIZATION, matched: true };
  }

  // Validate specializations belong to their respective families
  const clusterValid = isValidSpecialization(clusterSpec.toUpperCase(), clusterFamily);
  const jobValid = isValidSpecialization(jobSpec.toUpperCase(), jobFamily);

  if (!clusterValid || !jobValid) {
    return { score: 0, matched: false };
  }

  return { score: 0, matched: false };
}

// ============================================================================
// Family scoring (max 10 pts raw)
// Simple binary: same family = full points, different = 0
// ============================================================================

export function scoreFamily(
  clusterFamily: JobFunction,
  jobFamily: JobFunction,
): { score: number; matched: boolean } {
  const matched = clusterFamily === jobFamily;
  return { score: matched ? SCORE_WEIGHTS.FAMILY : 0, matched };
}

// ============================================================================
// Education level scoring (max 10 pts raw)
// ============================================================================

export function scoreEducationLevel(
  candidateHighestLevel: EducationLevel | null,
  jobMinimum: EducationLevel,
): { score: number; meetsMinimum: boolean } {
  if (!candidateHighestLevel) {
    return { score: 0, meetsMinimum: false };
  }

  const diff = compareEducationLevels(candidateHighestLevel, jobMinimum);
  const meetsMinimum = diff >= 0;

  let score: number;
  if (diff >= 2) score = 10;
  else if (diff === 1) score = 9;
  else if (diff === 0) score = 8;
  else if (diff === -1) score = 4;
  else if (diff === -2) score = 1;
  else score = 0;

  return { score, meetsMinimum };
}

// ============================================================================
// Experience scoring (max 10 pts raw)
// ============================================================================

export function scoreExperience(
  candidateYears: number,
  jobMinimum: number,
): { score: number; meetsMinimum: boolean } {
  if (candidateYears <= 0 || jobMinimum <= 0) {
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
// Combines all dimensions and normalizes to 0-100
// ============================================================================

export function scoreMatch(
  cluster: ClusterForScoring,
  job: JobForScoring,
  candidateEducation: EducationForScoring[],
): ScoreBreakdown {
  const explanations: MatchExplanation[] = [];

  // 1. Title score
  const title = scoreTitle(cluster.jobTitles, job.title);
  if (title.matched) explanations.push('title_keyword_overlap');

  // 2. Skills score
  const skills = scoreSkills(cluster.skills, job.requiredSkills, job.preferredSkills);
  if (skills.isStrong) explanations.push('strong_skill_overlap');

  // 3. Specialization score
  const spec = scoreSpecialization(
    cluster.specialization,
    job.specialization,
    cluster.function,
    job.function,
  );
  if (spec.matched) explanations.push('specialization_match');

  // 4. Family score
  const family = scoreFamily(cluster.function, job.function);
  if (family.matched) explanations.push('exact_function_match');

  // 5. Education level
  const highestLevel = candidateEducation.reduce<EducationLevel | null>((highest, edu) => {
    if (!highest) return edu.level;
    return educationLevelIndex(edu.level) > educationLevelIndex(highest) ? edu.level : highest;
  }, null);
  const eduLevel = scoreEducationLevel(highestLevel, job.minEducation);
  if (eduLevel.meetsMinimum) explanations.push('education_meets_minimum');

  // 6. Experience score
  const experience = scoreExperience(cluster.yearsExperience, job.minExperience);
  if (experience.meetsMinimum) explanations.push('experience_meets_minimum');

  // Sum raw scores and normalize to 0-100
  const rawTotal = title.score + skills.score + spec.score + family.score + eduLevel.score + experience.score;
  const totalScore = Math.min(100, Math.round((rawTotal / RAW_TOTAL) * 100));

  return {
    totalScore,
    titleScore: Math.round((title.score / RAW_TOTAL) * 100),
    skillsScore: Math.round((skills.score / RAW_TOTAL) * 100),
    specializationScore: Math.round((spec.score / RAW_TOTAL) * 100),
    familyScore: Math.round((family.score / RAW_TOTAL) * 100),
    educationScore: Math.round((eduLevel.score / RAW_TOTAL) * 100),
    experienceScore: Math.round((experience.score / RAW_TOTAL) * 100),
    explanations,
  };
}

// ============================================================================
// No more hard function filter — all clusters score against all jobs
// ============================================================================

/**
 * Returns true if a match is worth persisting (score > 0).
 * With the new architecture, ALL clusters are scored against ALL jobs.
 * The specialization and family bonuses differentiate good matches from noise.
 */
export function isMatchWorthSaving(
  cluster: ClusterForScoring,
  job: JobForScoring,
): boolean {
  // Quick pre-filter: same family OR overlapping titles → score
  if (cluster.function === job.function) return true;

  // Check for title overlap
  const titleResult = scoreTitle(cluster.jobTitles, job.title);
  if (titleResult.matched) return true;

  // Check for skill overlap (at least 2 required skills)
  const skillResult = scoreSkills(cluster.skills, job.requiredSkills);
  if (skillResult.overlapCount >= 2) return true;

  return false;
}
