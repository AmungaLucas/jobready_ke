// ============================================================================
// app/api/admin/jobs/route.ts
// Create a new job posting. Admin-only.
// Per Section 5: supports 4 input methods:
//   - paste_text:  LLM fires (Phase 2)
//   - upload_file: LLM fires (Phase 2)
//   - paste_json:  No LLM, structured JSON provided
//   - form:        No LLM, structured form fields
// For Phase 1, we implement paste_json and form methods (no LLM required).
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
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

export async function GET(request: Request) {
  // List all jobs (admin view, includes inactive)
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

    // For Phase 1: support paste_json and form (no LLM)
    // paste_text and upload_file will be implemented in Phase 2 with LLM
    let jobData: any;

    if (inputMethod === 'paste_json') {
      jobData = body.job;
      if (!jobData) {
        return NextResponse.json({ error: 'job object is required for paste_json' }, { status: 400 });
      }
    } else if (inputMethod === 'form') {
      jobData = body;
    } else {
      // Phase 2 will handle these via LLM
      return NextResponse.json(
        { error: `${inputMethod} not yet implemented (Phase 2)` },
        { status: 501 },
      );
    }

    // Normalize all enum fields with word-boundary matching
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

    // Normalize skills
    const requiredSkills = normalizeSkills(jobData.requiredSkills ?? []);
    const preferredSkills = normalizeSkills(jobData.preferredSkills ?? []);
    const administrativeRequirements = jobData.administrativeRequirements ?? [];

    // Create the job
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

    // Mark all existing candidate matches as stale so the matching cron picks this up
    // (For Phase 1 we don't have a cron; matches are recomputed on-demand in Phase 3)
    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: 'Job created. Matches will be computed in the next cron run.',
    });
  } catch (error) {
    console.error('Create job error:', error);
    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 },
    );
  }
}
