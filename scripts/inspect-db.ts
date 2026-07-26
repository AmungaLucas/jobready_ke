// Quick DB inspection script
import { db } from '../src/lib/db';

async function main() {
  const users = await db.user.findMany({ select: { id: true, email: true, role: true, isActive: true, passwordHash: true } });
  console.log('=== USERS ===');
  for (const u of users) {
    console.log(`  ${u.email} | role=${u.role} | active=${u.isActive} | hash=${u.passwordHash ? u.passwordHash.substring(0, 20) + '...' : 'NULL'}`);
  }

  const candidates = await db.candidate.findMany({ select: { id: true, userId: true, fullName: true, isActive: true } });
  console.log('\n=== CANDIDATES ===');
  for (const c of candidates) {
    console.log(`  ${c.fullName} (userId=${c.userId}, active=${c.isActive})`);
  }

  const matchCount = await db.jobMatch.count();
  console.log(`\n=== MATCHES: ${matchCount} ===`);

  const matches = await db.jobMatch.findMany({
    include: { job: { select: { title: true } } },
    orderBy: { totalScore: 'desc' },
    take: 10,
  });
  for (const m of matches) {
    console.log(`  ${m.totalScore}% - ${m.job.title} (title=${m.titleScore} skills=${m.skillsScore} edu=${m.educationScore} field=${m.fieldScore} exp=${m.experienceScore})`);
  }

  await db.$disconnect();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
