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

/** Column order is the union of keys, in first-seen order. */
export function collectHeaders(records: Record<string, unknown>[]): string[] {
  const seen = new Set<string>();
  for (const record of records) for (const key of Object.keys(record)) seen.add(key);
  return [...seen];
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
