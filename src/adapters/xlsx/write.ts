import { optionalImport } from '../loader.js';
import { parseCsv } from '../../converters/csv/index.js';
import { parseHtmlTable, parseMarkdownTable, rowsFromRecords, recordsFromJson } from '../../converters/table/index.js';
import type { ConvertInput, Converter } from '../../core/types.js';

export interface SpreadsheetWriteOptions {
  /** Worksheet name. Default `Sheet1`. */
  sheetName?: string;
}

export async function writeSheet(rows: unknown[][], sheetName: string, bookType: 'xlsx' | 'xls'): Promise<Uint8Array> {
  const XLSX = await optionalImport('xlsx', 'SheetJS writes both .xlsx and legacy .xls');
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName.slice(0, 31) || 'Sheet1');
  const out = XLSX.write(workbook, { type: 'buffer', bookType }) as Buffer;
  return new Uint8Array(out);
}

export function makeWriteConverters(to: 'xlsx' | 'xls'): Converter<any>[] {
  const toSheet = (rows: unknown[][], options: SpreadsheetWriteOptions) =>
    writeSheet(rows, options.sheetName ?? 'Sheet1', to);

  return [
    {
      from: 'csv',
      to,
      name: `adapter:csv->${to}`,
      convert: (input: ConvertInput, options: SpreadsheetWriteOptions = {}) => toSheet(parseCsv(String(input)), options),
    },
    {
      from: 'tsv',
      to,
      name: `adapter:tsv->${to}`,
      convert: (input: ConvertInput, options: SpreadsheetWriteOptions = {}) =>
        toSheet(parseCsv(String(input), { delimiter: '\t' }), options),
    },
    {
      from: 'json',
      to,
      name: `adapter:json->${to}`,
      convert: (input: ConvertInput, options: SpreadsheetWriteOptions = {}) =>
        toSheet(rowsFromRecords(recordsFromJson(String(input))), options),
    },
    {
      from: 'html',
      to,
      name: `adapter:html->${to}`,
      convert: (input: ConvertInput, options: SpreadsheetWriteOptions = {}) => toSheet(parseHtmlTable(String(input)), options),
    },
    {
      from: 'markdown',
      to,
      name: `adapter:markdown->${to}`,
      convert: (input: ConvertInput, options: SpreadsheetWriteOptions = {}) =>
        toSheet(parseMarkdownTable(String(input)), options),
    },
  ];
}
