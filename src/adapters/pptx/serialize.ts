import { escapeText } from '../../converters/escape.js';
import type { PptxReadOptions, SlideContent } from './read.js';

export function slidesToText(slides: SlideContent[], options: PptxReadOptions = {}): string {
  const numbering = options.slideNumbers ?? true;
  return slides
    .map((slide) => {
      const header = numbering ? `[Slide ${slide.index}]` : '';
      return [header, ...slide.lines].filter(Boolean).join('\n');
    })
    .join('\n\n');
}

export function slidesToMarkdown(slides: SlideContent[], options: PptxReadOptions = {}): string {
  const numbering = options.slideNumbers ?? true;
  return slides
    .map((slide) => {
      const [title, ...rest] = slide.lines;
      const heading = `## ${numbering ? `${slide.index}. ` : ''}${title ?? 'Untitled'}`;
      return [heading, ...rest.map((line) => `- ${line}`)].join('\n');
    })
    .join('\n\n---\n\n');
}

export function slidesToHtml(slides: SlideContent[]): string {
  return slides
    .map((slide) => {
      const [title, ...rest] = slide.lines;
      const body = rest.map((line) => `<li>${escapeText(line)}</li>`).join('');
      return (
        '<section class="slide">\n' +
        `<h2>${escapeText(title ?? '')}</h2>\n` +
        `${body ? `<ul>${body}</ul>` : ''}\n` +
        '</section>'
      );
    })
    .join('\n');
}
