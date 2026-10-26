import { asBuffer, optionalImport } from './loader.js';
import { ConversionError } from '../core/errors.js';
import type { ConvertInput, Converter } from '../core/types.js';

export interface DocReadOptions {
  /** Include headers/footers in the extracted text. Default `false`. */
  includeHeadersAndFooters?: boolean;
}

/**
 * Legacy Word `.doc` (OLE2/CFB) support is read-only: the binary format has no
 * practical writer in pure JavaScript. Convert `docx` or `pdf` for output.
 */
export const docConverters: Converter<any>[] = [
  {
    from: 'doc',
    to: 'text',
    name: 'adapter:doc->text',
    async convert(input: ConvertInput, options: DocReadOptions = {}) {
      const mod = await optionalImport('word-extractor', 'word-extractor reads legacy .doc files');
      const WordExtractor = mod.default ?? mod;
      const buffer = asBuffer(input, 'doc');

      const extractor = new WordExtractor();
      const document = await extractor.extract(buffer);

      const parts = [document.getBody()];
      if (options.includeHeadersAndFooters) {
        parts.push(document.getHeaders({ includeFooters: true }));
      }

      return parts
        .filter((part): part is string => typeof part === 'string')
        .join('\n\n')
        .replace(/\r\n?/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    },
  },
  {
    from: 'text',
    to: 'doc',
    name: 'adapter:text->doc',
    convert() {
      throw new ConversionError(
        'Writing legacy .doc is not supported: the binary format has no practical pure-JS writer. ' +
          'Convert to "docx" instead, or use LibreOffice (`libreoffice --headless --convert-to doc`) as an external backend.',
        'UNSUPPORTED_CONVERSION',
      );
    },
  },
  {
    from: 'docx',
    to: 'doc',
    name: 'adapter:docx->doc',
    convert() {
      throw new ConversionError(
        'Converting .docx to legacy .doc requires an external backend. ' +
          'Use LibreOffice: `libreoffice --headless --convert-to doc file.docx`.',
        'UNSUPPORTED_CONVERSION',
      );
    },
  },
];
