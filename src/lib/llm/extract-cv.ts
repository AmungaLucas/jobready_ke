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
import { resolveSpecialization, isValidSpecialization } from '@/lib/taxonomy';

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
      specialization: normalizeSpecialization(exp.specialization, exp.function),
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
  // Return the raw value lowercased — let cluster builder handle unknown functions
  return rawFn.toLowerCase().replace(/\s+/g, '_') || 'adm';
}

function normalizeSpecialization(rawSpec: string | undefined, rawFn: string): string | undefined {
  if (!rawSpec) return undefined;
  const normalizedFn = normalizeJobFunction(rawFn);
  if (!normalizedFn) return undefined;

  const resolved = resolveSpecialization(rawSpec, normalizedFn);
  return resolved ?? undefined;
}

function normalizeEducationOrFallback(rawLevel: string): string {
  const normalized = normalizeEducationLevel(rawLevel);
  if (normalized) return normalized;
  return 'bachelors'; // sensible default
}

// ─── Cluster builder ────────────────────────────────────────────────────────

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

    const spec = normalizeSpecialization(s.specialization, fn);
    const key = spec ? `${fn}:${spec}` : fn;
    const existing = clusterMap.get(key);

    if (existing) {
      existing.jobTitles = Array.from(new Set([...existing.jobTitles, ...s.jobTitles]));
      existing.skills = Array.from(new Set([...existing.skills, ...normalizeSkills(s.skills ?? [])]));
      existing.yearsExperience = Math.max(existing.yearsExperience, s.yearsExperience || 0);
    } else {
      clusterMap.set(key, {
        function: fn,
        specialization: spec,
        jobTitles: Array.from(new Set(s.jobTitles ?? [])),
        skills: normalizeSkills(s.skills ?? []),
        yearsExperience: Math.max(0, Math.min(50, Number(s.yearsExperience) || 0)),
      });
    }
  }

  // Merge in skills/years from actual work experiences
  for (const exp of workExperiences) {
    const fn = exp.function as JobFunction;
    const spec = exp.specialization;
    const key = spec ? `${fn}:${spec}` : fn;
    const cluster = clusterMap.get(key) ?? {
      function: fn,
      specialization: spec,
      jobTitles: [],
      skills: [],
      yearsExperience: 0,
    };
    if (exp.jobTitle) cluster.jobTitles.push(exp.jobTitle);
    cluster.skills = Array.from(new Set([...cluster.skills, ...exp.skills]));
    cluster.yearsExperience = Math.max(cluster.yearsExperience, exp.yearsExperience);
    clusterMap.set(key, cluster);
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
    skills: Array.from(new Set(c.skills)).slice(0, 25),
  }));
}
