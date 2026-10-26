import type { Block } from './types.js';

/** Plain text → paragraph blocks, one per blank-line separated chunk. */
export function textToBlocks(text: string): Block[] {
  return String(text)
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => ({ type: 'paragraph', text: chunk.replace(/\n/g, ' ') }) as Block);
}
