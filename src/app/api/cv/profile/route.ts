// ============================================================================
// app/api/cv/profile/route.ts
// Get candidate's extracted profile
// Phase 1: Returns the raw CV text + any manually-set education/clusters
// Phase 2: Returns the LLM-extracted structured profile
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

    const candidate = await db.candidate.findFirst({
      where: { userId: session.user.id, isActive: true, deletedAt: null },
      include: {
        education: true,
        clusters: true,
        extras: true,
      },
    });
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate profile not found' }, { status: 404 });
    }

    const rawCv = candidate.extras.find((e) => e.type === 'raw_cv');

    return NextResponse.json({
      profile: {
        id: candidate.id,
        fullName: candidate.fullName,
        phone: candidate.phone,
        county: candidate.county,
        consentVersion: candidate.consentVersion,
        consentDate: candidate.consentDate,
      },
      rawCvText: rawCv?.value ?? null,
      hasUploadedCv: !!rawCv,
      education: candidate.education.map((e) => ({
        id: e.id,
        level: e.level,
        field: e.field,
        institution: e.institution,
        graduationYear: e.graduationYear,
      })),
      clusters: candidate.clusters.map((c) => ({
        id: c.id,
        function: c.function,
        jobTitles: JSON.parse(c.jobTitles),
        skills: JSON.parse(c.skills),
        yearsExperience: c.yearsExperience,
        isSelected: c.isSelected,
      })),
      selectedTrajectoryCount: candidate.clusters.filter((c) => c.isSelected).length,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}
