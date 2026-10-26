import type { Converter, Format } from '../../core/types.js';
import { makeReadConverters } from './read.js';
import { makeWriteConverters } from './write.js';

export type { SpreadsheetReadOptions } from './read.js';
export type { SpreadsheetWriteOptions } from './write.js';
export { readRows, rowsToRecords } from './read.js';
export { writeSheet } from './write.js';

/** Spreadsheet source formats understood by the SheetJS adapter. */
export const SHEET_FORMATS: readonly Format[] = ['xlsx', 'xls'];

/** `xlsx`/`xls` ↔ csv/tsv/json/markdown/html/text. Requires the optional `xlsx` peer. */
export const spreadsheetConverters: Converter<any>[] = [
  ...SHEET_FORMATS.flatMap((format) => makeReadConverters(format)),
  ...makeWriteConverters('xlsx'),
  ...makeWriteConverters('xls'),
];
