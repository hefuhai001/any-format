import type { Converter, Format } from '../core/types.js';
import { docxConverters } from './docx.js';
import { docConverters } from './doc.js';
import { pdfConverters } from './pdf.js';
import { pptxConverters } from './pptx.js';
import { spreadsheetConverters } from './xlsx.js';

/**
 * Office/PDF adapters. Registering them costs nothing: every optional peer
 * dependency is imported lazily inside the converter, so installs stay small
 * until a conversion actually needs the library.
 */
export const officeConverters: Converter<any>[] = [
  ...docxConverters,
  ...docConverters,
  ...pdfConverters,
  ...pptxConverters,
  ...spreadsheetConverters,
];

/** Formats handled by the adapter layer (a peer dependency is still required). */
export const OFFICE_FORMATS: readonly Format[] = ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'pdf'];

/** Formats the library can only read, never write. */
export const READ_ONLY_FORMATS: readonly Format[] = ['doc', 'pdf'];

export { docxConverters, docConverters, pdfConverters, pptxConverters, spreadsheetConverters };
export { parseMarkdownBlocks, parseInlineRuns, cleanInline } from './markdown-blocks.js';
export type { Block, InlineRun } from './markdown-blocks.js';
export type { DocxReadOptions, DocxWriteOptions } from './docx.js';
export type { DocReadOptions } from './doc.js';
export type { PdfReadOptions, PdfWriteOptions } from './pdf.js';
export type { PptxReadOptions, PptxWriteOptions } from './pptx.js';
export type { SpreadsheetReadOptions, SpreadsheetWriteOptions } from './xlsx.js';
export { optionalImport, asBuffer, asText } from './loader.js';
