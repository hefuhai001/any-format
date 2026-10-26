import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseHtmlTable,
  parseMarkdownTable,
  recordsFromJson,
  recordsFromRows,
  renderHtmlTable,
  renderMarkdownTable,
  rowsFromRecords,
} from '../../src/converters/table/index.js';
import { convert } from '../../src/index.js';

const text = async (input: string, from: string, to: string, options?: Parameters<typeof convert>[3]) =>
  (await convert(input, from, to, options)).data as string;

describe('json -> table', () => {
  it('converts records to csv', async () => {
    assert.equal(await text('[{"a":1,"b":2}]', 'json', 'csv'), 'a,b\n1,2');
  });

  it('wraps a single object into one row', async () => {
    assert.equal(await text('{"a":1}', 'json', 'csv'), 'a\n1');
  });

  it('indexes array rows', async () => {
    assert.equal(await text('[[1,2],[3,4]]', 'json', 'csv'), '0,1\n1,2\n3,4');
  });

  it('unions keys across records', async () => {
    assert.equal(await text('[{"a":1},{"b":2}]', 'json', 'csv'), 'a,b\n1,\n,2');
  });

  it('renders markdown and html tables', async () => {
    assert.equal(await text('[{"a":"1"}]', 'json', 'markdown'), '| a |\n| --- |\n| 1 |');
    assert.match(await text('[{"a":"1"}]', 'json', 'html'), /<th>a<\/th>/);
  });

  it('returns an empty string for an empty array', async () => {
    assert.equal(await text('[]', 'json', 'csv'), '');
  });

  it('rejects non-array JSON scalars', async () => {
    await assert.rejects(() => text('"just a string"', 'json', 'csv'), /array of objects/);
  });

  it('rejects invalid JSON', async () => {
    await assert.rejects(() => text('{oops', 'json', 'csv'), /JSON/);
  });
});

describe('csv -> table', () => {
  it('renders a markdown table', async () => {
    assert.equal(await text('a,b\n1,2', 'csv', 'markdown'), '| a | b |\n| --- | --- |\n| 1 | 2 |');
  });

  it('renders an html table', async () => {
    const html = await text('a,b\n1,2', 'csv', 'html');
    assert.match(html, /<thead>\n<tr><th>a<\/th><th>b<\/th><\/tr>/);
    assert.match(html, /<td>1<\/td><td>2<\/td>/);
  });

  it('escapes pipes and markup', async () => {
    assert.match(await text('a\n"x|y"', 'csv', 'markdown'), /x\\\|y/);
    assert.match(await text('a\n"<b>"', 'csv', 'html'), /&lt;b&gt;/);
  });

  it('applies alignment when requested', async () => {
    assert.match(await text('a\n1', 'csv', 'markdown', { converterOptions: { align: 'center' } }), /\| :---: \|/);
    assert.match(await text('a\n1', 'csv', 'html', { converterOptions: { align: 'right' } }), /text-align:right/);
  });
});

describe('table -> csv', () => {
  it('reads a markdown table', async () => {
    assert.equal(await text('| a | b |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |', 'markdown', 'csv'), 'a,b\n1,2\n3,4');
  });

  it('reads a markdown table with alignment markers', async () => {
    assert.equal(await text('| a | b |\n|:--|--:|\n| 1 | 2 |', 'markdown', 'csv'), 'a,b\n1,2');
  });

  it('reads an html table', async () => {
    assert.equal(await text('<table><tr><th>a</th></tr><tr><td>1</td></tr></table>', 'html', 'csv'), 'a\n1');
  });

  it('keeps document text outside the table out of the csv', async () => {
    assert.equal(await text('# Title\n\n| a |\n| --- |\n| 1 |\n\ntail', 'markdown', 'csv'), 'a\n1');
  });

  it('returns an empty string without a table', async () => {
    assert.equal(await text('no table here', 'markdown', 'csv'), '');
    assert.equal(await text('<p>no table</p>', 'html', 'csv'), '');
  });
});

describe('table helpers', () => {
  it('parses rows, skipping the separator', () => {
    assert.deepEqual(parseMarkdownTable('| a | b |\n|:--|--:|\n| 1 | 2 |'), [
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('unescapes pipes inside markdown cells', () => {
    assert.deepEqual(parseMarkdownTable('| a |\n| --- |\n| x\\|y |'), [['a'], ['x|y']]);
  });

  it('stops at the first non-table line', () => {
    assert.deepEqual(parseMarkdownTable('| a |\n| --- |\n| 1 |\ntext\n| 2 |'), [['a'], ['1']]);
  });

  it('extracts html cells with br and entities', () => {
    assert.deepEqual(parseHtmlTable('<table><tr><td>a&amp;b<br>c</td></tr></table>'), [['a&b\nc']]);
  });

  it('reads only the first html table', () => {
    assert.deepEqual(parseHtmlTable('<table><tr><td>1</td></tr></table><table><tr><td>2</td></tr></table>'), [['1']]);
  });

  it('returns no rows for missing tables', () => {
    assert.deepEqual(parseHtmlTable('<p>x</p>'), []);
    assert.deepEqual(parseMarkdownTable('plain text'), []);
  });

  it('renders header and body rows', () => {
    assert.equal(renderMarkdownTable([['a'], ['1']]), '| a |\n| --- |\n| 1 |');
    assert.equal(renderHtmlTable([['a'], ['1']]).split('\n')[0], '<table>');
    assert.equal(renderMarkdownTable([]), '');
    assert.equal(renderHtmlTable([]), '');
  });

  it('normalizes JSON shapes', () => {
    assert.deepEqual(recordsFromJson('[{"a":1}]'), [{ a: 1 }]);
    assert.deepEqual(recordsFromJson('{"a":1}'), [{ a: 1 }]);
    assert.deepEqual(recordsFromJson('[[1,2]]'), [{ '0': 1, '1': 2 }]);
  });

  it('converts rows to records with and without headers', () => {
    assert.deepEqual(recordsFromRows([['a', 'b'], ['1', '2']]), {
      records: [{ a: '1', b: '2' }],
      headers: ['a', 'b'],
    });
    assert.deepEqual(recordsFromRows([['1', '2']], false), {
      records: [{ '0': '1', '1': '2' }],
      headers: ['0', '1'],
    });
    assert.deepEqual(recordsFromRows([]), { records: [], headers: [] });
  });

  it('converts records back to rows', () => {
    assert.deepEqual(rowsFromRecords([{ a: 1, b: 2 }]), [
      ['a', 'b'],
      ['1', '2'],
    ]);
    assert.deepEqual(rowsFromRecords([{ a: 1 }], ['a']), [['a'], ['1']]);
  });
});
