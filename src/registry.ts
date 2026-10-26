import { ConverterRegistry } from './core/registry.js';
import type { Converter } from './core/types.js';
import { officeConverters } from './adapters/index.js';
import { htmlToText } from './converters/html-to-text.js';
import { htmlToMarkdown } from './converters/html-to-markdown/index.js';
import { markdownToHtml } from './converters/markdown/index.js';
import { textToHtml } from './converters/text-to-html.js';
import { textToMarkdown } from './converters/text-to-markdown.js';
import { csvConverters } from './converters/csv/index.js';
import { tableConverters } from './converters/table/index.js';

/** Pure-JS text/table converters: always available, zero dependencies. */
export const builtinConverters: Converter<any>[] = [
  markdownToHtml,
  htmlToMarkdown,
  htmlToText,
  textToHtml,
  textToMarkdown,
  ...csvConverters,
  ...tableConverters,
];

/** Registry used by the top-level API. Create your own for isolation. */
export const registry = new ConverterRegistry();

registry.registerAll([...builtinConverters, ...officeConverters]);

/** Register a converter on the default registry. Returns a disposer. */
export function registerConverter<O>(converter: Converter<O>): () => void {
  return registry.register(converter);
}
