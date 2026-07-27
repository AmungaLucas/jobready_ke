// ============================================================================
// lib/parsers/parse-document.ts
// Server-side document parser — delegates to a Python serverless function
// that uses Microsoft MarkItDown to convert ANY document to markdown text.
//
// Supported formats (via MarkItDown):
//   - PDF, DOCX, DOC, PPTX, XLSX, HTML, TXT, MD, JSON, CSV, RTF
//   - Also: images (OCR if [all] extras installed), audio (transcription)
//
// Returns: { text: string, metadata: { format, fileName, fileSize } }
//
// Architecture:
//   ┌─────────────────┐     HTTP POST     ┌──────────────────────┐
//   │ Next.js route   │ ─── (FormData) ── │  /api/parse-document │
//   │ (TypeScript)    │                   │  (Python + MarkItDown)│
//   └─────────────────┘  ◀── JSON text ── └──────────────────────┘
//            │
//            ▼
//   LLM extraction, DB save, match recompute (all in TS)
//
// Why this design:
//   - markitdown is Microsoft's production-grade parser; battle-tested.
//   - Previous Node.js attempts (pdfjs-dist, pdf-parse) all failed on
//     Vercel serverless due to worker file resolution, DOMMatrix polyfills,
//     and read-only filesystem issues.
//   - Python runtime on Vercel has none of these issues — markitdown just
//     works out of the box.
//   - The TypeScript layer keeps the existing API so callers
//     (cv/upload, jobs/extract) don't need to change.
// ============================================================================

import { ParseError } from './error';

// Re-export so existing callers (`import { ParseError } from './parse-document'`)
// keep working without changes.
export { ParseError } from './error';

export interface ParsedDocument {
  text: string;
  metadata: {
    format: string;
    fileName: string;
    fileSize: number;
    pages?: number;
  };
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB — matches Python function

/**
 * Main entry point: takes a File/Blob and returns extracted plain text.
 * Delegates parsing to the Python MarkItDown serverless function.
 */
export async function parseDocument(
  file: File | Blob,
  fileName?: string,
): Promise<ParsedDocument> {
  const name = fileName ?? (file instanceof File ? file.name : 'unknown');
  const size = file.size;
  const ext = getExtension(name);
  const format = ext.toUpperCase();

  if (size === 0) {
    throw new ParseError('File is empty (0 bytes)', format, name);
  }
  if (size > MAX_FILE_SIZE) {
    throw new ParseError(
      `File too large (${formatBytes(size)}). Maximum is ${formatBytes(MAX_FILE_SIZE)}.`,
      format,
      name,
    );
  }

  // ── Build FormData and forward to Python endpoint ───────────────────
  const formData = new FormData();
  const blob = file instanceof File ? file : new Blob([file], { type: 'application/octet-stream' });
  formData.append('file', blob, name);

  // Determine Python endpoint URL — same Vercel deployment.
  // On Vercel, the Python function is at the same origin as the Next.js app.
  // In local dev (next dev), the Python function won't run unless we use
  // `vercel dev`. We allow override via env var for staging/local.
  const pythonEndpoint = process.env.PARSER_ENDPOINT ?? '/api/parse-document';
  const url = pythonEndpoint.startsWith('http')
    ? pythonEndpoint
    : `${getBaseUrl()}${pythonEndpoint}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      body: formData,
      // Don't set Content-Type — fetch will set it with the multipart boundary
    });
  } catch (err) {
    throw new ParseError(
      `Could not reach document parser service: ${(err as Error).message}`,
      format,
      name,
    );
  }

  // ── Handle response ─────────────────────────────────────────────────
  let body: any;
  try {
    body = await response.json();
  } catch {
    throw new ParseError(
      `Parser service returned invalid response (HTTP ${response.status})`,
      format,
      name,
    );
  }

  if (!response.ok) {
    const message = body?.error ?? `Parser service error (HTTP ${response.status})`;
    throw new ParseError(message, format, name);
  }

  const text: string = body.text ?? '';
  const metadata = body.metadata ?? {};

  if (text.trim().length < 20) {
    throw new ParseError(
      `Could not extract enough text from the ${format} file. The document may be image-based (scanned PDF) or empty.`,
      format,
      name,
    );
  }

  return {
    text: cleanExtractedText(text),
    metadata: {
      format: metadata.format ?? format,
      fileName: metadata.fileName ?? name,
      fileSize: metadata.fileSize ?? size,
      pages: metadata.pages,
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function getBaseUrl(): string {
  // Prefer explicit NEXTAUTH_URL (set on Vercel)
  if (process.env.NEXTAUTH_URL) {
    try {
      return new URL(process.env.NEXTAUTH_URL).origin;
    } catch {
      // Fall through
    }
  }
  // Vercel system env vars
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // Local dev fallback — requires `vercel dev` to run the Python function
  return 'http://localhost:3000';
}

function getExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1) return '';
  return fileName.slice(lastDot + 1).toLowerCase();
}

function cleanExtractedText(text: string): string {
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/[^\S\n]{4,}/g, '   ');
  text = text
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');
  return text.trim();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Exports for callers ──────────────────────────────────────────────────

export const SUPPORTED_EXTENSIONS = new Set([
  'pdf', 'docx', 'doc', 'pptx', 'ppt', 'xlsx', 'xls',
  'txt', 'text', 'md', 'markdown', 'json', 'csv', 'rtf', 'html', 'htm',
]);

export const ACCEPT_MIME_TYPES =
  '.pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,' +
  '.txt,.text,.md,.markdown,.json,.csv,.rtf,.html,.htm,' +
  'application/pdf,' +
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
  'application/msword,' +
  'application/vnd.openxmlformats-officedocument.presentationml.presentation,' +
  'application/vnd.ms-powerpoint,' +
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,' +
  'application/vnd.ms-excel,' +
  'text/plain,text/markdown,application/json,text/csv,' +
  'application/rtf,text/rtf,text/html';
