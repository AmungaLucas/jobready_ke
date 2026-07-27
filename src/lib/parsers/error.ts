// lib/parsers/error.ts
// Shared ParseError used by the document parser and its callers.

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
