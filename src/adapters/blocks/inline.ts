import type { InlineRun } from './types.js';

/** Strip inline markers for formats that cannot express them (plain-text targets). */
export function cleanInline(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, '$1 ($2)')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

/** Tokenize inline emphasis so writers can emit styled runs. */
export function parseInlineRuns(text: string): InlineRun[] {
  const runs: InlineRun[] = [];
  const pattern = /(\*\*|__)(.+?)\1|(\*|_)(.+?)\3|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > last) runs.push({ text: text.slice(last, match.index) });
    if (match[2] !== undefined) runs.push({ text: match[2], bold: true });
    else if (match[4] !== undefined) runs.push({ text: match[4], italic: true });
    else if (match[5] !== undefined) runs.push({ text: match[5], code: true });
    else if (match[6] !== undefined) runs.push({ text: `${match[6]} (${match[7]})` });
    last = match.index + match[0].length;
  }

  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs.length > 0 ? runs : [{ text }];
}
