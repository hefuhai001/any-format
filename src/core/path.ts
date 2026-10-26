import { UnsupportedConversionError } from './errors.js';
import { normalizeFormat } from './format.js';
import type { Format } from './types.js';

export interface FindPathOptions {
  /** Intermediate formats allowed when no direct converter exists. `false` disables chaining. */
  via?: Format[] | false;
  /** Max number of hops. Default `2`. */
  maxHops?: number;
}

/** Adjacency list over the format graph: `from -> [to, ...]`. */
export type FormatEdges = Map<Format, Format[]>;

/**
 * Shortest conversion path (BFS). Returns `[from, to]` for a direct hit and
 * `undefined` when unreachable within `maxHops`.
 */
export function findPath(edges: FormatEdges, from: Format, to: Format, options: FindPathOptions = {}): Format[] | undefined {
  const start = normalizeFormat(from);
  const goal = normalizeFormat(to);
  if (start === goal) return [start];
  if (edges.get(start)?.includes(goal)) return [start, goal];
  if (options.via === false) return undefined;

  const maxHops = Math.max(1, options.maxHops ?? 2);
  const allowed = options.via === undefined ? undefined : new Set(options.via.map(normalizeFormat));

  const queue: Format[][] = [[start]];
  const visited = new Set<Format>([start]);

  while (queue.length > 0) {
    const path = queue.shift()!;
    if (path.length - 1 >= maxHops) continue;

    for (const next of edges.get(path[path.length - 1]!) ?? []) {
      if (next === goal) return [...path, next];
      if (visited.has(next)) continue;
      if (allowed && !allowed.has(next)) continue;
      visited.add(next);
      queue.push([...path, next]);
    }
  }

  return undefined;
}

/** Like `findPath` but throws `UnsupportedConversionError` instead of returning `undefined`. */
export function assertPath(edges: FormatEdges, from: Format, to: Format, options?: FindPathOptions): Format[] {
  const path = findPath(edges, from, to, options);
  if (!path) {
    throw new UnsupportedConversionError(
      normalizeFormat(from),
      normalizeFormat(to),
      options?.via ? 'no path through the allowed intermediate formats' : 'no direct or chained converter registered',
    );
  }
  return path;
}
