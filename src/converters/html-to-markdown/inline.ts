import { decodeEntities } from '../entities.js';

const INLINE_PLACEHOLDER = /\u0001INLINE(\d+)\u0001/g;

/** Inline HTML → markdown text (links, images, emphasis, code, entities). */
export function renderInlineMarkdown(html: string): string {
  const codes: string[] = [];

  // Protect <code> content before stripping tags so backticks survive.
  let out = html.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_m, code: string) => {
    codes.push(`\`${decodeEntities(code.replace(/<[^>]+>/g, ''))}\``);
    return `\u0001INLINE${codes.length - 1}\u0001`;
  });

  out = out
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
      const text = label.replace(/<[^>]+>/g, '').trim();
      return text && text !== href ? `[${text}](${href})` : `<${href}>`;
    })
    .replace(/<img\b[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi, (_m, src: string, alt: string) => `![${alt}](${src})`)
    .replace(/<img\b[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']+)["'][^>]*>/gi, (_m, alt: string, src: string) => `![${alt}](${src})`)
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*')
    .replace(/<del\b[^>]*>([\s\S]*?)<\/del>/gi, '~~$1~~')
    .replace(/<mark\b[^>]*>([\s\S]*?)<\/mark>/gi, '==$1==')
    .replace(/<[^>]+>/g, '');

  out = decodeEntities(out);
  return out.replace(INLINE_PLACEHOLDER, (_m, index: string) => codes[Number(index)] ?? '');
}
