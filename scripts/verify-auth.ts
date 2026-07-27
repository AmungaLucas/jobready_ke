// Verify NextAuth credentials flow will work:
// 1) User lookup by email
// 2) bcrypt password verify
// 3) Role is correctly stored
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({ log: ['error'] });

async function tryLogin(email: string, password: string) {
  console.log(`\n→ login attempt: ${email} / ${password}`);
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true, isActive: true, deletedAt: true, passwordHash: true },
  });
  if (!user) { console.log('  FAIL: user not found'); return; }
  if (!user.isActive) { console.log('  FAIL: user inactive'); return; }
  if (user.deletedAt) { console.log('  FAIL: user soft-deleted'); return; }
  if (!user.passwordHash) { console.log('  FAIL: no password hash (oauth user?)'); return; }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) { console.log('  FAIL: wrong password'); return; }
  console.log('  SUCCESS:', { id: user.id, email: user.email, name: user.name, role: user.role });
}

await main();

async function main() {
  await tryLogin('candidate@demo.com', 'password123');
  await tryLogin('admin@demo.com', 'password123');
  await tryLogin('candidate@demo.com', 'wrong-password');
  await tryLogin('doesnotexist@demo.com', 'password123');
}
