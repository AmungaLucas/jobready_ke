// ============================================================================
// app/api/jobs/[id]/route.ts
// Get single job detail.
// Per Section 9: GET /api/jobs/:id — Get job detail + match explanation
// Includes match score for the authenticated candidate (if available)
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const job = await db.job.findFirst({
      where: {
        id,
        isActive: true,
        deletedAt: null,
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // If candidate is authenticated, attach their match score for this job
    let matchForCandidate: any = null;
    const session = await getServerSession(authOptions);
    if (session?.user?.role === 'CANDIDATE') {
      const candidate = await db.candidate.findFirst({
        where: { userId: session.user.id, isActive: true, deletedAt: null },
      });
      if (candidate) {
        const match = await db.jobMatch.findFirst({
          where: { candidateId: candidate.id, jobId: job.id },
          orderBy: { totalScore: 'desc' },
        });
        if (match) {
          matchForCandidate = {
            totalScore: match.totalScore,
            titleScore: match.titleScore,
            skillsScore: match.skillsScore,
            educationScore: match.educationScore,
            fieldScore: match.fieldScore,
            experienceScore: match.experienceScore,
            explanations: JSON.parse(match.explanations),
          };
        }
      }
    }

    return NextResponse.json({
      job: {
        id: job.id,
        title: job.title,
        function: job.function,
        sector: job.sector,
        jobType: job.jobType,
        minEducation: job.minEducation,
        educationField: job.educationField,
        minExperience: job.minExperience,
        requiredSkills: JSON.parse(job.requiredSkills),
        preferredSkills: job.preferredSkills ? JSON.parse(job.preferredSkills) : [],
        description: job.description,
        location: job.location,
        salaryRange: job.salaryRange,
        applicationDeadline: job.applicationDeadline,
        administrativeRequirements: job.administrativeRequirements
          ? JSON.parse(job.administrativeRequirements)
          : [],
        createdAt: job.createdAt,
      },
      match: matchForCandidate,
    });
  } catch (error) {
    console.error('Get job error:', error);
    return NextResponse.json(
      { error: 'Failed to load job' },
      { status: 500 },
    );
  }
}
