import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  READ_ONLY_FORMATS,
  canConvert,
  convert,
  listConverters,
  listFormats,
  registerConverter,
  registry,
} from '../src/index.js';

const asText = async (input: string | Uint8Array, from: string, to: string, options?: Parameters<typeof convert>[3]) =>
  (await convert(input, from, to, options)).data as string;

const asBinary = async (input: string | Uint8Array, from: string, to: string) =>
  (await convert(input, from, to)).data as Uint8Array;

describe('public API surface', () => {
  it('lists every known format', () => {
    const formats = listFormats();

    for (const format of ['markdown', 'html', 'text', 'csv', 'tsv', 'json', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'pdf']) {
      assert.ok(formats.includes(format), `missing format: ${format}`);
    }
    assert.deepEqual(formats, [...formats].sort(), 'formats should be sorted');
    assert.equal(new Set(formats).size, formats.length, 'formats should be unique');
  });

  it('lists registered converters with metadata', () => {
    const pairs = listConverters();

    assert.ok(pairs.some((pair) => pair.from === 'markdown' && pair.to === 'html'));
    assert.ok(pairs.some((pair) => pair.from === 'docx' && pair.to === 'html'));

    for (const pair of pairs) {
      assert.equal(typeof pair.from, 'string');
      assert.equal(typeof pair.to, 'string');
      assert.equal(typeof pair.priority, 'number');
    }
  });

  it('exposes read-only formats', () => {
    assert.deepEqual([...READ_ONLY_FORMATS].sort(), ['doc', 'pdf']);
  });

  it('keeps the default registry populated', () => {
    assert.ok(registry.entries().length > 20);
  });
});

describe('conversion matrix', () => {
  const textFormats = ['markdown', 'html', 'text', 'csv', 'tsv', 'json'];
  const officeFormats = ['docx', 'xlsx', 'xls', 'pptx', 'pdf'];

  it('connects every text-format pair within 3 hops', () => {
    for (const from of textFormats) {
      for (const to of textFormats) {
        if (from === to) continue;
        assert.equal(canConvert(from, to, { maxHops: 3 }), true, `${from} -> ${to}`);
      }
    }
  });

  it('reaches every office format from markdown', () => {
    for (const to of [...officeFormats, 'doc']) {
      assert.equal(canConvert('markdown', to, { maxHops: 3 }), true, `markdown -> ${to}`);
    }
  });

  it('reaches text formats from every office format', () => {
    for (const from of officeFormats) {
      for (const to of ['markdown', 'text']) {
        assert.equal(canConvert(from, to, { maxHops: 3 }), true, `${from} -> ${to}`);
      }
    }
  });

  it('does not invent conversions for unknown formats', () => {
    assert.equal(canConvert('markdown', 'unknown-target'), false);
    assert.equal(canConvert('unknown-source', 'markdown'), false);
  });
});

describe('round trips', () => {
  it('markdown -> html -> markdown keeps structure', async () => {
    const source = '# Title\n\nA **bold** paragraph.\n\n- one\n- two';
    const html = await asText(source, 'markdown', 'html');
    const back = await asText(html, 'html', 'markdown');

    assert.match(back, /^# Title/m);
    assert.match(back, /\*\*bold\*\*/);
    assert.match(back, /^- one$/m);
    assert.match(back, /^- two$/m);
  });

  it('markdown -> docx -> markdown keeps headings and lists', async () => {
    const docx = await asBinary('# Report\n\n- a\n- b', 'markdown', 'docx');
    const back = await asText(docx, 'docx', 'markdown');

    assert.match(back, /# Report/);
    assert.match(back, /- a/);
  });

  it('csv -> xlsx -> csv is lossless for simple data', async () => {
    const source = 'name,age\nAlice,30\nBob,25';
    const xlsx = await asBinary(source, 'csv', 'xlsx');
    assert.equal((await asText(xlsx, 'xlsx', 'csv')).trim(), source);
  });

  it('csv -> xls -> csv is lossless for simple data', async () => {
    const source = 'name,age\nAlice,30';
    const xls = await asBinary(source, 'csv', 'xls');
    assert.equal((await asText(xls, 'xls', 'csv')).trim(), source);
  });

  it('markdown -> pptx -> markdown keeps slide titles', async () => {
    const pptx = await asBinary('# One\n\n- a\n\n---\n\n# Two\n\n- b', 'markdown', 'pptx');
    const back = await asText(pptx, 'pptx', 'markdown');

    assert.match(back, /## 1\. One/);
    assert.match(back, /## 2\. Two/);
  });

  it('markdown -> pdf -> text keeps readable prose', async () => {
    const pdf = await asBinary('# Doc\n\nSome readable body text.', 'markdown', 'pdf');
    const text = await asText(pdf, 'pdf', 'text');

    assert.match(text, /Doc/);
    assert.match(text, /Some readable body text\./);
  });

  it('json -> markdown -> json preserves values as strings', async () => {
    const markdown = await asText('[{"a":1,"b":2}]', 'json', 'markdown');
    const back = JSON.parse(await asText(markdown, 'markdown', 'json', { maxHops: 3 }));

    assert.deepEqual(back, [{ a: '1', b: '2' }]);
  });
});

describe('extensibility', () => {
  it('lets a custom converter extend an existing chain', async () => {
    const dispose = registerConverter<string>({
      from: 'markdown',
      to: 'slug',
      convert: (input) =>
        String(input)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, ''),
    });

    try {
      assert.equal(await asText('# Hello World', 'markdown', 'slug'), 'hello-world');
      // And it can now be reached from other formats.
      assert.equal(canConvert('html', 'slug'), true);
      assert.equal(await asText('<h1>Hello World</h1>', 'html', 'slug'), 'hello-world');
    } finally {
      dispose();
    }

    assert.equal(canConvert('markdown', 'slug'), false);
  });

  it('isolates converters registered on a private registry', async () => {
    const { ConverterRegistry, runConversion } = await import('../src/index.js');
    const local = new ConverterRegistry();
    local.register({ from: 'a', to: 'b', convert: () => 'local-only' });

    assert.equal((await runConversion(local, 'x', 'a', 'b')).data, 'local-only');
    assert.equal(canConvert('a', 'b'), false, 'global registry must stay untouched');
  });

  it('runs converters in the order reported by path', async () => {
    const result = await convert('| a |\n| --- |\n| 1 |', 'markdown', 'xlsx');
    assert.deepEqual(result.path, ['markdown', 'xlsx']);
    assert.ok(result.data instanceof Uint8Array);
  });
});
