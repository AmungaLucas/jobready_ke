// ============================================================================
// app/api/privacy/delete/route.ts
// Account deletion per DPA Section 40 (right to erasure)
// Soft-delete: sets is_active=FALSE, deleted_at=NOW()
// Permanent purge happens via daily cron after 30-day grace period
// HTTP method: DELETE (REST-correct per v4.0 doc)
// ============================================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DeletionStatus } from '@prisma/client';

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { confirm } = await request.json();

    if (!confirm || confirm !== 'DELETE') {
      return NextResponse.json(
        { error: 'Please type DELETE to confirm account deletion' },
        { status: 400 },
      );
    }

    const candidate = await db.candidate.findFirst({
      where: { userId: session.user.id, isActive: true, deletedAt: null },
    });
    if (!candidate) {
      return NextResponse.json(
        { error: 'No active candidate profile found' },
        { status: 404 },
      );
    }

    // Record deletion request for audit trail
    await db.deletionRequest.create({
      data: {
        userId: session.user.id,
        candidateId: candidate.id,
        status: DeletionStatus.pending,
        reason: 'user_initiated',
      },
    });

    // Soft-delete: mark candidate inactive, schedule purge after 30-day grace period
    await db.candidate.update({
      where: { id: candidate.id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    await db.user.update({
      where: { id: session.user.id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message:
        'Account deletion request submitted. Your data will be permanently purged within 30 days. ' +
        'You may revoke this request by contacting support before the purge completes.',
    });
  } catch (error) {
    console.error('Delete account error:', error);
    return NextResponse.json(
      { error: 'Failed to process deletion request' },
      { status: 500 },
    );
  }
}
