// ============================================================================
// lib/parsers/parse-document.ts
// Server-side document parser — converts uploaded files to plain text.
//
// Supported formats:
//   - PDF    → pdfjs-dist v4 (text-layer extraction, data: URL worker)
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
// PDF strategy:
//   1. pdfjs-dist is listed in serverExternalPackages (next.config.ts) so the
//      bundler does NOT rewrite its internal import paths.
//   2. We polyfill DOMMatrix/DOMRect/DOMPoint/CSS for Node.js at module load.
//   3. At first PDF parse, we read the worker .mjs from node_modules and
//      encode it as a data:text/javascript URL. Node.js ESM loader supports
//      data: protocol (but NOT https:), so pdfjs can import() it.
//   4. This avoids all three failure modes:
//      - "DOMMatrix is not defined"         → polyfills
//      - "Cannot find module ...pdf.worker"  → serverExternalPackages
//      - "Received protocol 'https:'"        → data: URL (not https CDN)
//      - ENOENT test file from pdf-parse@1.1.1 → not using pdf-parse
// ============================================================================

// ── Browser API polyfills required by pdfjs-dist in Node.js ──────────────
if (typeof globalThis.DOMMatrix === 'undefined') {
  // @ts-expect-error — Node.js polyfill
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
    get a() { return this.m[0]; } set a(v: number) { this.m[0] = v; }
    get b() { return this.m[1]; } set b(v: number) { this.m[1] = v; }
    get c() { return this.m[2]; } set c(v: number) { this.m[2] = v; }
    get d() { return this.m[3]; } set d(v: number) { this.m[3] = v; }
    get e() { return this.m[4]; } set e(v: number) { this.m[4] = v; }
    get f() { return this.m[5]; } set f(v: number) { this.m[5] = v; }
    is2D = () => true;
    isIdentity = () => this.m.every((v: number, i: number) => v === [1,0,0,1,0,0][i]);
    inverse = () => new (this.constructor as any)(this.m);
    multiply = () => this;
    rotate = () => this;
    scale = () => this;
    translate = () => this;
    toString = () => `matrix(${this.m.join(', ')})`;
  };
}
if (typeof globalThis.DOMRect === 'undefined') {
  // @ts-expect-error — Node.js polyfill
  globalThis.DOMRect = class DOMRect {
    x = 0; y = 0; width = 0; height = 0;
    top = 0; right = 0; bottom = 0; left = 0;
    constructor(x = 0, y = 0, w = 0, h = 0) {
      this.x = x; this.y = y; this.width = w; this.height = h;
      this.top = y; this.right = x + w; this.bottom = y + h; this.left = x;
    }
  };
}
if (typeof globalThis.DOMPoint === 'undefined') {
  // @ts-expect-error — Node.js polyfill
  globalThis.DOMPoint = class DOMPoint {
    x = 0; y = 0; z = 0; w = 1;
    constructor(x = 0, y = 0, z = 0, w = 1) {
      this.x = x; this.y = y; this.z = z; this.w = w;
    }
    matrixTransform = () => this;
  };
}
if (typeof globalThis.CSS === 'undefined') {
  // @ts-expect-error — Node.js polyfill
  globalThis.CSS = {
    supports() { return false; },
    escape(str: string) { return str; },
  };
}

import mammoth from 'mammoth';
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// ── pdfjs-dist loader ─────────────────────────────────────────────────────
// pdfjs-dist is in serverExternalPackages → loaded from node_modules at
// runtime, not bundled by webpack/turbopack.

const require = createRequire(import.meta.url);
const _dirname = dirname(fileURLToPath(import.meta.url));

let pdfjsLib: any = null;

async function getPdfjs() {
  if (pdfjsLib) return pdfjsLib;

  const mod = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjsLib = mod;

  // Resolve the worker file from node_modules.
  // Since pdfjs-dist is an external package, the file exists at runtime.
  const pdfjsPkgDir = dirname(require.resolve('pdfjs-dist/package.json'));
  const workerPath = join(pdfjsPkgDir, 'legacy/build/pdf.worker.min.mjs');

  // Read the worker source and encode as a data: URL.
  // Node.js ESM loader supports data: protocol (but NOT https:).
  const workerSource = readFileSync(workerPath, 'utf-8');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `data:text/javascript;base64,${Buffer.from(workerSource).toString('base64')}`;

  return pdfjsLib;
}

async function parsePdf(buffer: Buffer): Promise<{ text: string; numpages: number }> {
  const pdfjs = await getPdfjs();
  const data = new Uint8Array(buffer);

  const doc = await pdfjs.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str || '')
      .join(' ');
    pages.push(pageText);
    page.cleanup();
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
