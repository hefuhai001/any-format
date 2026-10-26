/**
 * format-conversion — lightweight, plugin-based document format conversion.
 *
 * ```ts
 * import { convert } from 'format-conversion';
 * const { data } = await convert('# Hi', 'markdown', 'html');
 * ```
 */

import { canConvert as canConvertWith, runConversion } from './core/convert.js';
import { ConverterRegistry, normalizeFormat } from './core/registry.js';
import type { ConvertInput, ConvertOptions, ConvertResult, Converter, Format } from './core/types.js';
import { markdownToHtml } from './converters/markdown-to-html.js';
import { htmlToText } from './converters/html-to-text.js';
import { textToHtml } from './converters/text-to-html.js';
import { textToMarkdown } from './converters/text-to-markdown.js';
import { htmlToMarkdown } from './converters/html-to-markdown.js';
import { csvToJsonConverter, csvToTsv, tsvToCsv, tsvToJson } from './converters/csv.js';
import { csvToHtmlTable, csvToMarkdown, htmlToCsv, jsonToCsv, jsonToHtml, jsonToMarkdown, markdownToCsv } from './converters/table.js';
import { officeConverters, OFFICE_FORMATS, READ_ONLY_FORMATS } from './adapters/index.js';

/** Registry used by the top-level API. Create your own for isolation. */
export const registry = new ConverterRegistry();

/** Pure-JS text converters: always available, zero dependencies. */
export const builtinConverters: Converter<any>[] = [
  markdownToHtml,
  htmlToMarkdown,
  htmlToText,
  textToHtml,
  textToMarkdown,
  csvToJsonConverter,
  csvToTsv,
  tsvToCsv,
  tsvToJson,
  jsonToCsv,
  jsonToMarkdown,
  jsonToHtml,
  csvToMarkdown,
  csvToHtmlTable,
  markdownToCsv,
  htmlToCsv,
];

registry.registerAll([...builtinConverters, ...officeConverters]);

/** Register a converter on the default registry. Returns a disposer. */
export function registerConverter<O>(converter: Converter<O>): () => void {
  return registry.register(converter);
}

/** Convert `input` from one format to another, chaining converters when needed. */
export function convert(input: ConvertInput, from: Format, to: Format, options?: ConvertOptions): Promise<ConvertResult> {
  return runConversion(registry, input, from, to, options);
}

/** Whether a conversion path exists (direct or chained). */
export function canConvert(from: Format, to: Format, options?: { via?: Format[] | false; maxHops?: number }): boolean {
  return canConvertWith(registry, from, to, options);
}

/** All registered converter pairs. */
export function listConverters(): Array<{ from: Format; to: Format; name?: string; priority: number }> {
  return registry.list();
}

/** Every format the library knows about, including optional ones. */
export function listFormats(): Format[] {
  const formats = new Set<Format>(['markdown', 'html', 'text', 'csv', 'tsv', 'json', ...OFFICE_FORMATS]);
  for (const converter of registry.entries()) {
    formats.add(converter.from);
    formats.add(converter.to);
  }
  return [...formats].sort();
}

/** Formats that can only be read (no writer available in pure JS). */
export { READ_ONLY_FORMATS };

export { ConverterRegistry, normalizeFormat };
export { runConversion } from './core/convert.js';
export { ConversionError, UnsupportedConversionError, InvalidInputError, isConversionError } from './core/errors.js';
export type { ErrorCode } from './core/errors.js';
export { detectFormat, detectFromFileName, detectFromMimeType, registerDetector, listDetectors } from './core/detect.js';
export { markdownToHtml, textToHtml, htmlToText, htmlToMarkdown, escapeText, escapeAttribute } from './converters/index.js';
export { parseCsv, rowsToRecords, serializeCsv, collectHeaders } from './converters/csv.js';
export type { CsvParseOptions, CsvSerializeOptions } from './converters/csv.js';
export { parseMarkdownTable, parseHtmlTable } from './converters/table.js';
export type { MarkdownToHtmlOptions, TextToHtmlOptions, HtmlToTextOptions, HtmlToMarkdownOptions } from './converters/index.js';
export type {
  ConvertInput,
  ConvertOptions,
  ConvertResult,
  ConvertContext,
  Converter,
  DetectResult,
  Format,
  FormatDetector,
  TextInput,
  BinaryInput,
} from './core/types.js';
export { officeConverters, OFFICE_FORMATS } from './adapters/index.js';
export type { DocxReadOptions, DocxWriteOptions, DocReadOptions, PdfReadOptions, PdfWriteOptions, PptxReadOptions, PptxWriteOptions, SpreadsheetReadOptions, SpreadsheetWriteOptions } from './adapters/index.js';
