// ============================================================================
// app/api/admin/compute-matches/route.ts
// Compute matches between candidates and jobs.
// Phase 1: Manual trigger (admin).
// Phase 3: Will be replaced by a cron job running every 5 minutes.
//
// Algorithm per Section 6 of v4.0:
//   1. For each active job posted recently (Phase 3 will use last 1 hour)
//   2. For each candidate with selected trajectories matching the job's function
//   3. Score the match (max 100 points)
//   4. Store the result in job_matches
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { scoreMatch, isFunctionMatch } from '@/lib/matching';
import { JobFunction, EducationLevel } from '@/lib/normalization';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const jobId = body.jobId; // optional: compute for a single job
    const candidateId = body.candidateId; // optional: compute for a single candidate

    // Select target jobs
    const jobWhere: any = { isActive: true, deletedAt: null };
    if (jobId) jobWhere.id = jobId;

    const jobs = await db.job.findMany({ where: jobWhere });
    if (jobs.length === 0) {
      return NextResponse.json({ message: 'No jobs to match against', computed: 0 });
    }

    // Select target candidates (only those with selected trajectories)
    const candidateWhere: any = {
      isActive: true,
      deletedAt: null,
      clusters: { some: { isSelected: true } },
    };
    if (candidateId) candidateWhere.id = candidateId;

    const candidates = await db.candidate.findMany({
      where: candidateWhere,
      include: {
        education: true,
        clusters: { where: { isSelected: true } },
      },
    });

    if (candidates.length === 0) {
      return NextResponse.json({
        message: 'No candidates with selected trajectories',
        computed: 0,
        jobs: jobs.length,
      });
    }

    let totalComputed = 0;
    const errors: string[] = [];

    for (const job of jobs) {
      for (const candidate of candidates) {
        // For each selected cluster, compute a score (one match per cluster)
        for (const cluster of candidate.clusters) {
          // Hard filter: function must match
          if (!isFunctionMatch(cluster.function as JobFunction, job.function as JobFunction)) {
            continue;
          }

          try {
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

            // Upsert the match (unique constraint on candidateId+jobId+matchedClusterId)
            await db.jobMatch.upsert({
              where: {
                candidateId_jobId_matchedClusterId: {
                  candidateId: candidate.id,
                  jobId: job.id,
                  matchedClusterId: cluster.id,
                },
              },
              create: {
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
            totalComputed++;
          } catch (err) {
            errors.push(`Failed: candidate=${candidate.id} job=${job.id} cluster=${cluster.id}: ${(err as Error).message}`);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      jobsProcessed: jobs.length,
      candidatesProcessed: candidates.length,
      matchesComputed: totalComputed,
      errors: errors.slice(0, 10),
      errorCount: errors.length,
    });
  } catch (error) {
    console.error('Compute matches error:', error);
    return NextResponse.json(
      { error: 'Failed to compute matches' },
      { status: 500 },
    );
  }
}
