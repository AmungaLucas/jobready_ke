// ============================================================================
// lib/parsers/parse-document.ts
// Server-side document parser — converts uploaded files to plain text.
//
// Supported formats:
//   - PDF    → pdf-parse@1.1.1 (pure Node.js, no browser polyfills, no worker)
//   - DOCX   → mammoth         (extracts paragraphs + tables)
//   - DOC    → mammoth         (best-effort; old binary format)
//   - TXT    → direct read
//   - MD     → direct read     (strips YAML frontmatter)
//   - JSON   → JSON.stringify prettified (LLM can handle structured input)
//   - CSV    → direct read
//   - RTF    → stripped to plain text (basic regex stripper)
//
// Returns: { text: string, metadata: { pages?, format, fileName, fileSize } }
//
// All parsing happens SERVER-SIDE (inside Next.js API routes / Vercel functions).
// The client never does file parsing — it just sends raw bytes via FormData.
//
// Why pdf-parse@1.1.1 (legacy)?
//   - pdfjs-dist requires DOMMatrix/DOMRect polyfills AND a worker file that
//     fails to resolve in Vercel's serverless bundler ("Setting up fake worker
//     failed: Cannot find module ...pdf.worker.mjs").
//   - pdf-parse v2 switched to pdfjs-dist under the hood and inherited the
//     DOMMatrix issue ("DOMMatrix is not defined").
//   - pdf-parse@1.1.1 uses a pure-Node.js PDF parser (pdf.js fork pre-worker)
//     and works out of the box on Vercel with no polyfills, no worker setup,
//     and no dynamic imports. It's the most reliable option for serverless.
// ============================================================================

import mammoth from 'mammoth';

// ── pdf-parse loader (lazy, CommonJS interop) ──────────────────────────────
// We pin to ^1.1.1 to avoid the v2 rewrite that pulls in pdfjs-dist.
// The dynamic import keeps it out of the webpack bundle for non-PDF paths
// and avoids loading it on cold starts that never touch a PDF.

let pdfParseModule: ((buffer: Buffer) => Promise<{ text: string; numpages: number; info?: any }>) | null = null;

async function loadPdfParse() {
  if (pdfParseModule) return pdfParseModule;
  // `pdf-parse` is CommonJS — `require` it via interop.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('pdf-parse');
  // Handle both default export and module.exports = function shapes.
  pdfParseModule = (mod && (mod.default ?? mod)) as typeof pdfParseModule;
  if (typeof pdfParseModule !== 'function') {
    throw new Error('pdf-parse module did not export a callable function');
  }
  return pdfParseModule;
}

async function parsePdf(buffer: Buffer): Promise<{ text: string; numpages: number }> {
  const pdfParse = await loadPdfParse();
  const result = await pdfParse(buffer);
  return {
    text: result.text ?? '',
    numpages: result.numpages ?? 1,
  };
}

async function parseDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

function parseJson(buffer: Buffer, _fileName: string): string {
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
  // Strip YAML frontmatter (--- ... ---)
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
 * Throws a user-friendly ParseError on failure.
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
            `Unsupported format: .${ext}. Supported: PDF, DOCX, DOC, TXT, MD, JSON, CSV, RTF.`,
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
