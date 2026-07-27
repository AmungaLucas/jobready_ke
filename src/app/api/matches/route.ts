// ============================================================================
// app/api/matches/route.ts
// Get candidate's ranked match list
// Per Section 9: GET /api/matches — Get candidate's ranked match list
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'CANDIDATE') {
      return NextResponse.json({ error: 'Only candidates can view matches' }, { status: 403 });
    }

    const candidate = await db.candidate.findFirst({
      where: { userId: session.user.id, isActive: true, deletedAt: null },
    });
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate profile not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100);

    // Fetch matches ordered by total score desc
    const matches = await db.jobMatch.findMany({
      where: { candidateId: candidate.id },
      orderBy: { totalScore: 'desc' },
      take: limit,
      include: {
        job: {
          select: {
            id: true,
            title: true,
            function: true,
            sector: true,
            jobType: true,
            location: true,
            salaryRange: true,
            applicationDeadline: true,
            isActive: true,
            deletedAt: true,
          },
        },
      },
    });

    // Filter out matches for inactive/deleted jobs
    const visibleMatches = matches.filter((m) => m.job.isActive && !m.job.deletedAt);

    return NextResponse.json({
      matches: visibleMatches.map((m) => ({
        id: m.id,
        jobId: m.jobId,
        totalScore: m.totalScore,
        titleScore: m.titleScore,
        skillsScore: m.skillsScore,
        specializationScore: m.specializationScore,
        familyScore: m.familyScore,
        educationScore: m.educationScore,
        experienceScore: m.experienceScore,
        explanations: JSON.parse(m.explanations),
        computedAt: m.computedAt,
        job: m.job,
      })),
      count: visibleMatches.length,
    });
  } catch (error) {
    console.error('List matches error:', error);
    return NextResponse.json(
      { error: 'Failed to load matches' },
      { status: 500 },
    );
  }
}
