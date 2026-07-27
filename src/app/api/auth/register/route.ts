// ============================================================================
// app/api/auth/register/route.ts
// Candidate signup with consent recording per Section 13
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { ConsentType } from '@prisma/client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, fullName, phone, county, consent } = body;

    // Basic validation
    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: 'Email, password, and full name are required' },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 },
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check for existing user
    const existing = await db.user.findFirst({
      where: { email: normalizedEmail },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);

    // Create user + candidate + consent record in a transaction
    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          name: fullName,
          passwordHash,
          role: 'CANDIDATE',
          emailVerified: new Date(),
        },
      });

      const candidate = await tx.candidate.create({
        data: {
          userId: user.id,
          fullName,
          phone: phone ?? null,
          county: county ?? null,
          consentVersion: '1.0',
          consentDate: new Date(),
        },
      });

      // Record signup consent
      await tx.consentRecord.create({
        data: {
          userId: user.id,
          candidateId: candidate.id,
          consentType: ConsentType.signup,
          consentVersion: '1.0',
          ipAddress: request.headers.get('x-forwarded-for') ?? null,
          userAgent: request.headers.get('user-agent') ?? null,
        },
      });

      // Record data processing consent if candidate accepted it
      if (consent?.dataProcessing) {
        await tx.consentRecord.create({
          data: {
            userId: user.id,
            candidateId: candidate.id,
            consentType: ConsentType.data_processing,
            consentVersion: '1.0',
            ipAddress: request.headers.get('x-forwarded-for') ?? null,
            userAgent: request.headers.get('user-agent') ?? null,
          },
        });
      }

      // Record marketing consent if candidate accepted it
      if (consent?.marketing) {
        await tx.consentRecord.create({
          data: {
            userId: user.id,
            candidateId: candidate.id,
            consentType: ConsentType.marketing,
            consentVersion: '1.0',
            ipAddress: request.headers.get('x-forwarded-for') ?? null,
            userAgent: request.headers.get('user-agent') ?? null,
          },
        });
      }

      return { user, candidate };
    });

    return NextResponse.json({
      success: true,
      userId: result.user.id,
      candidateId: result.candidate.id,
      message: 'Account created. Please sign in to continue.',
    });
  } catch (error: unknown) {
    console.error('Registration error:', error);
    const msg = (error as Error)?.message ?? String(error);

    // Classify the error so the user gets an actionable hint without leaking
    // internal details (no raw SQL, no DB URL, no stack trace).
    let kind: 'db-unreachable' | 'db-config' | 'duplicate' | 'unknown' = 'unknown';
    if (
      msg.includes('Can\'t reach database') ||
      msg.includes('Timed out fetching a new connection') ||
      msg.includes('connect ECONNREFUSED') ||
      msg.includes('connect ETIMEDOUT') ||
      msg.includes('getaddrinfo ENOTFOUND')
    ) {
      kind = 'db-unreachable';
    } else if (
      msg.includes('DATABASE_URL') ||
      msg.includes('PrismaClientInitializationError') ||
      msg.includes('Authentication failed') ||
      msg.includes('Access denied')
    ) {
      kind = 'db-config';
    } else if (msg.includes('Unique constraint') || msg.includes('Already exists')) {
      kind = 'duplicate';
    }

    const hintMap: Record<typeof kind, string> = {
      'db-unreachable':
        'Database server is unreachable from this environment. If deploying on Vercel, make sure the DB host allows inbound connections from Vercel IPs.',
      'db-config':
        'Database configuration is invalid. Check that DATABASE_URL is set in your deployment environment variables and points to a reachable MySQL server.',
      duplicate: 'An account with these details already exists.',
      unknown: 'Please try again. If the problem persists, contact support.',
    };

    return NextResponse.json(
      {
        error: 'Failed to create account.',
        hint: hintMap[kind],
        kind,
        // Reference code only — safe to expose. Map to a short slug.
        ref:
          kind === 'unknown'
            ? 'REG_UNKNOWN'
            : `REG_${kind.toUpperCase()}`,
      },
      { status: kind === 'duplicate' ? 409 : 500 },
    );
  }
}
