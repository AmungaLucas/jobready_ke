// ============================================================================
// lib/parsers/parse-document.ts
// Server-side document parser — converts uploaded files to plain text.
//
// Supported formats:
//   - PDF    → pdf-parse (extracts text layer)
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

import mammoth from 'mammoth';

// pdf-parse v2 exports PDFParse class, no default export.
// The API is: new PDFParse(uint8array) → parser.getText() → { text, pages, total }
let PDFParseClass: any;

async function loadPdfParse() {
  if (!PDFParseClass) {
    const mod = await import('pdf-parse');
    PDFParseClass = (mod as any).PDFParse ?? mod.default?.PDFParse;
    if (typeof PDFParseClass !== 'function') {
      throw new Error('pdf-parse: could not find PDFParse export');
    }
  }
  return PDFParseClass;
}

export interface ParsedDocument {
  /** Extracted plain text, ready for LLM consumption */
  text: string;
  metadata: {
    format: string;
    fileName: string;
    fileSize: number;
    /** PDF page count (only for PDFs) */
    pages?: number;
  };
}

/** Maximum file size we accept: 10 MB */
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
        text = await parseDocx(buffer);
        break;

      case 'doc':
        // mammoth handles .doc best-effort (old binary format)
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
        if (ext === 'rtf') {
          text = stripRtf(text);
        }
        break;

      default:
        // Last resort: try UTF-8 text
        text = buffer.toString('utf-8');
        // If it looks like binary garbage, warn
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

  // Post-processing: collapse excessive whitespace
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

// ─── Format-specific parsers ──────────────────────────────────────────────

async function parsePdf(buffer: Buffer): Promise<{ text: string; numpages: number }> {
  const PDFParse = await loadPdfParse();
  const uint8 = new Uint8Array(buffer);
  const parser = new PDFParse(uint8);
  try {
    const result = await parser.getText();
    // pdf-parse v2 returns { text: string, pages: string[], total: number }
    return { text: result.text, numpages: result.total };
  } finally {
    parser.destroy();
  }
}

async function parseDocx(buffer: Buffer): Promise<string> {
  // mammoth extracts raw text from DOCX/DOC buffers
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

function parseJson(buffer: Buffer, fileName: string): string {
  const raw = buffer.toString('utf-8');
  try {
    // If it's valid JSON, return it prettified so the LLM can read it
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed, null, 2);
  } catch {
    // If it's not valid JSON, return as-is and let the LLM deal with it
    return raw;
  }
}

function parseMarkdown(buffer: Buffer): string {
  let text = buffer.toString('utf-8');
  // Strip YAML frontmatter (--- delimited block at start)
  text = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  return text;
}

function stripRtf(text: string): string {
  // Basic RTF stripping: remove all RTF control sequences
  // This won't handle complex RTF perfectly but works for simple documents
  let out = text;
  // Remove RTF header
  out = out.replace(/\\[a-z]+\d* ?/gi, ' ');
  // Remove braces
  out = out.replace(/[{}]/g, '');
  // Remove hex-encoded characters (\xx)
  out = out.replace(/\\'[0-9a-fA-F]{2}/g, ' ');
  // Collapse whitespace
  out = out.replace(/[ \t]+/g, ' ').trim();
  return out;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function getExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1) return '';
  return fileName.slice(lastDot + 1).toLowerCase();
}

function cleanExtractedText(text: string): string {
  // Normalize line endings
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Collapse 3+ consecutive newlines into 2
  text = text.replace(/\n{3,}/g, '\n\n');
  // Collapse multiple spaces on same line (but preserve intentional indentation)
  text = text.replace(/[^\S\n]{4,}/g, '   ');
  // Trim trailing whitespace per line
  text = text
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');
  return text.trim();
}

function isLikelyBinary(text: string): boolean {
  // If >30% of first 500 chars are non-printable, it's probably binary
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

/** Map of file extensions we accept */
export const SUPPORTED_EXTENSIONS = new Set([
  'pdf', 'docx', 'doc', 'txt', 'text', 'md', 'markdown', 'json', 'csv', 'rtf',
]);

/** MIME types we accept (for the <input accept> attribute) */
export const ACCEPT_MIME_TYPES =
  '.pdf,.docx,.doc,.txt,.text,.md,.markdown,.json,.csv,.rtf,application/pdf,' +
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
  'application/msword,text/plain,text/markdown,application/json,text/csv,' +
  'application/rtf,text/rtf';
