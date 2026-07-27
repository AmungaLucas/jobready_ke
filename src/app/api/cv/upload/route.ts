// ============================================================================
// app/api/cv/upload/route.ts
// CV upload endpoint — the heart of Phase 3's data pipeline.
//
// Accepts:
//   - FormData with 'file' (PDF/DOCX/DOC/MD/TXT/JSON/CSV/RTF/PPTX/XLSX/HTML)
//   - JSON body with 'rawText' (paste)
//
// Pipeline:
//   1. Parse document → plain text (via Python MarkItDown serverless function)
//   2. Send text to LLM (Gemini or stub) → structured CV extraction
//   3. Normalize all enum fields (function, education level, skills)
//   4. Build up to 3 career-trajectory clusters
//   5. Persist: raw CV text (extras), education records, clusters
//   6. Auto-compute matches against all active jobs
//   7. Return extraction summary + match count
//
// "Extract Once, Compute Many" — LLM runs only at upload time.
// Matching is deterministic DB queries (zero cost).
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { extractCv } from '@/lib/llm/extract-cv';
import { parseDocument, ParseError, SUPPORTED_EXTENSIONS } from '@/lib/parsers/parse-document';
import { scoreMatch, isFunctionMatch } from '@/lib/matching';
import {
  EducationLevel,
  JobFunction,
} from '@/lib/normalization';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    // ── 1. Auth check ─────────────────────────────────────────────────────
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── 2. Get or create candidate profile ───────────────────────────────
    let candidate = await db.candidate.findFirst({
      where: { userId: session.user.id, deletedAt: null },
      include: { education: true, clusters: true, extras: true },
    });

    if (!candidate) {
      // Auto-create candidate profile on first upload
      candidate = await db.candidate.create({
        data: {
          userId: session.user.id,
          fullName: session.user.name ?? 'Candidate',
          consentVersion: '1.0',
          consentDate: new Date(),
        },
        include: { education: true, clusters: true, extras: true },
      });
    }

    // ── 3. Parse document (file upload or text paste) ────────────────────
    const contentType = request.headers.get('content-type') ?? '';
    let rawText: string;
    let parseInfo: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      // File upload path
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const consentStr = formData.get('consent') as string | null;

      if (!file) {
        return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
      }
      if (consentStr !== 'true') {
        return NextResponse.json(
          { error: 'Consent required to process your CV.' },
          { status: 400 },
        );
      }

      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!SUPPORTED_EXTENSIONS.has(ext)) {
        return NextResponse.json(
          { error: `Unsupported format: .${ext}` },
          { status: 400 },
        );
      }

      try {
        const parsed = await parseDocument(file, file.name);
        rawText = parsed.text;
        parseInfo = `Parsed ${parsed.metadata.format} file (${parsed.metadata.fileSize} bytes)`;
      } catch (err) {
        if (err instanceof ParseError) {
          return NextResponse.json({ error: err.message }, { status: 400 });
        }
        throw err;
      }
    } else {
      // Text paste path
      const body = await request.json();
      rawText = body.rawText;
      const consent = body.consent;

      if (!consent) {
        return NextResponse.json(
          { error: 'Consent required to process your CV.' },
          { status: 400 },
        );
      }
      if (!rawText || rawText.trim().length < 50) {
        return NextResponse.json(
          { error: 'CV text is too short. Please provide at least 50 characters.' },
          { status: 400 },
        );
      }
      parseInfo = 'Parsed from pasted text';
    }

    // ── 4. LLM extraction ──────────────────────────────────────────────
    let extractionResult;
    try {
      extractionResult = await extractCv(rawText);
    } catch (err: any) {
      // Log the failure for manual review
      await db.parseFailure.create({
        data: {
          inputType: 'cv',
          rawInput: rawText.slice(0, 10000),
          errorMessage: `${err.code ?? 'UNKNOWN'}: ${err.message}`,
        },
      });
      return NextResponse.json(
        {
          error: 'Could not extract structured data from your CV. Please try pasting your CV as plain text, or upload a different file.',
          details: err.message,
          code: err.code,
        },
        { status: 422 },
      );
    }

    const extracted = extractionResult.data;

    // ── 5. Persist: raw CV text (as CandidateExtra) ──────────────────────
    // Upsert the raw_cv extra (one per candidate)
    const existingRawCv = candidate.extras.find((e) => e.type === 'raw_cv');
    if (existingRawCv) {
      await db.candidateExtra.update({
        where: { id: existingRawCv.id },
        data: { value: rawText },
      });
    } else {
      await db.candidateExtra.create({
        data: {
          candidateId: candidate.id,
          type: 'raw_cv',
          value: rawText,
        },
      });
    }

    // ── 6. Clean slate: remove old education + clusters + matches ────────
    // Order matters: JobMatch references WorkExperienceCluster via matchedClusterId
    // (onDelete: NoAction), so we must delete matches BEFORE clusters.
    await db.$transaction([
      db.jobMatch.deleteMany({ where: { candidateId: candidate.id } }),
      db.workExperienceCluster.deleteMany({ where: { candidateId: candidate.id } }),
      db.educationRecord.deleteMany({ where: { candidateId: candidate.id } }),
    ]);

    // ── 7. Persist: education records ────────────────────────────────────
    const educationRecords = await Promise.all(
      extracted.education.map((edu) =>
        db.educationRecord.create({
          data: {
            candidateId: candidate.id,
            level: edu.level as EducationLevel,
            field: edu.field,
            institution: edu.institution ?? null,
            graduationYear: edu.graduationYear ?? null,
          },
        }),
      ),
    );

    // ── 8. Persist: work experience clusters ──────────────────────────────
    // Auto-select the top cluster (most years of experience)

    const clusterRecords = await Promise.all(
      extracted.suggestedClusters.map((cluster, index) =>
        db.workExperienceCluster.create({
          data: {
            candidateId: candidate.id,
            function: cluster.function as JobFunction,
            jobTitles: JSON.stringify(cluster.jobTitles),
            skills: JSON.stringify(cluster.skills),
            yearsExperience: cluster.yearsExperience,
            isSelected: index === 0, // Auto-select top trajectory
            rawExperiences: JSON.stringify(
              extracted.workExperiences
                .filter((exp) => exp.function === cluster.function)
                .map((exp) => ({
                  jobTitle: exp.jobTitle,
                  company: exp.company,
                  startDate: exp.startDate,
                  endDate: exp.endDate,
                  yearsExperience: exp.yearsExperience,
                  description: exp.description,
                })),
            ),
          },
        }),
      ),
    );

    // ── 8. Auto-compute matches against all active jobs ──────────────────
    // This runs deterministically (no LLM) — just DB reads + scoring math.
    const activeJobs = await db.job.findMany({
      where: { isActive: true, deletedAt: null },
    });

    let matchesCreated = 0;
    for (const job of activeJobs) {
      for (const cluster of extracted.suggestedClusters) {
        // The cluster we just persisted has an ID — match by function
        const clusterRecord = clusterRecords.find(
          (cr) => cr.function === cluster.function,
        );
        if (!clusterRecord) continue;

        // Hard filter: function must match
        if (!isFunctionMatch(cluster.function as JobFunction, job.function as JobFunction)) {
          continue;
        }

        try {
          const breakdown = scoreMatch(
            {
              id: clusterRecord.id,
              function: cluster.function as JobFunction,
              jobTitles: cluster.jobTitles,
              skills: cluster.skills,
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
            extracted.education.map((edu) => ({
              level: edu.level as EducationLevel,
              field: edu.field,
            })),
          );

          await db.jobMatch.upsert({
            where: {
              candidateId_jobId_matchedClusterId: {
                candidateId: candidate.id,
                jobId: job.id,
                matchedClusterId: clusterRecord.id,
              },
            },
            create: {
              candidateId: candidate.id,
              jobId: job.id,
              matchedClusterId: clusterRecord.id,
              totalScore: breakdown.totalScore,
              titleScore: breakdown.titleScore,
              skillsScore: breakdown.skillsScore,
              educationScore: breakdown.educationScore,
              fieldScore: breakdown.fieldScore,
              experienceScore: breakdown.experienceScore,
              explanations: JSON.stringify(breakdown.explanations),
              stale: false,
            },
            update: {
              totalScore: breakdown.totalScore,
              titleScore: breakdown.titleScore,
              skillsScore: breakdown.skillsScore,
              educationScore: breakdown.educationScore,
              fieldScore: breakdown.fieldScore,
              experienceScore: breakdown.experienceScore,
              explanations: JSON.stringify(breakdown.explanations),
              stale: false,
              computedAt: new Date(),
            },
          });
          matchesCreated++;
        } catch (err) {
          console.error(
            `Match scoring failed: candidate=${candidate.id} job=${job.id} cluster=${cluster.function}`,
            err,
          );
        }
      }
    }

    // ── 9. Return extraction summary ─────────────────────────────────────
    return NextResponse.json({
      success: true,
      provider: extractionResult.provider,
      parseInfo,
      extracted: {
        clusterCount: extracted.suggestedClusters.length,
        educationCount: extracted.education.length,
        skillsCount: extracted.skills.length,
        clusters: extracted.suggestedClusters.map((c) => ({
          function: c.function,
          jobTitles: c.jobTitles,
          skills: c.skills,
          yearsExperience: c.yearsExperience,
          isSelected: extracted.suggestedClusters.indexOf(c) === 0,
        })),
      },
      matches: {
        created: matchesCreated,
        jobsConsidered: activeJobs.length,
      },
      tokensUsed: extractionResult.tokensUsed,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error('CV upload error:', error);
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json(
      {
        error: 'Failed to process CV. Please try again.',
        details: message,
        stack: process.env.NODE_ENV === 'development' ? stack : undefined,
      },
      { status: 500 },
    );
  }
}
