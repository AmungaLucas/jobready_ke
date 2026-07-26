// ============================================================================
// app/api/admin/seed-demo/route.ts
// Seeds demo data for testing the platform end-to-end.
// Creates:
//   - 1 admin user
//   - 1 demo candidate user (with CV, education, clusters)
//   - 6 sample jobs across multiple functions/sectors
//   - Computes matches between the demo candidate and jobs
// Idempotent: safe to call multiple times (updates if exists).
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { JobFunction, Sector, JobType, EducationLevel } from '@/lib/normalization';

export async function POST(request: Request) {
  try {
    const adminEmail = 'admin@demo.com';
    const candidateEmail = 'candidate@demo.com';
    const password = 'password123';

    const passwordHash = await hashPassword(password);

    // ── Upsert Admin ────────────────────────────────────────────────
    const admin = await db.user.upsert({
      where: { email: adminEmail },
      update: { role: 'ADMIN', isActive: true, deletedAt: null, passwordHash },
      create: {
        email: adminEmail,
        name: 'Demo Admin',
        passwordHash,
        role: 'ADMIN',
        emailVerified: new Date(),
      },
    });

    // ── Upsert Candidate ────────────────────────────────────────────
    let candidateUser = await db.user.findUnique({ where: { email: candidateEmail } });
    if (!candidateUser) {
      candidateUser = await db.user.create({
        data: {
          email: candidateEmail,
          name: 'Wanjiru Kamau',
          passwordHash,
          role: 'CANDIDATE',
          emailVerified: new Date(),
        },
      });
    }

    let candidate = await db.candidate.findFirst({
      where: { userId: candidateUser.id },
    });
    if (!candidate) {
      candidate = await db.candidate.create({
        data: {
          userId: candidateUser.id,
          fullName: 'Wanjiru Kamau',
          phone: '+254712345678',
          county: 'Nairobi',
          consentVersion: '1.0',
          consentDate: new Date(),
        },
      });
    } else {
      candidate = await db.candidate.update({
        where: { id: candidate.id },
        data: { isActive: true, deletedAt: null },
      });
    }

    // ── Clear old demo data (education, clusters, extras, matches) ──
    await db.jobMatch.deleteMany({ where: { candidateId: candidate.id } });
    await db.educationRecord.deleteMany({ where: { candidateId: candidate.id } });
    await db.workExperienceCluster.deleteMany({ where: { candidateId: candidate.id } });
    await db.candidateExtra.deleteMany({ where: { candidateId: candidate.id } });

    // ── Education (array: candidate has Bachelors + Diploma) ─────────
    await db.educationRecord.createMany({
      data: [
        {
          candidateId: candidate.id,
          level: 'bachelors' as EducationLevel,
          field: 'Commerce',
          institution: 'University of Nairobi',
          graduationYear: 2019,
        },
        {
          candidateId: candidate.id,
          level: 'diploma' as EducationLevel,
          field: 'Business Management',
          institution: 'Kenya Institute of Management',
          graduationYear: 2016,
        },
      ],
    });

    // ── Work Experience Clusters (candidate has 2 trajectories) ──────
    // Cluster 1: Finance trajectory (selected)
    const cluster1 = await db.workExperienceCluster.create({
      data: {
        candidateId: candidate.id,
        function: 'finance' as JobFunction,
        jobTitles: JSON.stringify(['Accounts Assistant', 'Accountant']),
        skills: JSON.stringify(['accounting', 'ifrs', 'audit', 'taxation', 'quickbooks', 'excel']),
        yearsExperience: 4,
        isSelected: true,
        rawExperiences: JSON.stringify([]),
      },
    });

    // Cluster 2: Admin/Customer Service trajectory (selected)
    const cluster2 = await db.workExperienceCluster.create({
      data: {
        candidateId: candidate.id,
        function: 'customer_service' as JobFunction,
        jobTitles: JSON.stringify(['Office Administrator', 'Customer Service Representative']),
        skills: JSON.stringify(['customer service', 'office administration', 'filing', 'scheduling', 'communication']),
        yearsExperience: 3,
        isSelected: true,
        rawExperiences: JSON.stringify([]),
      },
    });

    // Cluster 3: Marketing trajectory (NOT selected — candidate chose other paths)
    await db.workExperienceCluster.create({
      data: {
        candidateId: candidate.id,
        function: 'marketing' as JobFunction,
        jobTitles: JSON.stringify(['Marketing Intern']),
        skills: JSON.stringify(['social media', 'content writing']),
        yearsExperience: 1,
        isSelected: false,
        rawExperiences: JSON.stringify([]),
      },
    });

    // ── Demo jobs across functions ───────────────────────────────────
    const jobs = [
      {
        title: 'Senior Accountant',
        function: 'finance' as JobFunction,
        sector: 'financial_services' as Sector,
        jobType: 'full_time' as JobType,
        minEducation: 'bachelors' as EducationLevel,
        educationField: 'Accounting',
        minExperience: 3,
        requiredSkills: ['accounting', 'ifrs', 'audit', 'taxation'],
        preferredSkills: ['quickbooks', 'sap'],
        description: 'We are seeking a Senior Accountant to manage our financial reporting, audit, and tax compliance functions at our Nairobi headquarters.',
        location: 'Nairobi, Kenya',
        salaryRange: 'KES 120,000 - 180,000',
        applicationDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        administrativeRequirements: ['CPA K', '3 professional referees'],
      },
      {
        title: 'Accounts Assistant',
        function: 'finance' as JobFunction,
        sector: 'technology' as Sector,
        jobType: 'full_time' as JobType,
        minEducation: 'diploma' as EducationLevel,
        educationField: 'Accounting',
        minExperience: 2,
        requiredSkills: ['accounting', 'excel', 'bookkeeping'],
        preferredSkills: ['quickbooks'],
        description: 'Fast-growing tech startup needs an Accounts Assistant to support the finance team with day-to-day bookkeeping, reconciliation, and reporting.',
        location: 'Nairobi, Kenya',
        salaryRange: 'KES 50,000 - 80,000',
        applicationDeadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
        administrativeRequirements: [],
      },
      {
        title: 'Office Administrator',
        function: 'customer_service' as JobFunction,
        sector: 'hospitality' as Sector,
        jobType: 'full_time' as JobType,
        minEducation: 'diploma' as EducationLevel,
        educationField: 'Business Administration',
        minExperience: 2,
        requiredSkills: ['office administration', 'filing', 'scheduling', 'communication'],
        preferredSkills: ['customer service'],
        description: 'A leading hotel group in Nairobi is looking for an Office Administrator to coordinate front desk operations, manage scheduling, and oversee office logistics.',
        location: 'Nairobi, Kenya',
        salaryRange: 'KES 60,000 - 90,000',
        applicationDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        administrativeRequirements: ['2 professional referees'],
      },
      {
        title: 'Customer Service Representative',
        function: 'customer_service' as JobFunction,
        sector: 'technology' as Sector,
        jobType: 'full_time' as JobType,
        minEducation: 'certificate' as EducationLevel,
        educationField: 'Communications',
        minExperience: 1,
        requiredSkills: ['customer service', 'communication'],
        preferredSkills: ['call center'],
        description: 'Telecom company seeking CSRs to handle inbound customer queries via phone, email, and chat. Training provided.',
        location: 'Nairobi, Kenya',
        salaryRange: 'KES 35,000 - 50,000',
        applicationDeadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        administrativeRequirements: [],
      },
      {
        title: 'Marketing Officer',
        function: 'marketing' as JobFunction,
        sector: 'media' as Sector,
        jobType: 'full_time' as JobType,
        minEducation: 'bachelors' as EducationLevel,
        educationField: 'Marketing',
        minExperience: 2,
        requiredSkills: ['marketing', 'social media', 'content', 'seo'],
        preferredSkills: ['advertising'],
        description: 'Media house is hiring a Marketing Officer to drive brand awareness and digital campaigns across multiple platforms.',
        location: 'Nairobi, Kenya',
        salaryRange: 'KES 70,000 - 100,000',
        applicationDeadline: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
        administrativeRequirements: ['Portfolio of past work'],
      },
      {
        title: 'Junior Software Engineer',
        function: 'technology' as JobFunction,
        sector: 'technology' as Sector,
        jobType: 'full_time' as JobType,
        minEducation: 'bachelors' as EducationLevel,
        educationField: 'Computer Science',
        minExperience: 1,
        requiredSkills: ['javascript', 'react', 'node.js', 'git'],
        preferredSkills: ['typescript', 'aws'],
        description: 'Join a fast-growing fintech as a Junior Software Engineer. You will work on customer-facing products and learn from senior engineers.',
        location: 'Nairobi, Kenya (Hybrid)',
        salaryRange: 'KES 80,000 - 120,000',
        applicationDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        administrativeRequirements: ['GitHub profile', 'Code sample'],
      },
    ];

    // Clear existing demo jobs (title-based filter)
    const demoTitles = jobs.map((j) => j.title);
    await db.job.deleteMany({
      where: { title: { in: demoTitles } },
    });

    // Insert fresh demo jobs
    const createdJobs = [];
    for (const j of jobs) {
      const job = await db.job.create({
        data: {
          title: j.title,
          function: j.function,
          sector: j.sector,
          jobType: j.jobType,
          minEducation: j.minEducation,
          educationField: j.educationField,
          minExperience: j.minExperience,
          requiredSkills: JSON.stringify(j.requiredSkills),
          preferredSkills: JSON.stringify(j.preferredSkills),
          description: j.description,
          location: j.location,
          salaryRange: j.salaryRange,
          applicationDeadline: j.applicationDeadline,
          administrativeRequirements: j.administrativeRequirements.length
            ? JSON.stringify(j.administrativeRequirements)
            : null,
          inputMethod: 'form',
          postedBy: admin.id,
        },
      });
      createdJobs.push(job);
    }

    // ── Compute matches for demo candidate against all jobs ──────────
    const { scoreMatch, isFunctionMatch } = await import('@/lib/matching');

    let matchCount = 0;
    for (const job of createdJobs) {
      // Cluster 1 (finance)
      if (isFunctionMatch(cluster1.function as JobFunction, job.function as JobFunction)) {
        const breakdown = scoreMatch(
          {
            id: cluster1.id,
            function: cluster1.function as JobFunction,
            jobTitles: JSON.parse(cluster1.jobTitles),
            skills: JSON.parse(cluster1.skills),
            yearsExperience: cluster1.yearsExperience,
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
          [
            { level: 'bachelors' as EducationLevel, field: 'Commerce' },
            { level: 'diploma' as EducationLevel, field: 'Business Management' },
          ],
        );
        await db.jobMatch.create({
          data: {
            candidateId: candidate.id,
            jobId: job.id,
            matchedClusterId: cluster1.id,
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
        matchCount++;
      }

      // Cluster 2 (customer service)
      if (isFunctionMatch(cluster2.function as JobFunction, job.function as JobFunction)) {
        const breakdown = scoreMatch(
          {
            id: cluster2.id,
            function: cluster2.function as JobFunction,
            jobTitles: JSON.parse(cluster2.jobTitles),
            skills: JSON.parse(cluster2.skills),
            yearsExperience: cluster2.yearsExperience,
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
          [
            { level: 'bachelors' as EducationLevel, field: 'Commerce' },
            { level: 'diploma' as EducationLevel, field: 'Business Management' },
          ],
        );
        await db.jobMatch.create({
          data: {
            candidateId: candidate.id,
            jobId: job.id,
            matchedClusterId: cluster2.id,
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
        matchCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Demo data seeded successfully',
      admin: { email: adminEmail, password },
      candidate: { email: candidateEmail, password },
      jobsCreated: createdJobs.length,
      matchesCreated: matchCount,
    });
  } catch (error) {
    console.error('Seed demo error:', error);
    return NextResponse.json(
      { error: 'Failed to seed demo data', details: (error as Error).message },
      { status: 500 },
    );
  }
}
