// ============================================================================
// app/api/jobs/extract/route.ts
// JD extraction preview endpoint (admin only).
// Accepts raw JD text, runs LLM extraction, returns the normalized fields
// WITHOUT persisting. Lets the admin review/edit before saving.
// ============================================================================

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { extractJd, validateJdExtraction } from '@/lib/llm/extract-jd';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { rawText } = body as { rawText?: string };

    if (!rawText || rawText.trim().length < 50) {
      return NextResponse.json(
        { error: 'JD text is too short. Please paste at least 50 characters.' },
        { status: 400 },
      );
    }

    let result;
    try {
      result = await extractJd(rawText);
    } catch (err: any) {
      return NextResponse.json(
        {
          error: 'Could not parse the job description. Please try again or use the form input.',
          details: err.message,
          code: err.code,
        },
        { status: 422 },
      );
    }

    const errors = validateJdExtraction(result.data);
    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Extraction produced invalid data', errors },
        { status: 422 },
      );
    }

    return NextResponse.json({
      success: true,
      provider: result.provider,
      job: result.data,
      tokensUsed: result.tokensUsed,
      durationMs: result.durationMs,
    });
  } catch (error) {
    console.error('JD extract error:', error);
    return NextResponse.json(
      { error: 'Failed to extract job description' },
      { status: 500 },
    );
  }
}
