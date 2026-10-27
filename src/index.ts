/**
 * any-format — lightweight, plugin-based document format conversion.
 *
 * ```ts
 * import { convert } from 'any-format';
 * const { data } = await convert('# Hi', 'markdown', 'html');
 * ```
 */

import { canConvert as canConvertWith, runConversion } from './core/convert.js';
import type { ConvertInput, ConvertOptions, ConvertResult, Format } from './core/types.js';
import { registry } from './registry.js';
import { IMAGE_FORMATS, OFFICE_FORMATS, READ_ONLY_FORMATS } from './adapters/index.js';

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
  const formats = new Set<Format>(['markdown', 'html', 'text', 'csv', 'tsv', 'json', ...OFFICE_FORMATS, ...IMAGE_FORMATS]);
  for (const converter of registry.entries()) {
    formats.add(converter.from);
    formats.add(converter.to);
  }
  return [...formats].sort();
}

export { READ_ONLY_FORMATS };

// Registry
export { builtinConverters, registerConverter, registry } from './registry.js';
export { ConverterRegistry, normalizeFormat } from './core/registry.js';
export { runConversion } from './core/convert.js';

// Errors
export { ConversionError, UnsupportedConversionError, InvalidInputError, isConversionError } from './core/errors.js';
export type { ErrorCode } from './core/errors.js';

// Detection
export { detectFormat, detectFromFileName, detectFromMimeType, registerDetector, listDetectors } from './core/detect/index.js';
export type { DetectResult, FormatDetector } from './core/types.js';

// Built-in converters
export { markdownToHtml, renderBlocks, renderInline } from './converters/markdown/index.js';
export { htmlToMarkdown, convertBlocks, renderInlineMarkdown } from './converters/html-to-markdown/index.js';
export { htmlToText } from './converters/html-to-text.js';
export { textToHtml } from './converters/text-to-html.js';
export { textToMarkdown } from './converters/text-to-markdown.js';
export { escapeAttribute, escapeText } from './converters/escape.js';
export { decodeEntities } from './converters/entities.js';
export { collectHeaders, parseCsv, rowsToRecords, serializeCsv } from './converters/csv/index.js';
export { parseHtmlTable, parseMarkdownTable, renderHtmlTable, renderMarkdownTable } from './converters/table/index.js';

// Adapters
export { officeConverters, OFFICE_FORMATS } from './adapters/index.js';
export { convertImage, imageConverters, IMAGE_FORMATS, readImageInfo } from './adapters/index.js';

// Types
export type { CsvParseOptions, CsvSerializeOptions } from './converters/csv/index.js';
export type { TableAlign, TableConvertOptions } from './converters/table/index.js';
export type { HtmlToMarkdownOptions } from './converters/html-to-markdown/index.js';
export type { HtmlToTextOptions } from './converters/html-to-text.js';
export type { MarkdownToHtmlOptions } from './converters/markdown/index.js';
export type { TextToHtmlOptions } from './converters/text-to-html.js';
export type { TextToMarkdownOptions } from './converters/text-to-markdown.js';
export type {
  DocReadOptions,
  DocxReadOptions,
  DocxWriteOptions,
  ImageConvertOptions,
  ImageFormat,
  ImageInfo,
  PdfReadOptions,
  PdfWriteOptions,
  PptxReadOptions,
  PptxWriteOptions,
  SpreadsheetReadOptions,
  SpreadsheetWriteOptions,
} from './adapters/index.js';
export type { ConvertContext, Converter, ConvertInput, ConvertOptions, ConvertResult, Format, TextInput, BinaryInput } from './core/types.js';
