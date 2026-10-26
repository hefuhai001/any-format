import { normalizeFormat } from './format.js';
import { findPath, type FindPathOptions, type FormatEdges } from './path.js';
import type { Converter, Format } from './types.js';

const key = (from: Format, to: Format) => `${from}->${to}`;

/**
 * Holds every registered converter and answers the graph queries used by `convert()`.
 * A module-level default registry backs the public API, but instances can be created
 * for isolation (tests, multi-tenant servers).
 */
export class ConverterRegistry {
  #converters = new Map<string, Converter<any>[]>();
  #edgeCache?: FormatEdges;

  /** Register a converter. Returns a disposer that removes it again. */
  register<O>(converter: Converter<O>): () => void {
    const from = normalizeFormat(converter.from);
    const to = normalizeFormat(converter.to);
    if (!from || !to) {
      throw new TypeError('Converter requires non-empty "from" and "to" formats');
    }
    if (from === to) {
      throw new TypeError(`Converter must not convert "${from}" to itself`);
    }

    const normalized: Converter<O> = { ...converter, from, to };
    const group = key(from, to);
    const list = this.#converters.get(group) ?? [];
    list.push(normalized);
    list.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    this.#converters.set(group, list);
    this.#edgeCache = undefined;

    return () => {
      const current = this.#converters.get(group);
      if (!current) return;
      const next = current.filter((item) => item !== normalized);
      if (next.length > 0) this.#converters.set(group, next);
      else this.#converters.delete(group);
      this.#edgeCache = undefined;
    };
  }

  registerAll(converters: readonly Converter<any>[]): () => void {
    const disposers = converters.map((converter) => this.register(converter));
    return () => disposers.forEach((dispose) => dispose());
  }

  /** Best (highest priority) converter for a direct pair, or `undefined`. */
  find(from: Format, to: Format): Converter<any> | undefined {
    return this.#converters.get(key(normalizeFormat(from), normalizeFormat(to)))?.[0];
  }

  has(from: Format, to: Format): boolean {
    return this.find(from, to) !== undefined;
  }

  /** All converters registered for a pair, highest priority first. */
  findAll(from: Format, to: Format): readonly Converter<any>[] {
    return this.#converters.get(key(normalizeFormat(from), normalizeFormat(to))) ?? [];
  }

  /** Every target format reachable in one hop from `from`. */
  targets(from: Format): Format[] {
    const source = normalizeFormat(from);
    return this.entries()
      .filter((converter) => converter.from === source)
      .map((converter) => converter.to);
  }

  entries(): Converter<any>[] {
    return [...this.#converters.values()].flat();
  }

  clear(): void {
    this.#converters.clear();
    this.#edgeCache = undefined;
  }

  /** Shortest conversion path between two formats; see `core/path.ts`. */
  findPath(from: Format, to: Format, options: FindPathOptions = {}): Format[] | undefined {
    return findPath(this.edges(), from, to, options);
  }

  /** Human readable listing, mainly for debugging and `listConverters()`. */
  list(): Array<{ from: Format; to: Format; name?: string; priority: number }> {
    return this.entries().map((converter) => ({
      from: converter.from,
      to: converter.to,
      name: converter.name,
      priority: converter.priority ?? 0,
    }));
  }

  /** Cached adjacency list used by the path finder. */
  edges(): FormatEdges {
    if (this.#edgeCache) return this.#edgeCache;

    const edges: FormatEdges = new Map();
    for (const converter of this.entries()) {
      const list = edges.get(converter.from) ?? [];
      if (!list.includes(converter.to)) list.push(converter.to);
      edges.set(converter.from, list);
    }

    this.#edgeCache = edges;
    return edges;
  }
}

export { normalizeFormat };
export { assertPath, findPath } from './path.js';
export type { FindPathOptions, FormatEdges } from './path.js';
