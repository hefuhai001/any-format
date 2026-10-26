import { readSlides } from './read.js';
import { slidesToHtml, slidesToMarkdown, slidesToText } from './serialize.js';
import { makeWriteConverters } from './write.js';
import type { ConvertInput, Converter } from '../../core/types.js';

export type { PptxReadOptions, SlideContent } from './read.js';
export type { PptxWriteOptions } from './write.js';
export { decodeXml, extractParagraphs, readSlides } from './read.js';
export { slidesToHtml, slidesToMarkdown, slidesToText } from './serialize.js';
export { blocksToSlides, writePptx } from './write.js';

export const pptxConverters: Converter<any>[] = [
  {
    from: 'pptx',
    to: 'text',
    name: 'adapter:pptx->text',
    async convert(input: ConvertInput, options: Parameters<typeof readSlides>[1] = {}) {
      return slidesToText(await readSlides(input, options), options);
    },
  },
  {
    from: 'pptx',
    to: 'markdown',
    name: 'adapter:pptx->markdown',
    async convert(input: ConvertInput, options: Parameters<typeof readSlides>[1] = {}) {
      return slidesToMarkdown(await readSlides(input, options), options);
    },
  },
  {
    from: 'pptx',
    to: 'html',
    name: 'adapter:pptx->html',
    async convert(input: ConvertInput, options: Parameters<typeof readSlides>[1] = {}) {
      return slidesToHtml(await readSlides(input, options));
    },
  },
  ...makeWriteConverters(),
];
