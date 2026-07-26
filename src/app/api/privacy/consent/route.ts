// ============================================================================
// app/api/privacy/consent/route.ts
// View and update consent preferences (Section 13)
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ConsentType } from '@prisma/client';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const records = await db.consentRecord.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    });

    // Group by latest version per consent type
    const latest = new Map<string, typeof records[0]>();
    for (const r of records) {
      const existing = latest.get(r.consentType);
      if (!existing || r.createdAt > existing.createdAt) {
        latest.set(r.consentType, r);
      }
    }

    return NextResponse.json({
      consents: Array.from(latest.entries()).map(([type, record]) => ({
        type,
        version: record.consentVersion,
        grantedAt: record.createdAt,
      })),
    });
  } catch (error) {
    console.error('Get consent error:', error);
    return NextResponse.json({ error: 'Failed to load consent records' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { consentType, granted } = await request.json();
    if (!Object.values(ConsentType).includes(consentType)) {
      return NextResponse.json({ error: 'Invalid consent type' }, { status: 400 });
    }

    const candidate = await db.candidate.findFirst({
      where: { userId: session.user.id },
    });

    // Only record if granted=true; revoking = no new record (historical consents are immutable)
    if (granted) {
      await db.consentRecord.create({
        data: {
          userId: session.user.id,
          candidateId: candidate?.id,
          consentType,
          consentVersion: '1.0',
          ipAddress: request.headers.get('x-forwarded-for') ?? null,
          userAgent: request.headers.get('user-agent') ?? null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      consentType,
      granted,
      message: granted
        ? 'Consent recorded.'
        : 'Consent not granted. We will not perform this type of processing.',
    });
  } catch (error) {
    console.error('Update consent error:', error);
    return NextResponse.json({ error: 'Failed to update consent' }, { status: 500 });
  }
}
