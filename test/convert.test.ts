import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ConverterRegistry,
  UnsupportedConversionError,
  canConvert,
  convert,
  detectFormat,
  registerConverter,
  registry,
  runConversion,
} from '../src/index.js';

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
    const html = await text('a <b> & c\n\nnext', 'text', 'html');
    assert.equal(html, '<p>a &lt;b&gt; &amp; c</p>\n<p>next</p>');
  });

  it('extracts readable text from html', async () => {
    const plain = await text('<h2>Hi</h2><p>a <strong>b</strong><br>c</p><ul><li>x</li></ul>', 'html', 'text');
    assert.match(plain, /^## Hi/);
    assert.match(plain, /a b\nc/);
    assert.match(plain, /- x/);
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
});

describe('registry', () => {
  it('prefers higher priority converters and supports disposal', async () => {
    const local = new ConverterRegistry();
    local.register({ from: 'text', to: 'html', name: 'low', convert: () => '<low>' });
    const dispose = local.register({ from: 'text', to: 'html', name: 'high', priority: 10, convert: () => '<high>' });

    assert.equal((await runConversion(local, 'x', 'text', 'html')).data, '<high>');

    dispose();
    assert.equal((await runConversion(local, 'x', 'text', 'html')).data, '<low>');
  });

  it('registers custom converters globally', async () => {
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

describe('errors and cancellation', () => {
  it('throws UnsupportedConversionError with formats attached', async () => {
    await assert.rejects(
      () => convert('x', 'pdf', 'markdown'),
      (error: unknown) => error instanceof UnsupportedConversionError && error.from === 'pdf' && error.to === 'markdown',
    );
  });

  it('wraps converter failures', async () => {
    const local = new ConverterRegistry();
    local.register({ from: 'a', to: 'b', convert: () => { throw new Error('boom'); } });
    await assert.rejects(() => runConversion(local, 'x', 'a', 'b'), /boom/);
  });

  it('respects an aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(() => convert('# x', 'markdown', 'html', { signal: controller.signal }), /aborted/);
  });

  it('validates input type', async () => {
    // @ts-expect-error intentional invalid input
    await assert.rejects(() => convert(42, 'markdown', 'html'), /string or Uint8Array/);
  });
});

describe('detection', () => {
  it('detects markdown, html, json', () => {
    assert.equal(detectFormat('# Title\n\n- a\n- b\n\n**bold**').format, 'markdown');
    assert.equal(detectFormat('<!doctype html><html></html>').format, 'html');
    assert.equal(detectFormat('{"a":1}').format, 'json');
    assert.equal(detectFormat('just some words').format, 'text');
  });
});
