import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ConverterRegistry,
  ConversionError,
  UnsupportedConversionError,
  canConvert,
  convert,
  detectFormat,
  registerConverter,
  registry,
  runConversion,
} from '../../src/index.js';
import type { ConvertContext } from '../../src/core/types.js';

const text = async (input: Parameters<typeof convert>[0], from: string, to: string, options?: Parameters<typeof convert>[3]) =>
  (await convert(input, from, to, options)).data as string;

describe('direct conversions', () => {
  it('renders markdown headings, lists, code and inline styles', async () => {
    const html = await text('# Title\n\n- one\n- **two**\n\n```js\nconst a = 1;\n```\n\n[link](https://example.com)', 'markdown', 'html');
    assert.match(html, /<h1>Title<\/h1>/);
    assert.match(html, /<ul>\n<li>one<\/li>\n<li><strong>two<\/strong><\/li>\n<\/ul>/);
    assert.match(html, /<pre><code class="language-js">const a = 1;\n<\/code><\/pre>/);
    assert.match(html, /<a href="https:\/\/example.com">link<\/a>/);
  });

  it('escapes markup when converting plain text to html', async () => {
    assert.equal(await text('a <b> & c\n\nnext', 'text', 'html'), '<p>a &lt;b&gt; &amp; c</p>\n<p>next</p>');
  });

  it('extracts readable text from html', async () => {
    const plain = await text('<h2>Hi</h2><p>a <strong>b</strong><br>c</p><ul><li>x</li></ul>', 'html', 'text');
    assert.match(plain, /^## Hi/);
    assert.match(plain, /a b\nc/);
    assert.match(plain, /- x/);
  });

  it('normalizes format names and returns the resolved path', async () => {
    const result = await convert('# T', 'MARKDOWN', '  Html ');
    assert.deepEqual(result.path, ['markdown', 'html']);
    assert.equal(result.from, 'markdown');
    assert.equal(result.to, 'html');
  });
});

describe('chained conversions', () => {
  it('converts markdown to text through html', async () => {
    const result = await convert('# Title\n\nHello **world**', 'markdown', 'text');
    assert.deepEqual(result.path, ['markdown', 'html', 'text']);
    assert.match(result.data as string, /# Title/);
    assert.match(result.data as string, /Hello world/);
  });

  it('rejects chains longer than maxHops', async () => {
    await assert.rejects(() => convert('# x', 'markdown', 'text', { maxHops: 1 }), UnsupportedConversionError);
  });

  it('honours via: false', async () => {
    assert.equal(canConvert('markdown', 'text'), true);
    assert.equal(canConvert('markdown', 'text', { via: false }), false);
  });

  it('honours a via allow-list', async () => {
    assert.equal(canConvert('markdown', 'text', { via: ['html'] }), true);
    assert.equal(canConvert('markdown', 'text', { via: ['csv'] }), false);
  });

  it('rejects unsupported conversions with a typed error', async () => {
    await assert.rejects(
      () => convert('x', 'unknown-src', 'markdown'),
      (error: unknown) =>
        error instanceof UnsupportedConversionError && error.from === 'unknown-src' && error.to === 'markdown',
    );
  });
});

describe('converter context', () => {
  it('passes the step source and the final target', async () => {
    const local = new ConverterRegistry();
    const seen: Array<Pick<ConvertContext, 'from' | 'target'>> = [];

    local.register({
      from: 'a',
      to: 'b',
      convert: (_input, _options, ctx) => {
        seen.push({ from: ctx.from, target: ctx.target });
        return 'middle';
      },
    });
    local.register({
      from: 'b',
      to: 'c',
      convert: (_input, _options, ctx) => {
        seen.push({ from: ctx.from, target: ctx.target });
        return 'done';
      },
    });

    await runConversion(local, 'start', 'a', 'c');
    assert.deepEqual(seen, [
      { from: 'a', target: 'c' },
      { from: 'b', target: 'c' },
    ]);
  });

  it('threads converterOptions through every hop', async () => {
    const local = new ConverterRegistry();
    const received: unknown[] = [];

    local.register({
      from: 'a',
      to: 'b',
      convert: (_input, options) => {
        received.push(options);
        return 'x';
      },
    });
    local.register({
      from: 'b',
      to: 'c',
      convert: (_input, options) => {
        received.push(options);
        return 'y';
      },
    });

    await runConversion(local, 'start', 'a', 'c', { converterOptions: { flag: true } });
    assert.deepEqual(received, [{ flag: true }, { flag: true }]);
  });

  it('supports converters that return binary data', async () => {
    const local = new ConverterRegistry();
    local.register({ from: 'text', to: 'bin', convert: () => new Uint8Array([1, 2, 3]) });

    const result = await runConversion(local, 'x', 'text', 'bin');
    assert.ok(result.data instanceof Uint8Array);
    assert.deepEqual([...(result.data as Uint8Array)], [1, 2, 3]);
  });

  it('supports async converters', async () => {
    const local = new ConverterRegistry();
    local.register({ from: 'text', to: 'upper', convert: async (input) => String(input).toUpperCase() });

    assert.equal((await runConversion(local, 'abc', 'text', 'upper')).data, 'ABC');
  });
});

describe('errors and cancellation', () => {
  it('wraps converter failures and keeps the cause', async () => {
    const local = new ConverterRegistry();
    const boom = new Error('boom');
    local.register({
      from: 'a',
      to: 'b',
      convert: () => {
        throw boom;
      },
    });

    await assert.rejects(
      () => runConversion(local, 'x', 'a', 'b'),
      (error: unknown) =>
        error instanceof ConversionError && error.code === 'CONVERTER_FAILED' && error.cause === boom,
    );
  });

  it('passes library errors through untouched', async () => {
    const local = new ConverterRegistry();
    local.register({
      from: 'a',
      to: 'b',
      convert: () => {
        throw new UnsupportedConversionError('x', 'y');
      },
    });

    await assert.rejects(() => runConversion(local, 'x', 'a', 'b'), UnsupportedConversionError);
  });

  it('names the failing converter in the message', async () => {
    const local = new ConverterRegistry();
    local.register({
      from: 'a',
      to: 'b',
      name: 'my-converter',
      convert: () => {
        throw new Error('nope');
      },
    });

    await assert.rejects(() => runConversion(local, 'x', 'a', 'b'), /my-converter.*nope/);
  });

  it('respects an already-aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(() => convert('# x', 'markdown', 'html', { signal: controller.signal }), /aborted/);
  });

  it('aborts between hops', async () => {
    const local = new ConverterRegistry();
    const controller = new AbortController();

    local.register({
      from: 'a',
      to: 'b',
      convert: () => {
        controller.abort();
        return 'x';
      },
    });
    local.register({ from: 'b', to: 'c', convert: () => 'y' });

    await assert.rejects(
      () => runConversion(local, 'start', 'a', 'c', { signal: controller.signal }),
      (error: unknown) => error instanceof ConversionError && error.code === 'ABORTED',
    );
  });

  it('reports a converter that disappears mid-flight', async () => {
    const local = new ConverterRegistry();
    let disposeB: () => void = () => {};

    local.register({
      from: 'a',
      to: 'b',
      convert: () => {
        disposeB();
        return 'x';
      },
    });
    disposeB = local.register({ from: 'b', to: 'c', convert: () => 'y' });

    assert.equal(local.findPath('a', 'c')!.length, 3);
    await assert.rejects(() => runConversion(local, 'start', 'a', 'c'), /disappeared/);
  });

  it('validates input types', async () => {
    // @ts-expect-error intentional invalid input
    await assert.rejects(() => convert(42, 'markdown', 'html'), /string or Uint8Array/);
    // @ts-expect-error intentional invalid input
    await assert.rejects(() => convert(null, 'markdown', 'html'), /received null/);
  });

  it('validates the value returned by a converter', async () => {
    const local = new ConverterRegistry();
    local.register({
      from: 'a',
      to: 'b',
      // @ts-expect-error intentionally returning a non-payload
      convert: () => 123,
    });

    await assert.rejects(() => runConversion(local, 'x', 'a', 'b'), /string or Uint8Array/);
  });
});

describe('default registry', () => {
  it('prefers higher priority converters and supports disposal', async () => {
    const local = new ConverterRegistry();
    local.register({ from: 'text', to: 'html', name: 'low', convert: () => '<low>' });
    const dispose = local.register({ from: 'text', to: 'html', name: 'high', priority: 10, convert: () => '<high>' });

    assert.equal((await runConversion(local, 'x', 'text', 'html')).data, '<high>');
    dispose();
    assert.equal((await runConversion(local, 'x', 'text', 'html')).data, '<low>');
  });

  it('registers custom converters globally and removes them', async () => {
    const dispose = registerConverter<string>({
      from: 'text',
      to: 'upper',
      convert: (input, _options, ctx) => {
        ctx.throwIfAborted();
        return String(input).toUpperCase();
      },
    });

    assert.equal(await text('abc', 'text', 'upper'), 'ABC');
    dispose();
    assert.equal(canConvert('text', 'upper'), false);
    assert.equal(registry.has('text', 'upper'), false);
  });

  it('rejects invalid converters', () => {
    const local = new ConverterRegistry();
    assert.throws(() => local.register({ from: 'text', to: 'text', convert: () => '' }), TypeError);
  });
});

describe('detection re-export', () => {
  it('detects through the public API', () => {
    assert.equal(detectFormat('# Title\n\n- a\n- b\n\n**bold**').format, 'markdown');
    assert.equal(detectFormat('<!doctype html><html></html>').format, 'html');
    assert.equal(detectFormat('{"a":1}').format, 'json');
    assert.equal(detectFormat('just some words').format, 'text');
  });
});
