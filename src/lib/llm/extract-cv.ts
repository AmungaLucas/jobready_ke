// ============================================================================
// lib/llm/extract-cv.ts
// CV extraction pipeline:
//   1. Send CV text to LLM (Gemini or stub)
//   2. Parse + validate the JSON response
//   3. Normalize all enum fields using word-boundary matching
//   4. Build up to 3 career-trajectory clusters
//   5. Return a CVExtractionResult ready for DB persistence
// ============================================================================

import { generate, getProvider } from './gemini-client';
import { CV_SYSTEM_PROMPT, buildCvUserPrompt } from './prompts/cv-prompt';
import {
  CVExtractionResult,
  RawWorkExperience,
  RawEducation,
  RawCluster,
  LLMResponse,
  LLMError,
} from './types';
import {
  normalizeJobFunction,
  normalizeEducationLevel,
  normalizeSkills,
  JobFunction,
  EducationLevel,
} from '@/lib/normalization';

// ─── Public API ─────────────────────────────────────────────────────────────

export async function extractCv(cvText: string): Promise<LLMResponse<CVExtractionResult>> {
  if (!cvText || cvText.trim().length < 50) {
    const err: LLMError = new Error('CV text too short (minimum 50 characters)') as LLMError;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const userPrompt = buildCvUserPrompt(cvText);
  const result = await generate({
    systemPrompt: CV_SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.1,
    maxOutputTokens: 8192,
    timeoutMs: 45_000,
  });

  let parsed: CVExtractionResult;
  try {
    parsed = JSON.parse(result.text);
  } catch (e) {
    const err: LLMError = new Error('LLM returned invalid JSON') as LLMError;
    err.code = 'PARSE_ERROR';
    err.rawResponse = result.text.slice(0, 2000);
    throw err;
  }

  // Validate + normalize
  const normalized = normalizeCvExtraction(parsed);

  return {
    data: normalized,
    provider: result.provider,
    tokensUsed: result.tokensUsed,
    durationMs: result.durationMs,
  };
}

// ─── Normalization ──────────────────────────────────────────────────────────

function normalizeCvExtraction(raw: CVExtractionResult): CVExtractionResult {
  // Normalize work experiences
  const workExperiences: RawWorkExperience[] = (raw.workExperiences ?? [])
    .map((exp) => ({
      jobTitle: String(exp.jobTitle ?? '').trim(),
      company: exp.company ? String(exp.company).trim() : undefined,
      startDate: exp.startDate,
      endDate: exp.endDate,
      yearsExperience: Math.max(0, Math.min(50, Number(exp.yearsExperience) || 0)),
      description: exp.description ? String(exp.description).trim() : undefined,
      function: normalizeFunctionOrFallback(exp.function, exp.jobTitle),
      skills: normalizeSkills(exp.skills ?? []),
    }))
    .filter((exp) => exp.jobTitle || exp.skills.length > 0);

  // Normalize education
  const education: RawEducation[] = (raw.education ?? [])
    .map((edu) => ({
      level: normalizeEducationOrFallback(edu.level),
      field: String(edu.field ?? 'General').trim(),
      institution: edu.institution ? String(edu.institution).trim() : undefined,
      graduationYear: edu.graduationYear
        ? Math.max(1960, Math.min(new Date().getFullYear(), Number(edu.graduationYear)))
        : undefined,
    }))
    .filter((edu) => edu.level && edu.field);

  // Deduplicate skills across all experiences
  const allSkills = normalizeSkills([
    ...(raw.skills ?? []),
    ...workExperiences.flatMap((e) => e.skills),
  ]);

  // Normalize + cap suggestedClusters at 3
  const suggestedClusters = buildClusters(raw.suggestedClusters, workExperiences, allSkills);

  return {
    workExperiences,
    education,
    skills: allSkills,
    suggestedClusters,
  };
}

function normalizeFunctionOrFallback(rawFn: string, fallbackTitle: string): string {
  const normalized = normalizeJobFunction(rawFn);
  if (normalized) return normalized;
  // Try the title as a fallback
  const fromTitle = normalizeJobFunction(fallbackTitle);
  if (fromTitle) return fromTitle;
  // Return the raw value lowercased as a last resort — do NOT silently
  // map everything to 'operations' as that corrupts the extraction data.
  // The cluster builder will handle unknown functions by skipping them.
  return rawFn.toLowerCase().replace(/\s+/g, '_') || 'operations';
}

function normalizeEducationOrFallback(rawLevel: string): string {
  const normalized = normalizeEducationLevel(rawLevel);
  if (normalized) return normalized;
  return 'bachelors'; // sensible default
}

// ─── Cluster builder ────────────────────────────────────────────────────────
//
// The LLM suggests clusters, but we enforce the up-to-3 limit and sort by
// yearsExperience descending. We also merge skills from all experiences that
// belong to each cluster's function.

function buildClusters(
  suggested: RawCluster[] | undefined,
  workExperiences: RawWorkExperience[],
  allSkills: string[],
): RawCluster[] {
  const clusterMap = new Map<string, RawCluster>();

  // First: use the LLM's suggestions as a base
  for (const s of suggested ?? []) {
    const fn = normalizeFunctionOrFallback(s.function, '');
    if (!fn) continue;
    const existing = clusterMap.get(fn);
    if (existing) {
      existing.jobTitles = Array.from(new Set([...existing.jobTitles, ...s.jobTitles]));
      existing.skills = Array.from(new Set([...existing.skills, ...normalizeSkills(s.skills ?? [])]));
      existing.yearsExperience = Math.max(existing.yearsExperience, s.yearsExperience || 0);
    } else {
      clusterMap.set(fn, {
        function: fn,
        jobTitles: Array.from(new Set(s.jobTitles ?? [])),
        skills: normalizeSkills(s.skills ?? []),
        yearsExperience: Math.max(0, Math.min(50, Number(s.yearsExperience) || 0)),
      });
    }
  }

  // Merge in skills/years from actual work experiences (in case LLM missed)
  for (const exp of workExperiences) {
    const fn = exp.function as JobFunction;
    const cluster = clusterMap.get(fn) ?? {
      function: fn,
      jobTitles: [],
      skills: [],
      yearsExperience: 0,
    };
    if (exp.jobTitle) cluster.jobTitles.push(exp.jobTitle);
    cluster.skills = Array.from(new Set([...cluster.skills, ...exp.skills]));
    cluster.yearsExperience = Math.max(cluster.yearsExperience, exp.yearsExperience);
    clusterMap.set(fn, cluster);
  }

  // Sort by yearsExperience desc, take top 3
  const clusters = Array.from(clusterMap.values())
    .filter((c) => c.jobTitles.length > 0 || c.skills.length > 0)
    .sort((a, b) => b.yearsExperience - a.yearsExperience)
    .slice(0, 3);

  // Deduplicate job titles and skills within each cluster
  return clusters.map((c) => ({
    ...c,
    jobTitles: Array.from(new Set(c.jobTitles)).slice(0, 8),
    skills: Array.from(new Set(c.skills)).slice(0, 20),
  }));
}
