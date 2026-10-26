/**
 * Barrel for the pure-JS converter layer. Used by `src/registry.ts` and by
 * consumers of the internal API; the public surface is re-exported from
 * `src/index.ts` with explicit paths.
 */

export { escapeAttribute, escapeText } from './escape.js';
export { decodeEntities } from './entities.js';

export { markdownToHtml, renderBlocks, renderInline } from './markdown/index.js';
export type { MarkdownToHtmlOptions } from './markdown/index.js';

export { textToHtml } from './text-to-html.js';
export type { TextToHtmlOptions } from './text-to-html.js';

export { textToMarkdown } from './text-to-markdown.js';
export type { TextToMarkdownOptions } from './text-to-markdown.js';

export { htmlToText } from './html-to-text.js';
export type { HtmlToTextOptions } from './html-to-text.js';

export { convertBlocks, htmlToMarkdown, renderInlineMarkdown } from './html-to-markdown/index.js';
export type { HtmlToMarkdownOptions } from './html-to-markdown/index.js';

export { collectHeaders, csvConverters, csvToJsonConverter, csvToTsv, parseCsv, rowsToRecords, serializeCsv, tsvToCsv, tsvToJson } from './csv/index.js';
export type { CsvParseOptions, CsvSerializeOptions } from './csv/index.js';

export {
  csvToHtmlTable,
  csvToMarkdown,
  htmlToCsv,
  jsonToCsv,
  jsonToHtml,
  jsonToMarkdown,
  markdownToCsv,
  parseHtmlTable,
  parseMarkdownTable,
  renderHtmlTable,
  renderMarkdownTable,
  tableConverters,
} from './table/index.js';
export type { TableAlign, TableConvertOptions } from './table/index.js';
