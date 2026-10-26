import { parseCsv } from '../csv/parse.js';
import { serializeCsv, type CsvSerializeOptions } from '../csv/serialize.js';
import { parseHtmlTable, renderHtmlTable } from './html-table.js';
import { parseMarkdownTable, renderMarkdownTable, type TableAlign } from './markdown-table.js';
import { recordsFromJson, recordsFromRows, rowsFromRecords } from './records.js';
import type { Converter } from '../../core/types.js';

export interface TableConvertOptions extends CsvSerializeOptions {
  /** Alignment applied to every column of markdown/HTML output. */
  align?: TableAlign;
  /** Treat the first row as a header. Default `true`. */
  header?: boolean;
}

export const jsonToCsv: Converter<CsvSerializeOptions> = {
  from: 'json',
  to: 'csv',
  name: 'builtin:json->csv',
  convert: (input, options = {}) => {
    const [header, ...body] = rowsFromRecords(recordsFromJson(String(input)));
    if (!header) return '';
    return serializeCsv(
      body.map((row) => Object.fromEntries(header.map((key, i) => [key, row[i]]))),
      options,
      header,
    );
  },
};

export const jsonToMarkdown: Converter<{ align?: TableAlign }> = {
  from: 'json',
  to: 'markdown',
  name: 'builtin:json->markdown',
  convert: (input, options = {}) => renderMarkdownTable(rowsFromRecords(recordsFromJson(String(input))), options.align),
};

export const jsonToHtml: Converter<{ align?: TableAlign }> = {
  from: 'json',
  to: 'html',
  name: 'builtin:json->html',
  convert: (input, options = {}) => renderHtmlTable(rowsFromRecords(recordsFromJson(String(input))), options.align),
};

export const csvToMarkdown: Converter<TableConvertOptions> = {
  from: 'csv',
  to: 'markdown',
  name: 'builtin:csv->markdown',
  convert: (input, options = {}) => renderMarkdownTable(parseCsv(String(input), options), options.align),
};

export const csvToHtmlTable: Converter<TableConvertOptions> = {
  from: 'csv',
  to: 'html',
  name: 'builtin:csv->html',
  convert: (input, options = {}) => renderHtmlTable(parseCsv(String(input), options), options.align),
};

export const markdownToCsv: Converter<CsvSerializeOptions> = {
  from: 'markdown',
  to: 'csv',
  name: 'builtin:markdown->csv',
  convert(input, options = {}) {
    const rows = parseMarkdownTable(String(input));
    const { records, headers } = recordsFromRows(rows);
    return headers.length === 0 ? '' : serializeCsv(records, options, headers);
  },
};

export const htmlToCsv: Converter<CsvSerializeOptions> = {
  from: 'html',
  to: 'csv',
  name: 'builtin:html->csv',
  convert(input, options = {}) {
    const { records, headers } = recordsFromRows(parseHtmlTable(String(input)));
    return headers.length === 0 ? '' : serializeCsv(records, options, headers);
  },
};

export const tableConverters: Converter<any>[] = [
  jsonToCsv,
  jsonToMarkdown,
  jsonToHtml,
  csvToMarkdown,
  csvToHtmlTable,
  markdownToCsv,
  htmlToCsv,
];
