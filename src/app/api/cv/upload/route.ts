// ============================================================================
// app/api/cv/upload/route.ts
// Candidate CV upload — Phase 2 data pipeline.
//
// Flow:
//   1. Accept input via two methods:
//      a) FormData (file upload) → server-side document parsing (PDF/DOCX/DOC/MD/JSON/TXT)
//      b) JSON body (text paste)  → raw text as-is
//   2. Call LLM (Gemini or stub) to extract structured data
//   3. Persist:
//      - raw CV text -> candidate_extras (type='raw_cv')
//      - LLM-extracted work experiences -> work_experience_clusters (up to 3)
//      - LLM-extracted education -> education_records
//   4. Mark all existing matches for this candidate as stale
//   5. Recompute matches against ALL active jobs (deterministic, $0/match)
//   6. Record cv_upload consent
//   7. On failure: write to parse_failures for later retry
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { extractCv } from '@/lib/llm/extract-cv';
import { scoreMatch, isFunctionMatch } from '@/lib/matching';
import {
  JobFunction,
  EducationLevel,
} from '@/lib/normalization';
import { ConsentType } from '@prisma/client';
import { parseDocument, ParseError, SUPPORTED_EXTENSIONS } from '@/lib/parsers/parse-document';

export const runtime = 'nodejs';
export const maxDuration = 60; // Vercel: allow up to 60s for LLM call
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Determine input method: FormData (file) vs JSON (text paste) ────
    const contentType = request.headers.get('content-type') ?? '';
    let rawText: string;
    let parseInfo: string | undefined;

    if (contentType.includes('multipart/form-data')) {
      // File upload path
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const consent = formData.get('consent');

      if (!file) {
        return NextResponse.json(
          { error: 'No file provided. Please select a file to upload.' },
          { status: 400 },
        );
      }
      if (!consent) {
        return NextResponse.json(
          { error: 'Consent to CV processing is required.' },
          { status: 400 },
        );
      }

      // Validate file extension
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!SUPPORTED_EXTENSIONS.has(ext)) {
        return NextResponse.json(
          {
            error: `Unsupported file format: .${ext}. Supported: PDF, DOCX, DOC, TXT, MD, JSON, CSV, RTF.`,
          },
          { status: 400 },
        );
      }

      // Parse the document server-side
      try {
        const parsed = await parseDocument(file, file.name);
        rawText = parsed.text;
        parseInfo = `${parsed.metadata.format} (${formatBytes(parsed.metadata.fileSize)}, ${parsed.metadata.pages ? parsed.metadata.pages + ' pages, ' : ''}${rawText.length} chars extracted)`;
      } catch (err) {
        if (err instanceof ParseError) {
          return NextResponse.json(
            { error: err.message, format: err.format },
            { status: 400 },
          );
        }
        throw err; // re-throw unexpected errors
      }
    } else {
      // JSON body (text paste path — original behaviour)
      const body = await request.json();
      const { rawText: text, consent } = body as { rawText?: string; consent?: boolean };

      if (!text || text.trim().length < 50) {
        return NextResponse.json(
          { error: 'CV text is too short. Please paste at least 50 characters.' },
          { status: 400 },
        );
      }
      if (!consent) {
        return NextResponse.json(
          { error: 'Consent to CV processing is required.' },
          { status: 400 },
        );
      }
      rawText = text;
    }

    // Find the candidate
    const candidate = await db.candidate.findFirst({
      where: { userId: session.user.id, isActive: true, deletedAt: null },
    });
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate profile not found' }, { status: 404 });
    }

    // ── Step 1: LLM extraction ───────────────────────────────────────────
    let extractionResult;
    try {
      extractionResult = await extractCv(rawText);
    } catch (err: any) {
      // Log to parse_failures for later retry / debugging
      await db.parseFailure.create({
        data: {
          inputType: 'cv',
          rawInput: rawText.slice(0, 10000),
          errorMessage: `${err.code ?? 'UNKNOWN'}: ${err.message}`,
        },
      });
      return NextResponse.json(
        {
          error: 'We could not parse your CV. Please try again with a clearer format.',
          details: err.message,
        },
        { status: 422 },
      );
    }

    const { data: extracted, provider, tokensUsed, durationMs } = extractionResult;

    // ── Step 2: Persist (transactional) ──────────────────────────────────
    await db.$transaction(async (tx) => {
      // Order matters: job_matches references clusters, so delete matches first.
      // All matches for this candidate will be recomputed in Step 3 below.
      await tx.jobMatch.deleteMany({ where: { candidateId: candidate.id } });

      // Replace raw CV (delete old, insert new)
      await tx.candidateExtra.deleteMany({
        where: { candidateId: candidate.id, type: 'raw_cv' },
      });
      await tx.candidateExtra.create({
        data: {
          candidateId: candidate.id,
          type: 'raw_cv',
          value: rawText,
        },
      });

      // Also store the LLM extraction result for audit/debugging
      await tx.candidateExtra.deleteMany({
        where: { candidateId: candidate.id, type: 'llm_extraction' },
      });
      await tx.candidateExtra.create({
        data: {
          candidateId: candidate.id,
          type: 'llm_extraction',
          value: JSON.stringify({ extracted, provider, tokensUsed, durationMs, extractedAt: new Date().toISOString() }),
        },
      });

      // Replace education records
      await tx.educationRecord.deleteMany({ where: { candidateId: candidate.id } });
      if (extracted.education.length > 0) {
        await tx.educationRecord.createMany({
          data: extracted.education.map((edu) => ({
            candidateId: candidate.id,
            level: edu.level as EducationLevel,
            field: edu.field,
            institution: edu.institution ?? null,
            graduationYear: edu.graduationYear ?? null,
          })),
        });
      }

      // Replace work experience clusters (up to 3, all marked as selected by default)
      await tx.workExperienceCluster.deleteMany({ where: { candidateId: candidate.id } });
      for (const cluster of extracted.suggestedClusters) {
        await tx.workExperienceCluster.create({
          data: {
            candidateId: candidate.id,
            function: cluster.function as JobFunction,
            jobTitles: JSON.stringify(cluster.jobTitles),
            skills: JSON.stringify(cluster.skills),
            yearsExperience: cluster.yearsExperience,
            isSelected: true,
            rawExperiences: JSON.stringify(
              extracted.workExperiences.filter((e) => e.function === cluster.function),
            ),
          },
        });
      }

      // Record cv_upload consent
      await tx.consentRecord.create({
        data: {
          userId: session.user.id,
          candidateId: candidate.id,
          consentType: ConsentType.cv_upload,
          consentVersion: '1.0',
          ipAddress: request.headers.get('x-forwarded-for') ?? null,
          userAgent: request.headers.get('user-agent') ?? null,
        },
      });
    });

    // ── Step 3: Recompute matches ────────────────────────────────────────
    // All matches were deleted in the transaction above; recreate them.
    const refreshedCandidate = await db.candidate.findUnique({
      where: { id: candidate.id },
      include: {
        education: true,
        clusters: { where: { isSelected: true } },
      },
    });
    if (!refreshedCandidate) {
      return NextResponse.json({ error: 'Candidate vanished mid-transaction' }, { status: 500 });
    }

    const jobs = await db.job.findMany({
      where: { isActive: true, deletedAt: null },
    });

    let matchesCreated = 0;

    for (const job of jobs) {
      for (const cluster of refreshedCandidate.clusters) {
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
          refreshedCandidate.education.map((e) => ({
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

    const response: Record<string, unknown> = {
      success: true,
      provider,
      extracted: {
        clusterCount: extracted.suggestedClusters.length,
        educationCount: extracted.education.length,
        skillsCount: extracted.skills.length,
        clusters: extracted.suggestedClusters.map((c) => ({
          function: c.function,
          jobTitles: c.jobTitles,
          yearsExperience: c.yearsExperience,
        })),
      },
      matches: {
        created: matchesCreated,
      },
      durationMs: Date.now() - startedAt,
    };

    // Include parse info if it was a file upload
    if (parseInfo) {
      response.parseInfo = parseInfo;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('CV upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process CV upload' },
      { status: 500 },
    );
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
