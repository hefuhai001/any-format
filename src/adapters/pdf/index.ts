import type { Converter } from '../../core/types.js';
import { makeReadConverters } from './read.js';
import { makeWriteConverters } from './write.js';

export type { PdfReadOptions } from './read.js';
export type { PdfWriteOptions } from './write.js';
export { readPdfText } from './read.js';
export { writePdf } from './write.js';

/** `pdf` text extraction plus markdown/text/html → pdf. Requires `pdf-parse` / `pdfkit`. */
export const pdfConverters: Converter<any>[] = [...makeReadConverters(), ...makeWriteConverters()];
