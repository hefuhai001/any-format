import type { Converter } from '../core/types.js';

export interface CsvParseOptions {
  /** Field delimiter. Default `,` (TSV uses `\t`). */
  delimiter?: string;
  /** Treat the first row as column names. Default `true`. */
  header?: boolean;
  /** Quote character. Default `"`. */
  quote?: string;
  /** Skip whitespace around unquoted fields. Default `false`. */
  trim?: boolean;
}

export interface CsvSerializeOptions {
  /** Field delimiter. Default `,`. */
  delimiter?: string;
  /** Emit a header row. Default `true`. */
  header?: boolean;
  /** Line ending. Default `\n`. */
  eol?: string;
  /** Always quote every field. Default `false`. */
  quoteAll?: boolean;
}

/** RFC 4180 compliant parser: quoted fields, escaped quotes, embedded newlines, BOM. */
export function parseCsv(source: string, options: CsvParseOptions = {}): string[][] {
  const delimiter = options.delimiter ?? ',';
  const quote = options.quote ?? '"';
  const trim = options.trim ?? false;

  const text = source.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let index = 0;

  const pushField = () => {
    row.push(trim && !inQuotes ? field.trim() : field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    // Ignore fully empty trailing rows produced by a final newline.
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
  };

  while (index < text.length) {
    const char = text[index]!;

    if (inQuotes) {
      if (char === quote) {
        if (text[index + 1] === quote) {
          field += quote;
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }

    if (char === quote && field === '') {
      inQuotes = true;
      index += 1;
      continue;
    }
    if (char === delimiter) {
      pushField();
      index += 1;
      continue;
    }
    if (char === '\n') {
      pushRow();
      index += 1;
      continue;
    }
    if (char === '\r') {
      pushRow();
      index += text[index + 1] === '\n' ? 2 : 1;
      continue;
    }

    field += char;
    index += 1;
  }

  if (field !== '' || row.length > 0) pushRow();
  return rows;
}

/** Convert parsed rows into objects, using the first row as header when enabled. */
export function rowsToRecords(rows: string[][], options: CsvParseOptions = {}): Record<string, string>[] {
  if (rows.length === 0) return [];
  const useHeader = options.header ?? true;
  if (!useHeader) return rows.map((row) => Object.fromEntries(row.map((value, i) => [String(i), value])));

  const [head, ...body] = rows;
  const keys = (head ?? []).map((value, i) => (value === '' ? `column_${i + 1}` : value));
  return body.map((row) => {
    const record: Record<string, string> = {};
    keys.forEach((key, i) => {
      record[key] = row[i] ?? '';
    });
    return record;
  });
}

export function serializeCsv(records: Record<string, unknown>[], options: CsvSerializeOptions = {}, headers?: string[]): string {
  const delimiter = options.delimiter ?? ',';
  const eol = options.eol ?? '\n';
  const emitHeader = options.header ?? true;
  const quoteAll = options.quoteAll ?? false;

  const columns = headers ?? collectHeaders(records);
  const escapeField = (value: unknown): string => {
    const text = value === null || value === undefined ? '' : String(value);
    const needsQuote = quoteAll || text.includes(delimiter) || /["\r\n]/.test(text);
    return needsQuote ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const lines: string[] = [];
  if (emitHeader && columns.length > 0) lines.push(columns.map(escapeField).join(delimiter));
  for (const record of records) {
    lines.push(columns.map((column) => escapeField(record[column])).join(delimiter));
  }
  return lines.join(eol);
}

export function collectHeaders(records: Record<string, unknown>[]): string[] {
  const seen = new Set<string>();
  for (const record of records) for (const key of Object.keys(record)) seen.add(key);
  return [...seen];
}

function csvToJson(input: string, options: CsvParseOptions): string {
  return JSON.stringify(rowsToRecords(parseCsv(input, options), options), null, 2);
}

export const csvToJsonConverter: Converter<CsvParseOptions> = {
  from: 'csv',
  to: 'json',
  name: 'builtin:csv->json',
  convert: (input, options = {}) => csvToJson(String(input), options),
};

export const csvToTsv: Converter<CsvParseOptions & { eol?: string }> = {
  from: 'csv',
  to: 'tsv',
  name: 'builtin:csv->tsv',
  convert(input, options = {}) {
    const records = rowsToRecords(parseCsv(String(input), options), options);
    return serializeCsv(records, { ...options, delimiter: '\t' });
  },
};

export const tsvToCsv: Converter<CsvParseOptions & { eol?: string }> = {
  from: 'tsv',
  to: 'csv',
  name: 'builtin:tsv->csv',
  convert(input, options = {}) {
    const records = rowsToRecords(parseCsv(String(input), { ...options, delimiter: '\t' }), options);
    return serializeCsv(records, { ...options, delimiter: ',' });
  },
};

export const tsvToJson: Converter<CsvParseOptions> = {
  from: 'tsv',
  to: 'json',
  name: 'builtin:tsv->json',
  convert: (input, options = {}) => csvToJson(String(input), { ...options, delimiter: '\t' }),
};
