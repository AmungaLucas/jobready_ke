// ============================================================================
// app/api/admin/jobs/route.ts
// Create a new job posting. Admin-only.
// Per Section 5: supports 4 input methods:
//   - paste_text:  LLM extraction (Phase 2)
//   - upload_file: LLM extraction (Phase 2) — file text extracted client-side
//   - paste_json:  No LLM, structured JSON provided
//   - form:        No LLM, structured form fields
// After creating the job, automatically computes matches against ALL active
// candidates (deterministic, $0/match).
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { extractJd, validateJdExtraction } from '@/lib/llm/extract-jd';
import { scoreMatch, isFunctionMatch } from '@/lib/matching';
import {
  normalizeEducationLevel,
  normalizeJobFunction,
  normalizeSector,
  normalizeJobType,
  normalizeSkills,
  EducationLevel,
  JobFunction,
  Sector,
  JobType,
} from '@/lib/normalization';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const jobs = await db.job.findMany({
      where: includeInactive ? {} : { isActive: true, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      jobs: jobs.map((j) => ({
        ...j,
        requiredSkills: JSON.parse(j.requiredSkills),
        preferredSkills: j.preferredSkills ? JSON.parse(j.preferredSkills) : [],
        administrativeRequirements: j.administrativeRequirements
          ? JSON.parse(j.administrativeRequirements)
          : [],
      })),
    });
  } catch (error) {
    console.error('Admin list jobs error:', error);
    return NextResponse.json({ error: 'Failed to list jobs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { inputMethod } = body as { inputMethod: 'paste_text' | 'upload_file' | 'paste_json' | 'form' };

    if (!inputMethod) {
      return NextResponse.json({ error: 'inputMethod is required' }, { status: 400 });
    }

    let jobData: any;
    let llmProvider: 'gemini' | 'stub' | null = null;

    if (inputMethod === 'paste_text' || inputMethod === 'upload_file') {
      // ── LLM extraction path ──────────────────────────────────────────
      const rawText = body.rawText;
      if (!rawText || rawText.trim().length < 50) {
        return NextResponse.json(
          { error: 'JD text is too short (minimum 50 characters)' },
          { status: 400 },
        );
      }

      let extractionResult;
      try {
        extractionResult = await extractJd(rawText);
      } catch (err: any) {
        await db.parseFailure.create({
          data: {
            inputType: inputMethod === 'paste_text' ? 'job_paste_text' : 'job_upload_file',
            rawInput: rawText.slice(0, 10000),
            errorMessage: `${err.code ?? 'UNKNOWN'}: ${err.message}`,
          },
        });
        return NextResponse.json(
          {
            error: 'Could not parse the job description. Please try the form input method.',
            details: err.message,
          },
          { status: 422 },
        );
      }

      const errors = validateJdExtraction(extractionResult.data);
      if (errors.length > 0) {
        return NextResponse.json(
          { error: 'Extraction produced invalid data', errors },
          { status: 422 },
        );
      }

      jobData = extractionResult.data;
      llmProvider = extractionResult.provider;
    } else if (inputMethod === 'paste_json') {
      // ── Structured JSON path (no LLM) ────────────────────────────────
      jobData = body.job;
      if (!jobData) {
        return NextResponse.json({ error: 'job object is required for paste_json' }, { status: 400 });
      }
    } else if (inputMethod === 'form') {
      // ── Form path (no LLM) ───────────────────────────────────────────
      jobData = body;
    } else {
      return NextResponse.json(
        { error: `Invalid inputMethod: ${inputMethod}` },
        { status: 400 },
      );
    }

    // ── Normalize all enum fields with word-boundary matching ───────────
    const normalizedFunction = normalizeJobFunction(jobData.function);
    if (!normalizedFunction) {
      return NextResponse.json(
        { error: `Invalid function: ${jobData.function}` },
        { status: 400 },
      );
    }
    const normalizedSector = normalizeSector(jobData.sector);
    if (!normalizedSector) {
      return NextResponse.json(
        { error: `Invalid sector: ${jobData.sector}` },
        { status: 400 },
      );
    }
    const normalizedJobType = normalizeJobType(jobData.jobType);
    if (!normalizedJobType) {
      return NextResponse.json(
        { error: `Invalid jobType: ${jobData.jobType}` },
        { status: 400 },
      );
    }
    const normalizedMinEducation = normalizeEducationLevel(jobData.minEducation);
    if (!normalizedMinEducation) {
      return NextResponse.json(
        { error: `Invalid minEducation: ${jobData.minEducation}` },
        { status: 400 },
      );
    }

    const requiredSkills = normalizeSkills(jobData.requiredSkills ?? []);
    const preferredSkills = normalizeSkills(jobData.preferredSkills ?? []);
    const administrativeRequirements = jobData.administrativeRequirements ?? [];

    // ── Create the job ──────────────────────────────────────────────────
    const job = await db.job.create({
      data: {
        title: String(jobData.title).trim(),
        function: normalizedFunction as JobFunction,
        sector: normalizedSector as Sector,
        jobType: normalizedJobType as JobType,
        minEducation: normalizedMinEducation as EducationLevel,
        educationField: String(jobData.educationField).trim(),
        minExperience: parseInt(jobData.minExperience, 10) || 0,
        requiredSkills: JSON.stringify(requiredSkills),
        preferredSkills: preferredSkills.length ? JSON.stringify(preferredSkills) : null,
        description: String(jobData.description ?? '').trim(),
        location: jobData.location ? String(jobData.location).trim() : null,
        salaryRange: jobData.salaryRange ? String(jobData.salaryRange).trim() : null,
        applicationDeadline: jobData.applicationDeadline
          ? new Date(jobData.applicationDeadline)
          : null,
        administrativeRequirements: administrativeRequirements.length
          ? JSON.stringify(administrativeRequirements)
          : null,
        inputMethod,
        postedBy: session.user.id,
      },
    });

    // ── Auto-compute matches for the new job (deterministic, $0/match) ──
    const candidates = await db.candidate.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        clusters: { some: { isSelected: true } },
      },
      include: {
        education: true,
        clusters: { where: { isSelected: true } },
      },
    });

    let matchesCreated = 0;
    for (const candidate of candidates) {
      for (const cluster of candidate.clusters) {
        if (!isFunctionMatch(cluster.function as JobFunction, job.function as JobFunction)) {
          continue;
        }

        const breakdown = scoreMatch(
          {
            id: cluster.id,
            function: cluster.function as JobFunction,
            jobTitles: JSON.parse(cluster.jobTitles),
            skills: JSON.parse(cluster.skills),
            yearsExperience: cluster.yearsExperience,
          },
          {
            id: job.id,
            function: job.function as JobFunction,
            title: job.title,
            requiredSkills: JSON.parse(job.requiredSkills),
            preferredSkills: job.preferredSkills ? JSON.parse(job.preferredSkills) : [],
            minEducation: job.minEducation as EducationLevel,
            educationField: job.educationField,
            minExperience: job.minExperience,
          },
          candidate.education.map((e) => ({
            level: e.level as EducationLevel,
            field: e.field,
          })),
        );

        await db.jobMatch.create({
          data: {
            candidateId: candidate.id,
            jobId: job.id,
            matchedClusterId: cluster.id,
            totalScore: breakdown.totalScore,
            titleScore: breakdown.titleScore,
            skillsScore: breakdown.skillsScore,
            educationScore: breakdown.educationScore,
            fieldScore: breakdown.fieldScore,
            experienceScore: breakdown.experienceScore,
            explanations: JSON.stringify(breakdown.explanations),
            stale: false,
          },
        });
        matchesCreated++;
      }
    }

    return NextResponse.json({
      success: true,
      jobId: job.id,
      title: job.title,
      inputMethod,
      llmProvider, // null for form/paste_json, 'gemini'|'stub' for LLM methods
      matchesCreated,
      candidatesConsidered: candidates.length,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error('Create job error:', error);
    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 },
    );
  }
}
