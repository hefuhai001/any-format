import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConverterRegistry, normalizeFormat } from '../../src/core/registry.js';
import { UnsupportedConversionError, isConversionError } from '../../src/core/errors.js';
import type { Converter } from '../../src/core/types.js';

const stub = (from: string, to: string, value = `${from}->${to}`): Converter<undefined> => ({
  from,
  to,
  convert: () => value,
});

describe('ConverterRegistry registration', () => {
  it('normalizes format names on registration and lookup', () => {
    const registry = new ConverterRegistry();
    registry.register(stub('MD', 'HTML'));

    assert.ok(registry.has('md', 'html'));
    assert.ok(registry.has('  Md ', ' Html '));
    assert.equal(registry.find('md', 'html')!.from, 'md');
  });

  it('rejects empty and self-referencing converters', () => {
    const registry = new ConverterRegistry();
    assert.throws(() => registry.register(stub('', 'html')), /non-empty/);
    assert.throws(() => registry.register(stub('text', ' text ')), /to itself/);
  });

  it('sorts converters of the same pair by descending priority', () => {
    const registry = new ConverterRegistry();
    registry.register({ ...stub('a', 'b', 'low'), priority: 1 });
    registry.register({ ...stub('a', 'b', 'mid'), priority: 5 });
    registry.register({ ...stub('a', 'b', 'high'), priority: 10 });

    assert.deepEqual(
      registry.findAll('a', 'b').map((converter) => converter.convert('', undefined, undefined as never)),
      ['high', 'mid', 'low'],
    );
    assert.equal(registry.find('a', 'b')!.priority, 10);
    assert.equal(registry.list()[0]!.priority, 10);
  });

  it('treats missing priority as 0', () => {
    const registry = new ConverterRegistry();
    registry.register(stub('a', 'b'));
    assert.equal(registry.list()[0]!.priority, 0);
  });

  it('removes a converter through its disposer and drops empty groups', () => {
    const registry = new ConverterRegistry();
    const dispose = registry.register(stub('a', 'b'));

    assert.equal(registry.has('a', 'b'), true);
    dispose();

    assert.equal(registry.has('a', 'b'), false);
    assert.deepEqual(registry.findAll('a', 'b'), []);
    // Disposing twice is a no-op.
    dispose();
    assert.deepEqual(registry.entries(), []);
  });

  it('keeps siblings when one of several converters is disposed', () => {
    const registry = new ConverterRegistry();
    const first = registry.register({ ...stub('a', 'b', 'first'), priority: 2 });
    registry.register({ ...stub('a', 'b', 'second'), priority: 1 });

    first();
    assert.equal(registry.findAll('a', 'b').length, 1);
    assert.equal(registry.find('a', 'b')!.priority, 1);
  });

  it('registerAll returns a disposer that removes every converter', () => {
    const registry = new ConverterRegistry();
    const dispose = registry.registerAll([stub('a', 'b'), stub('b', 'c'), stub('c', 'd')]);

    assert.equal(registry.entries().length, 3);
    dispose();
    assert.equal(registry.entries().length, 0);
  });

  it('reports one-hop targets and clears the whole registry', () => {
    const registry = new ConverterRegistry();
    registry.registerAll([stub('a', 'b'), stub('a', 'c'), stub('c', 'd')]);

    assert.deepEqual(registry.targets('A').sort(), ['b', 'c']);
    assert.deepEqual(registry.targets('nope'), []);

    registry.clear();
    assert.deepEqual(registry.list(), []);
    assert.equal(registry.has('a', 'b'), false);
  });

  it('lists converters with their metadata', () => {
    const registry = new ConverterRegistry();
    registry.register({ from: 'a', to: 'b', name: 'named', priority: 3, convert: () => '' });

    assert.deepEqual(registry.list(), [{ from: 'a', to: 'b', name: 'named', priority: 3 }]);
  });
});

describe('ConverterRegistry path search', () => {
  const build = () => {
    const registry = new ConverterRegistry();
    registry.registerAll([stub('a', 'b'), stub('b', 'c'), stub('c', 'd'), stub('a', 'e'), stub('e', 'd'), stub('x', 'y')]);
    return registry;
  };

  it('returns the trivial path for identical formats', () => {
    assert.deepEqual(build().findPath('a', 'a'), ['a']);
  });

  it('returns the direct pair first', () => {
    const registry = new ConverterRegistry();
    registry.registerAll([stub('a', 'b'), stub('a', 'c'), stub('c', 'b')]);
    assert.deepEqual(registry.findPath('a', 'b'), ['a', 'b']);
  });

  it('finds the shortest multi-hop path', () => {
    assert.deepEqual(build().findPath('a', 'c'), ['a', 'b', 'c']);
  });

  it('respects maxHops', () => {
    assert.deepEqual(build().findPath('a', 'c', { maxHops: 1 }), undefined);
    assert.deepEqual(build().findPath('a', 'c', { maxHops: 2 }), ['a', 'b', 'c']);
  });

  it('never routes through disallowed nodes when via is given', () => {
    const registry = build();
    // a -> b -> c -> d needs c as an intermediate node.
    assert.deepEqual(registry.findPath('a', 'd', { via: ['b', 'c'], maxHops: 3 }), ['a', 'b', 'c', 'd']);
    // Allowing only `e` permits the 2-hop route a -> e -> d.
    assert.deepEqual(registry.findPath('a', 'd', { via: ['e'], maxHops: 3 }), ['a', 'e', 'd']);
    assert.equal(registry.findPath('a', 'd', { via: ['unknown'], maxHops: 3 }), undefined);
  });

  it('disables chaining entirely with via: false', () => {
    const registry = build();
    assert.deepEqual(registry.findPath('a', 'c', { via: false }), undefined);
    assert.deepEqual(registry.findPath('a', 'b', { via: false }), ['a', 'b']);
  });

  it('does not revisit nodes on cycles', () => {
    const registry = new ConverterRegistry();
    registry.registerAll([stub('a', 'b'), stub('b', 'a'), stub('b', 'c')]);
    assert.deepEqual(registry.findPath('a', 'c', { maxHops: 10 }), ['a', 'b', 'c']);
  });

  it('returns undefined when the graph is disconnected', () => {
    assert.equal(build().findPath('a', 'y'), undefined);
    assert.equal(build().findPath('y', 'a'), undefined);
  });

  it('exposes a cached adjacency list', () => {
    const registry = build();
    const first = registry.edges();
    assert.equal(registry.edges(), first, 'edges() should be memoized');
    assert.deepEqual(first.get('a')!.sort(), ['b', 'e']);

    registry.register(stub('a', 'z'));
    assert.notEqual(registry.edges(), first, 'register() should invalidate the cache');
  });

  it('invalidates the edge cache on disposal and clear', () => {
    const registry = new ConverterRegistry();
    const dispose = registry.register(stub('a', 'b'));
    const before = registry.edges();

    dispose();
    assert.notEqual(registry.edges(), before);

    registry.register(stub('a', 'b'));
    const afterRegister = registry.edges();
    registry.clear();
    assert.notEqual(registry.edges(), afterRegister);
  });
});

describe('normalizeFormat', () => {
  it('trims and lower-cases', () => {
    assert.equal(normalizeFormat('  PDF '), 'pdf');
    assert.equal(normalizeFormat('Markdown'), 'markdown');
  });
});

describe('UnsupportedConversionError', () => {
  it('carries both formats and a helpful message', () => {
    const error = new UnsupportedConversionError('pdf', 'xlsx');

    assert.equal(error.code, 'UNSUPPORTED_CONVERSION');
    assert.equal(error.name, 'UnsupportedConversionError');
    assert.equal(error.from, 'pdf');
    assert.equal(error.to, 'xlsx');
    assert.match(error.message, /Cannot convert "pdf" to "xlsx"/);
    assert.match(error.message, /registerConverter\(\)/);
    assert.equal(isConversionError(error), true);
  });
});
