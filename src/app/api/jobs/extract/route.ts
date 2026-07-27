// ============================================================================
// app/api/jobs/extract/route.ts
// JD extraction preview endpoint (admin only).
// Accepts:
//   - JSON body with rawText (paste / JSON input)
//   - FormData with file (PDF/DOCX/DOC/MD/JSON/TXT — server-side parsed)
// Runs LLM extraction, returns normalized fields WITHOUT persisting.
// Lets the admin review/edit before saving.
// ============================================================================

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { extractJd, validateJdExtraction } from '@/lib/llm/extract-jd';
import { parseDocument, ParseError, SUPPORTED_EXTENSIONS } from '@/lib/parsers/parse-document';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // ── Determine input method: FormData (file) vs JSON (text paste) ────
    const contentType = request.headers.get('content-type') ?? '';
    let rawText: string;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json(
          { error: 'No file provided.' },
          { status: 400 },
        );
      }

      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!SUPPORTED_EXTENSIONS.has(ext)) {
        return NextResponse.json(
          { error: `Unsupported format: .${ext}. Supported: PDF, DOCX, DOC, TXT, MD, JSON.` },
          { status: 400 },
        );
      }

      try {
        const parsed = await parseDocument(file, file.name);
        rawText = parsed.text;
      } catch (err) {
        if (err instanceof ParseError) {
          return NextResponse.json({ error: err.message }, { status: 400 });
        }
        throw err;
      }
    } else {
      const body = await request.json();
      const { rawText: text } = body as { rawText?: string };

      if (!text || text.trim().length < 50) {
        return NextResponse.json(
          { error: 'JD text is too short. Please paste at least 50 characters.' },
          { status: 400 },
        );
      }
      rawText = text;
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
