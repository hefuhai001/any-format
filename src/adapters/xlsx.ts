import { asBuffer } from './loader.js';
import { optionalImport } from './loader.js';
import { collectHeaders, parseCsv, serializeCsv, type CsvSerializeOptions } from '../converters/csv.js';
import { parseHtmlTable } from '../converters/table.js';
import { parseMarkdownTable } from '../converters/table.js';
import type { ConvertInput, Converter, Format } from '../core/types.js';

export interface SpreadsheetReadOptions {
  /** Worksheet name or 0-based index. Default: first sheet. */
  sheet?: string | number;
  /** Emit a header row when writing csv/markdown. Default `true`. */
  header?: boolean;
}

export interface SpreadsheetWriteOptions {
  /** Worksheet name. Default `Sheet1`. */
  sheetName?: string;
  /** First row is a header. Default `true` for csv/json/markdown sources. */
  header?: boolean;
}

type XlsxRow = unknown[];

async function readRows(input: ConvertInput, options: SpreadsheetReadOptions): Promise<{ rows: XlsxRow[]; sheetNames: string[] }> {
  const XLSX = await optionalImport('xlsx', 'SheetJS reads both .xlsx and legacy .xls');
  const buffer = asBuffer(input, 'spreadsheet');
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, dense: false });

  const names: string[] = workbook.SheetNames;
  const target =
    typeof options.sheet === 'number' ? names[options.sheet] : typeof options.sheet === 'string' ? options.sheet : names[0];
  if (!target || !workbook.Sheets[target]) {
    throw new Error(`Worksheet "${String(options.sheet)}" not found. Available: ${names.join(', ') || '(none)'}`);
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[target], {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  }) as XlsxRow[];

  return { rows, sheetNames: names };
}

function rowsToRecords(rows: XlsxRow[], header: boolean): Record<string, unknown>[] {
  if (rows.length === 0) return [];
  if (!header) return rows.map((row) => Object.fromEntries(row.map((value, i) => [String(i), value])));
  const [head, ...body] = rows;
  const keys = (head ?? []).map((value, i) => String(value ?? '') || `column_${i + 1}`);
  return body.map((row) => Object.fromEntries(keys.map((key, i) => [key, (row as XlsxRow)[i] ?? ''])));
}

async function writeSheet(rows: XlsxRow[], sheetName: string, bookType: 'xlsx' | 'xls'): Promise<Uint8Array> {
  const XLSX = await optionalImport('xlsx', 'SheetJS writes both .xlsx and legacy .xls');
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName.slice(0, 31) || 'Sheet1');
  const out = XLSX.write(workbook, { type: 'buffer', bookType }) as Buffer;
  return new Uint8Array(out);
}

function toCsv(rows: XlsxRow[], options: CsvSerializeOptions & SpreadsheetReadOptions): string {
  const header = options.header ?? true;
  const records = rowsToRecords(rows, header);
  return serializeCsv(records, options, header ? collectHeaders(records) : undefined);
}

function toRecords(rows: XlsxRow[], options: SpreadsheetReadOptions): Record<string, unknown>[] {
  return rowsToRecords(rows, options.header ?? true);
}

/** Spreadsheet source formats understood by the SheetJS adapter. */
const SHEET_FORMATS: Format[] = ['xlsx', 'xls'];

function makeReadConverters(from: Format): Converter<any>[] {
  return [
    {
      from,
      to: 'csv',
      name: `adapter:${from}->csv`,
      async convert(input, options: SpreadsheetReadOptions & CsvSerializeOptions = {}) {
        const { rows } = await readRows(input, options);
        return toCsv(rows, options);
      },
    },
    {
      from,
      to: 'json',
      name: `adapter:${from}->json`,
      async convert(input, options: SpreadsheetReadOptions = {}) {
        const { rows } = await readRows(input, options);
        return JSON.stringify(toRecords(rows, options), null, 2);
      },
    },
    {
      from,
      to: 'markdown',
      name: `adapter:${from}->markdown`,
      async convert(input, options: SpreadsheetReadOptions = {}) {
        const { rows } = await readRows(input, options);
        const records = toRecords(rows, options);
        const headers = collectHeaders(records);
        const cell = (value: unknown) => String(value ?? '').replace(/\|/g, '\\|');
        return [
          `| ${headers.join(' | ')} |`,
          `| ${headers.map(() => '---').join(' | ')} |`,
          ...records.map((record) => `| ${headers.map((header) => cell(record[header])).join(' | ')} |`),
        ].join('\n');
      },
    },
    {
      from,
      to: 'html',
      name: `adapter:${from}->html`,
      async convert(input, options: SpreadsheetReadOptions = {}) {
        const { rows } = await readRows(input, options);
        const records = toRecords(rows, options);
        const headers = collectHeaders(records);
        const head = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('');
        const body = records
          .map((record) => `<tr>${headers.map((header) => `<td>${escapeHtml(String(record[header] ?? ''))}</td>`).join('')}</tr>`)
          .join('\n');
        return `<table>\n<thead>\n<tr>${head}</tr>\n</thead>\n<tbody>\n${body}\n</tbody>\n</table>`;
      },
    },
    {
      from,
      to: 'text',
      name: `adapter:${from}->text`,
      async convert(input, options: SpreadsheetReadOptions = {}) {
        const { rows } = await readRows(input, options);
        return rows.map((row) => row.map((value) => String(value ?? '')).join('\t')).join('\n');
      },
    },
  ];
}

function makeWriteConverters(to: 'xlsx' | 'xls'): Converter<any>[] {
  const bookType = to;
  return [
    {
      from: 'csv',
      to,
      name: `adapter:csv->${to}`,
      async convert(input, options: SpreadsheetWriteOptions = {}) {
        const rows = parseCsv(String(input)) as XlsxRow[];
        return writeSheet(rows, options.sheetName ?? 'Sheet1', bookType);
      },
    },
    {
      from: 'tsv',
      to,
      name: `adapter:tsv->${to}`,
      async convert(input, options: SpreadsheetWriteOptions = {}) {
        const rows = parseCsv(String(input), { delimiter: '\t' }) as XlsxRow[];
        return writeSheet(rows, options.sheetName ?? 'Sheet1', bookType);
      },
    },
    {
      from: 'json',
      to,
      name: `adapter:json->${to}`,
      async convert(input, options: SpreadsheetWriteOptions = {}) {
        const data = JSON.parse(String(input));
        const records = (Array.isArray(data) ? data : [data]) as Record<string, unknown>[];
        const headers = collectHeaders(records);
        const rows: XlsxRow[] = [headers, ...records.map((record) => headers.map((header) => record[header] ?? ''))];
        return writeSheet(rows, options.sheetName ?? 'Sheet1', bookType);
      },
    },
    {
      from: 'html',
      to,
      name: `adapter:html->${to}`,
      async convert(input, options: SpreadsheetWriteOptions = {}) {
        const rows = parseHtmlTable(String(input));
        return writeSheet(rows, options.sheetName ?? 'Sheet1', bookType);
      },
    },
    {
      from: 'markdown',
      to,
      name: `adapter:markdown->${to}`,
      async convert(input, options: SpreadsheetWriteOptions = {}) {
        const rows = parseMarkdownTable(String(input));
        return writeSheet(rows, options.sheetName ?? 'Sheet1', bookType);
      },
    },
  ];
}

/** `xlsx`/`xls` ↔ csv/json/markdown/html/text. Requires the optional `xlsx` peer. */
export const spreadsheetConverters: Converter<any>[] = [
  ...SHEET_FORMATS.flatMap(makeReadConverters),
  ...makeWriteConverters('xlsx'),
  ...makeWriteConverters('xls'),
];

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
