import type { Converter, Format } from '../core/types.js';
import { docConverters } from './doc.js';
import { docxConverters } from './docx/index.js';
import { pdfConverters } from './pdf/index.js';
import { pptxConverters } from './pptx/index.js';
import { spreadsheetConverters } from './xlsx/index.js';

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

export { docConverters } from './doc.js';
export { docxConverters, readDocxHtml, textToBlocks, writeDocx } from './docx/index.js';
export { pdfConverters, readPdfText, writePdf } from './pdf/index.js';
export { blocksToSlides, pptxConverters, readSlides, slidesToHtml, slidesToMarkdown, slidesToText, writePptx } from './pptx/index.js';
export { SHEET_FORMATS, readRows, spreadsheetConverters, writeSheet } from './xlsx/index.js';
export { cleanInline, parseInlineRuns, parseMarkdownBlocks } from './blocks/index.js';
export { asBuffer, asText, optionalImport } from './loader.js';

export type { Block, InlineRun } from './blocks/index.js';
export type { DocReadOptions } from './doc.js';
export type { DocxReadOptions, DocxWriteOptions } from './docx/index.js';
export type { PdfReadOptions, PdfWriteOptions } from './pdf/index.js';
export type { PptxReadOptions, PptxWriteOptions } from './pptx/index.js';
export type { SpreadsheetReadOptions, SpreadsheetWriteOptions } from './xlsx/index.js';
