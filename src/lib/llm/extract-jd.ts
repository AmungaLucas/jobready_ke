// ============================================================================
// lib/llm/extract-jd.ts
// JD extraction pipeline:
//   1. Send JD text to LLM (Gemini or stub)
//   2. Parse + validate JSON response
//   3. Normalize all enum fields
//   4. Return a JDExtractionResult ready for DB persistence
// ============================================================================

import { generate } from './gemini-client';
import { JD_SYSTEM_PROMPT, buildJdUserPrompt } from './prompts/jd-prompt';
import { JDExtractionResult, LLMResponse, LLMError } from './types';
import {
  normalizeJobFunction,
  normalizeSector,
  normalizeJobType,
  normalizeEducationLevel,
  normalizeSkills,
  JobFunction,
  Sector,
  JobType,
  EducationLevel,
} from '@/lib/normalization';

// ─── Public API ─────────────────────────────────────────────────────────────

export async function extractJd(jdText: string): Promise<LLMResponse<JDExtractionResult>> {
  if (!jdText || jdText.trim().length < 50) {
    const err: LLMError = new Error('JD text too short (minimum 50 characters)') as LLMError;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const result = await generate({
    systemPrompt: JD_SYSTEM_PROMPT,
    userPrompt: buildJdUserPrompt(jdText),
    temperature: 0.1,
    maxOutputTokens: 4096,
    timeoutMs: 30_000,
  });

  let parsed: JDExtractionResult;
  try {
    parsed = JSON.parse(result.text);
  } catch (e) {
    const err: LLMError = new Error('LLM returned invalid JSON') as LLMError;
    err.code = 'PARSE_ERROR';
    err.rawResponse = result.text.slice(0, 2000);
    throw err;
  }

  const normalized = normalizeJdExtraction(parsed);

  return {
    data: normalized,
    provider: result.provider,
    tokensUsed: result.tokensUsed,
    durationMs: result.durationMs,
  };
}

// ─── Normalization ──────────────────────────────────────────────────────────

function normalizeJdExtraction(raw: JDExtractionResult): JDExtractionResult {
  const fn = normalizeFunctionOrFallback(raw.function, raw.title);
  const sector = normalizeSectorOrFallback(raw.sector, raw.title);
  const jobType = normalizeJobTypeOrFallback(raw.jobType);
  const minEducation = normalizeEducationOrFallback(raw.minEducation);

  return {
    title: String(raw.title ?? 'Untitled Role').trim().slice(0, 200),
    function: fn,
    sector,
    jobType,
    minEducation,
    educationField: String(raw.educationField ?? 'General').trim().slice(0, 100),
    minExperience: Math.max(0, Math.min(30, Number(raw.minExperience) || 0)),
    requiredSkills: normalizeSkills(raw.requiredSkills ?? []).slice(0, 20),
    preferredSkills: normalizeSkills(raw.preferredSkills ?? []).slice(0, 20),
    description: String(raw.description ?? '').trim().slice(0, 5000),
    location: raw.location ? String(raw.location).trim().slice(0, 200) : undefined,
    salaryRange: raw.salaryRange ? String(raw.salaryRange).trim().slice(0, 100) : undefined,
    applicationDeadline: raw.applicationDeadline ? normalizeDate(raw.applicationDeadline) : undefined,
    administrativeRequirements: raw.administrativeRequirements
      ? raw.administrativeRequirements.map((s) => String(s).trim()).filter(Boolean).slice(0, 10)
      : undefined,
  };
}

function normalizeFunctionOrFallback(rawFn: string, fallbackTitle: string): string {
  const normalized = normalizeJobFunction(rawFn);
  if (normalized) return normalized;
  const fromTitle = normalizeJobFunction(fallbackTitle);
  return fromTitle ?? 'operations';
}

function normalizeSectorOrFallback(rawSector: string, fallbackTitle: string): string {
  const normalized = normalizeSector(rawSector);
  if (normalized) return normalized;
  // Common mappings: if function is finance, default sector to financial_services
  const fn = normalizeJobFunction(fallbackTitle);
  if (fn === 'finance') return 'financial_services';
  if (fn === 'technology') return 'technology';
  if (fn === 'healthcare') return 'healthcare';
  if (fn === 'education') return 'education';
  return 'technology';
}

function normalizeJobTypeOrFallback(rawJobType: string): string {
  const normalized = normalizeJobType(rawJobType);
  return normalized ?? 'full_time';
}

function normalizeEducationOrFallback(rawLevel: string): string {
  const normalized = normalizeEducationLevel(rawLevel);
  return normalized ?? 'bachelors';
}

function normalizeDate(input: string): string | undefined {
  // Try to parse to ISO date
  const d = new Date(input);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  }
  // Return as-is if it looks like a date
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  return undefined;
}

// ─── Validation ─────────────────────────────────────────────────────────────

export function validateJdExtraction(jd: JDExtractionResult): string[] {
  const errors: string[] = [];
  if (!jd.title) errors.push('title is required');
  if (!jd.function) errors.push('function is required');
  if (!jd.sector) errors.push('sector is required');
  if (!jd.educationField) errors.push('educationField is required');
  return errors;
}
