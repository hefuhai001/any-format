import type { Converter } from '../../core/types.js';
import { makeReadConverters } from './read.js';
import { makeWriteConverters } from './write.js';

export type { DocxReadOptions } from './read.js';
export type { DocxWriteOptions } from './write.js';
export { readDocxHtml } from './read.js';
export { writeDocx } from './write.js';
export { textToBlocks } from '../blocks/index.js';

/** `docx` ↔ html/markdown/text. Requires the optional `mammoth` / `docx` peers. */
export const docxConverters: Converter<any>[] = [...makeReadConverters(), ...makeWriteConverters()];
