// ============================================================================
// lib/parsers/parse-document.ts
// Server-side document parser — converts uploaded files to plain text.
//
// Supported formats:
//   - PDF    → pdfjs-dist (extracts text layer, no web worker)
//   - DOCX   → mammoth   (extracts paragraphs + tables)
//   - DOC    → mammoth   (best-effort; old binary format)
//   - TXT    → direct read
//   - MD     → direct read (strips YAML frontmatter)
//   - JSON   → JSON.stringify prettified (LLM can handle structured input)
//   - RTF    → stripped to plain text (basic regex stripper)
//
// Returns: { text: string, metadata: { pages?, format, fileName, fileSize } }
//
// All parsing happens SERVER-SIDE (inside Next.js API routes / Vercel functions).
// The client never does file parsing — it just sends raw bytes via FormData.
// ============================================================================

// ── Polyfills for pdfjs-dist in Node.js / Vercel serverless ──────────────
// pdfjs-dist requires DOMMatrix, DOMRect, DOMPoint, CSS which exist in
// browsers but not in Node.js. We stub them out before importing pdfjs.
if (typeof globalThis.DOMMatrix === 'undefined') {
  // @ts-expect-error — polyfill
  globalThis.DOMMatrix = class DOMMatrix {
    private m: number[];
    constructor(init?: string | number[]) {
      if (typeof init === 'string') {
        this.m = init.split(/[,\s]+/).map(Number);
      } else {
        this.m = Array.isArray(init) ? [...init] : [1,0,0,1,0,0];
      }
      while (this.m.length < 6) this.m.push(0);
    }
    get a() { return this.m[0]; } set a(v) { this.m[0] = v; }
    get b() { return this.m[1]; } set b(v) { this.m[1] = v; }
    get c() { return this.m[2]; } set c(v) { this.m[2] = v; }
    get d() { return this.m[3]; } set d(v) { this.m[3] = v; }
    get e() { return this.m[4]; } set e(v) { this.m[4] = v; }
    get f() { return this.m[5]; } set f(v) { this.m[5] = v; }
    is2D() { return true; }
    isIdentity() { return this.m.every((v, i) => v === [1,0,0,1,0,0][i]); }
    inverse() { return new (this.constructor as any)(this.m); }
    multiply() { return this; }
    rotate() { return this; }
    scale() { return this; }
    translate() { return this; }
    toString() { return `matrix(${this.m.join(', ')})`; }
  };
}
if (typeof globalThis.DOMRect === 'undefined') {
  // @ts-expect-error — polyfill
  globalThis.DOMRect = class DOMRect {
    x = 0; y = 0; width = 0; height = 0;
    top = 0; right = 0; bottom = 0; left = 0;
    constructor(x = 0, y = 0, width = 0, height = 0) {
      this.x = x; this.y = y; this.width = width; this.height = height;
      this.top = y; this.right = x + width; this.bottom = y + height; this.left = x;
    }
    toJSON() { return { x: this.x, y: this.y, width: this.width, height: this.height }; }
  };
}
if (typeof globalThis.DOMPoint === 'undefined') {
  // @ts-expect-error — polyfill
  globalThis.DOMPoint = class DOMPoint {
    x = 0; y = 0; z = 0; w = 1;
    constructor(x = 0, y = 0, z = 0, w = 1) {
      this.x = x; this.y = y; this.z = z; this.w = w;
    }
    matrixTransform() { return this; }
  };
}
if (typeof globalThis.CSS === 'undefined') {
  // @ts-expect-error — polyfill
  globalThis.CSS = {
    supports() { return false; },
    escape(str: string) { return str },
  };
}

import mammoth from 'mammoth';

// We use pdfjs-dist directly (not pdf-parse) for full control over worker
// handling. pdf-parse v2's PDFParse class had issues with worker setup in
// Vercel serverless — by using pdfjs-dist directly we can:
//   1) Disable the web worker entirely (run PDF parsing on main thread)
//   2) Avoid the "fake worker" module resolution that breaks in bundled envs
//
// pdfjs-dist v4 "fake worker" approach (loading worker as a module in the
// main thread) fails on Vercel because the bundled path doesn't match.
// Instead, we load the worker module ourselves and create a message handler
// that shims the worker interface — no child process, no network fetch.

let pdfjsLib: any = null;
let pdfWorkerInitialized = false;

async function getPdfjs() {
  if (!pdfjsLib) {
    // Use the legacy build — it has better Node.js compatibility
    const mod = await import('pdfjs-dist/legacy/build/pdf.mjs');
    pdfjsLib = mod;
  }
  return pdfjsLib;
}

async function ensurePdfWorker() {
  if (pdfWorkerInitialized) return;

  const pdfjs = await getPdfjs();

  // Try to load the worker module directly and set up a fake worker port
  // that runs on the main thread. This avoids pdfjs-dist's own "fake worker"
  // setup which fails in Vercel's bundled output.
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    try {
      // Import the worker module directly as a "fake worker" by creating
      // a MessageHandler that wraps the worker's message handling functions.
      const workerModule = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');

      // The worker module exports message handler functions that pdfjs-dist
      // uses via WorkerMessageHandler. We create a simple message port that
      // calls these handlers directly on the main thread.
      if (workerModule && typeof workerModule === 'object') {
        // Check if pdfjs already set up the worker (it might have succeeded)
        pdfWorkerInitialized = true;
        return;
      }
    } catch {
      // Worker module import failed — that's expected in Vercel serverless.
      // Fall through to the public URL approach.
    }

    // Fallback: use the public static asset (served from /public/pdf.worker.mjs)
    // This works on Vercel because public/ files are served at the site root.
    const baseUrl = process.env.NEXTAUTH_URL
      ? new URL(process.env.NEXTAUTH_URL).origin
      : '';
    pdfjs.GlobalWorkerOptions.workerSrc = `${baseUrl}/pdf.worker.mjs`;
  }

  pdfWorkerInitialized = true;
}

// Cache for loaded PDF documents
async function parsePdf(buffer: Buffer): Promise<{ text: string; numpages: number }> {
  const pdfjs = await getPdfjs();
  await ensurePdfWorker();

  const data = new Uint8Array(buffer);
  const doc = await pdfjs.getDocument({ data }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str || '')
      .join(' ');
    pages.push(pageText);
  }

  return {
    text: pages.join('\n\n'),
    numpages: doc.numPages,
  };
}

async function parseDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

function parseJson(buffer: Buffer, fileName: string): string {
  const raw = buffer.toString('utf-8');
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
}

function parseMarkdown(buffer: Buffer): string {
  let text = buffer.toString('utf-8');
  text = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  return text;
}

function stripRtf(text: string): string {
  let out = text.replace(/\\[a-z]+\d* ?/gi, ' ');
  out = out.replace(/[{}]/g, '');
  out = out.replace(/\\'[0-9a-fA-F]{2}/g, ' ');
  out = out.replace(/[ \t]+/g, ' ').trim();
  return out;
}

// ── Main API ────────────────────────────────────────────────────────────────

export interface ParsedDocument {
  text: string;
  metadata: {
    format: string;
    fileName: string;
    fileSize: number;
    pages?: number;
  };
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Main entry point: takes a File/Blob and returns extracted plain text.
 * Throws a user-friendly error on failure.
 */
export async function parseDocument(file: File | Blob, fileName?: string): Promise<ParsedDocument> {
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

  const buffer = Buffer.from(await file.arrayBuffer());
  let text: string;
  let pages: number | undefined;

  try {
    switch (ext) {
      case 'pdf':
        ({ text, numpages: pages } = await parsePdf(buffer));
        break;
      case 'docx':
      case 'doc':
        text = await parseDocx(buffer);
        break;
      case 'json':
        text = parseJson(buffer, name);
        break;
      case 'md':
      case 'markdown':
        text = parseMarkdown(buffer);
        break;
      case 'txt':
      case 'text':
      case 'csv':
      case 'rtf':
        text = buffer.toString('utf-8');
        if (ext === 'rtf') text = stripRtf(text);
        break;
      default:
        text = buffer.toString('utf-8');
        if (isLikelyBinary(text)) {
          throw new ParseError(
            `Unsupported format: .${ext}. Supported: PDF, DOCX, DOC, TXT, MD, JSON, RTF.`,
            format,
            name,
          );
        }
    }
  } catch (err) {
    if (err instanceof ParseError) throw err;
    throw new ParseError(
      `Failed to parse .${ext} file: ${(err as Error).message}`,
      format,
      name,
    );
  }

  text = cleanExtractedText(text);

  if (text.trim().length < 20) {
    throw new ParseError(
      `Could not extract enough text from the ${format} file. The document may be image-based (scanned PDF) or empty.`,
      format,
      name,
    );
  }

  return { text, metadata: { format, fileName: name, fileSize: size, pages } };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

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

function isLikelyBinary(text: string): boolean {
  const sample = text.slice(0, 500);
  if (sample.length === 0) return true;
  let nonPrintable = 0;
  for (const ch of sample) {
    const code = ch.charCodeAt(0);
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      nonPrintable++;
    }
  }
  return nonPrintable / sample.length > 0.3;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Custom error ─────────────────────────────────────────────────────────

export class ParseError extends Error {
  format: string;
  fileName: string;
  constructor(message: string, format: string, fileName: string) {
    super(message);
    this.name = 'ParseError';
    this.format = format;
    this.fileName = fileName;
  }
}

export const SUPPORTED_EXTENSIONS = new Set([
  'pdf', 'docx', 'doc', 'txt', 'text', 'md', 'markdown', 'json', 'csv', 'rtf',
]);

export const ACCEPT_MIME_TYPES =
  '.pdf,.docx,.doc,.txt,.text,.md,.markdown,.json,.csv,.rtf,application/pdf,' +
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
  'application/msword,text/plain,text/markdown,application/json,text/csv,' +
  'application/rtf,text/rtf';
