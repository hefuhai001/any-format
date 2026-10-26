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

/** Registry used by the top-level API. Create your own for isolation. */
export const registry = new ConverterRegistry();

registry.registerAll([markdownToHtml, htmlToText, textToHtml]);

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

export { ConverterRegistry, normalizeFormat };
export { runConversion } from './core/convert.js';
export { ConversionError, UnsupportedConversionError, InvalidInputError, isConversionError } from './core/errors.js';
export type { ErrorCode } from './core/errors.js';
export { detectFormat, detectFromFileName, detectFromMimeType, registerDetector, listDetectors } from './core/detect.js';
export { markdownToHtml, textToHtml, htmlToText, escapeText, escapeAttribute } from './converters/index.js';
export type { MarkdownToHtmlOptions, TextToHtmlOptions, HtmlToTextOptions } from './converters/index.js';
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
