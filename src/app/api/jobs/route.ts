// ============================================================================
// app/api/jobs/route.ts
// List active jobs (paginated). Candidate-facing.
// Per Section 9: GET /api/jobs — List active jobs (paginated)
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '20', 10), 50);
    const functionFilter = searchParams.get('function');
    const sectorFilter = searchParams.get('sector');
    const jobTypeFilter = searchParams.get('jobType');

    const skip = (page - 1) * pageSize;

    const where: any = {
      isActive: true,
      deletedAt: null,
    };
    if (functionFilter) where.function = functionFilter;
    if (sectorFilter) where.sector = sectorFilter;
    if (jobTypeFilter) where.jobType = jobTypeFilter;

    const [jobs, total] = await Promise.all([
      db.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          title: true,
          function: true,
          sector: true,
          jobType: true,
          minEducation: true,
          minExperience: true,
          location: true,
          salaryRange: true,
          applicationDeadline: true,
          createdAt: true,
          // Don't expose requiredSkills in list view (privacy/preview)
        },
      }),
      db.job.count({ where }),
    ]);

    return NextResponse.json({
      jobs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('List jobs error:', error);
    return NextResponse.json(
      { error: 'Failed to load jobs' },
      { status: 500 },
    );
  }
}
