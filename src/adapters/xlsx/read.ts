import { asBuffer, optionalImport } from '../loader.js';
import { collectHeaders, serializeCsv, type CsvSerializeOptions } from '../../converters/csv/index.js';
import { renderHtmlTable, renderMarkdownTable } from '../../converters/table/index.js';
import type { ConvertInput, Converter, Format } from '../../core/types.js';

export interface SpreadsheetReadOptions {
  /** Worksheet name or 0-based index. Default: first sheet. */
  sheet?: string | number;
  /** Emit a header row when writing csv/markdown. Default `true`. */
  header?: boolean;
}

type SheetRow = unknown[];

export async function readRows(
  input: ConvertInput,
  options: SpreadsheetReadOptions,
): Promise<{ rows: SheetRow[]; sheetNames: string[] }> {
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
  }) as SheetRow[];

  return { rows, sheetNames: names };
}

/** Rows → records. The first row becomes the header unless disabled. */
export function rowsToRecords(rows: SheetRow[], header = true): Record<string, unknown>[] {
  if (rows.length === 0) return [];
  if (!header) return rows.map((row) => Object.fromEntries(row.map((value, i) => [String(i), value])));

  const [head, ...body] = rows;
  const keys = (head ?? []).map((value, i) => String(value ?? '') || `column_${i + 1}`);
  return body.map((row) => Object.fromEntries(keys.map((key, i) => [key, (row as SheetRow)[i] ?? ''])));
}

/** Header row + body rows as string cells, ready for the shared table renderers. */
function toTableRows(rows: SheetRow[], header: boolean): string[][] {
  const records = rowsToRecords(rows, header);
  const headers = header ? collectHeaders(records) : records.length > 0 ? Object.keys(records[0]!) : [];
  const body = records.map((record) => headers.map((key) => String(record[key] ?? '')));
  return headers.length > 0 ? [headers, ...body] : body;
}

export function makeReadConverters(from: Format): Converter<any>[] {
  return [
    {
      from,
      to: 'csv',
      name: `adapter:${from}->csv`,
      async convert(input: ConvertInput, options: SpreadsheetReadOptions & CsvSerializeOptions = {}) {
        const { rows } = await readRows(input, options);
        const header = options.header ?? true;
        const records = rowsToRecords(rows, header);
        return serializeCsv(records, options, header ? collectHeaders(records) : undefined);
      },
    },
    {
      from,
      to: 'json',
      name: `adapter:${from}->json`,
      async convert(input: ConvertInput, options: SpreadsheetReadOptions = {}) {
        const { rows } = await readRows(input, options);
        return JSON.stringify(rowsToRecords(rows, options.header ?? true), null, 2);
      },
    },
    {
      from,
      to: 'markdown',
      name: `adapter:${from}->markdown`,
      async convert(input: ConvertInput, options: SpreadsheetReadOptions = {}) {
        const { rows } = await readRows(input, options);
        return renderMarkdownTable(toTableRows(rows, options.header ?? true));
      },
    },
    {
      from,
      to: 'html',
      name: `adapter:${from}->html`,
      async convert(input: ConvertInput, options: SpreadsheetReadOptions = {}) {
        const { rows } = await readRows(input, options);
        return renderHtmlTable(toTableRows(rows, options.header ?? true));
      },
    },
    {
      from,
      to: 'text',
      name: `adapter:${from}->text`,
      async convert(input: ConvertInput, options: SpreadsheetReadOptions = {}) {
        const { rows } = await readRows(input, options);
        return rows.map((row) => row.map((value) => String(value ?? '')).join('\t')).join('\n');
      },
    },
  ];
}
