import { collectHeaders } from '../csv/serialize.js';

export type TableRecord = Record<string, unknown>;

/** Normalize JSON input (array of objects, array of arrays, or a single object). */
export function recordsFromJson(input: unknown): TableRecord[] {
  const data = typeof input === 'string' ? JSON.parse(input) : input;
  if (!Array.isArray(data)) {
    if (data && typeof data === 'object') return [data as TableRecord];
    throw new TypeError('JSON table conversion expects an array of objects');
  }
  return data.map((row) =>
    Array.isArray(row) ? Object.fromEntries(row.map((value, index) => [String(index), value])) : (row as TableRecord),
  );
}

/** First row becomes the header; empty cells fall back to `column_N`. */
export function recordsFromRows(rows: string[][], header = true): { records: TableRecord[]; headers: string[] } {
  if (rows.length === 0) return { records: [], headers: [] };

  if (!header) {
    const headers = rows[0]!.map((_value, index) => String(index));
    return { records: rows.map((row) => Object.fromEntries(headers.map((key, i) => [key, row[i] ?? '']))), headers };
  }

  const [head, ...body] = rows;
  const headers = (head ?? []).map((value, i) => value || `column_${i + 1}`);
  return {
    records: body.map((row) => Object.fromEntries(headers.map((key, i) => [key, row[i] ?? '']))),
    headers,
  };
}

/** Records → rows, prepending the header row when requested. */
export function rowsFromRecords(records: TableRecord[], headers?: string[]): string[][] {
  const columns = headers ?? collectHeaders(records);
  return [columns, ...records.map((record) => columns.map((column) => String(record[column] ?? '')))];
}
