// ============================================================================
// /api/health — deployment diagnostic endpoint
// Returns structured info about environment, build, and DB connectivity.
// Safe to expose: only booleans + counts, never raw secrets or SQL.
// ============================================================================
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const t0 = Date.now();

  // --- Environment check (booleans only, never values) ---
  const env = {
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    databaseUrlProtocol: process.env.DATABASE_URL?.split('://')[0] ?? null,
    databaseUrlHost: process.env.DATABASE_URL
      ? (() => {
          try {
            const u = new URL(process.env.DATABASE_URL);
            return u.hostname;
          } catch {
            return 'parse-error';
          }
        })()
      : null,
    hasNextauthSecret: !!process.env.NEXTAUTH_SECRET,
    hasNextauthUrl: !!process.env.NEXTAUTH_URL,
    nodeEnv: process.env.NODE_ENV ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    vercelRegion: process.env.VERCEL_REGION ?? null,
  };

  // --- Prisma client check ---
  let prismaClient = 'unknown';
  try {
    // Import the generated client marker — if Prisma client wasn't generated
    // at build time, this will throw.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require('@prisma/client');
    prismaClient = pkg.Prisma?.clientVersion ?? 'present-unknown-version';
  } catch (e: unknown) {
    prismaClient = 'missing:' + ((e as Error).message ?? '').slice(0, 80);
  }

  // --- DB connectivity check ---
  let dbState: 'ok' | 'fail' | 'timeout' = 'fail';
  let dbError: string | null = null;
  let userCount = -1;
  let dbMs = -1;

  try {
    const dbT0 = Date.now();
    // Simple count query with explicit short timeout via Promise.race
    const countPromise = db.user.count();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('db-query-timeout-8s')), 8000),
    );
    userCount = (await Promise.race([countPromise, timeoutPromise])) as number;
    dbMs = Date.now() - dbT0;
    dbState = 'ok';
  } catch (e: unknown) {
    const msg = (e as Error).message ?? String(e);
    if (msg.includes('timeout')) dbState = 'timeout';
    else dbState = 'fail';
    // Sanitize: strip any URL/password from message
    dbError = msg
      .replace(/mysql:\/\/[^\s]+/g, 'mysql://***')
      .replace(/password[^,)]+/gi, 'password=***')
      .slice(0, 300);
  }

  return NextResponse.json(
    {
      ok: dbState === 'ok',
      timestamp: new Date().toISOString(),
      elapsedMs: Date.now() - t0,
      env,
      prismaClient,
      db: {
        state: dbState,
        latencyMs: dbMs,
        userCount,
        error: dbError,
      },
    },
    { status: dbState === 'ok' ? 200 : 503 },
  );
}
