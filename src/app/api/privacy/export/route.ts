// ============================================================================
// app/api/privacy/export/route.ts
// Data export per DPA Section 26 (right to access)
// Returns candidate's full data as JSON
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ExportStatus } from '@prisma/client';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const candidate = await db.candidate.findFirst({
      where: { userId: session.user.id },
    });
    if (!candidate) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Fetch all candidate data
    const [
      user,
      education,
      clusters,
      extras,
      matches,
      applications,
      savedJobs,
      consentRecords,
    ] = await Promise.all([
      db.user.findUnique({ where: { id: session.user.id } }),
      db.educationRecord.findMany({ where: { candidateId: candidate.id } }),
      db.workExperienceCluster.findMany({ where: { candidateId: candidate.id } }),
      db.candidateExtra.findMany({ where: { candidateId: candidate.id } }),
      db.jobMatch.findMany({ where: { candidateId: candidate.id } }),
      db.application.findMany({ where: { candidateId: candidate.id } }),
      db.savedJob.findMany({ where: { candidateId: candidate.id } }),
      db.consentRecord.findMany({ where: { userId: session.user.id } }),
    ]);

    // Record this export request for audit trail
    await db.exportRequest.create({
      data: {
        userId: session.user.id,
        candidateId: candidate.id,
        status: ExportStatus.completed,
        completionDate: new Date(),
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    const exportData = {
      exportedAt: new Date().toISOString(),
      user: {
        id: user!.id,
        email: user!.email,
        name: user!.name,
        role: user!.role,
        createdAt: user!.createdAt,
      },
      candidate: {
        id: candidate.id,
        fullName: candidate.fullName,
        phone: candidate.phone,
        county: candidate.county,
        consentVersion: candidate.consentVersion,
        consentDate: candidate.consentDate,
        createdAt: candidate.createdAt,
      },
      education: education.map((e) => ({
        level: e.level,
        field: e.field,
        institution: e.institution,
        graduationYear: e.graduationYear,
      })),
      workExperienceClusters: clusters.map((c) => ({
        function: c.function,
        jobTitles: JSON.parse(c.jobTitles),
        skills: JSON.parse(c.skills),
        yearsExperience: c.yearsExperience,
        isSelected: c.isSelected,
      })),
      extras: extras.map((e) => ({ type: e.type, value: e.value })),
      matches: matches.map((m) => ({
        jobId: m.jobId,
        totalScore: m.totalScore,
        computedAt: m.computedAt,
      })),
      applications: applications.map((a) => ({
        jobId: a.jobId,
        status: a.status,
        appliedAt: a.appliedAt,
      })),
      savedJobs: savedJobs.map((s) => ({ jobId: s.jobId, savedAt: s.createdAt })),
      consentRecords: consentRecords.map((c) => ({
        type: c.consentType,
        version: c.consentVersion,
        ipAddress: c.ipAddress,
        userAgent: c.userAgent,
        timestamp: c.createdAt,
      })),
    };

    return NextResponse.json(exportData, {
      headers: {
        'Content-Disposition': `attachment; filename="my-data-${candidate.id}.json"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 },
    );
  }
}
