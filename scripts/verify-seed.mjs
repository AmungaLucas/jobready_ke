// Verify remote MySQL DB has demo data
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({ log: ['error'] });

async function main() {
  const counts = {
    users: await db.user.count(),
    candidates: await db.candidate.count(),
    educationRecords: await db.educationRecord.count(),
    clusters: await db.workExperienceCluster.count(),
    clustersSelected: await db.workExperienceCluster.count({ where: { isSelected: true } }),
    jobs: await db.job.count(),
    matches: await db.jobMatch.count(),
  };

  console.log('\n=== Remote MySQL DB State ===');
  console.log(JSON.stringify(counts, null, 2));

  const users = await db.user.findMany({ select: { email: true, role: true, isActive: true } });
  console.log('\nUsers:');
  for (const u of users) console.log(`  - ${u.email.padEnd(28)} role=${u.role}  active=${u.isActive}`);

  const matches = await db.jobMatch.findMany({
    include: {
      job: { select: { title: true } },
      cluster: { select: { function: true } },
    },
    orderBy: { totalScore: 'desc' },
    take: 10,
  });
  console.log('\nTop matches:');
  for (const m of matches) {
    console.log(
      `  - score=${m.totalScore.toString().padStart(3)}  candidate→${m.cluster?.function.padEnd(18)} → job=${m.job.title}`,
    );
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
