import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { convert, parseCsv, parseHtmlTable, parseMarkdownTable, serializeCsv } from '../src/index.js';

const text = async (input: string, from: string, to: string, options?: Parameters<typeof convert>[3]) =>
  (await convert(input, from, to, options)).data as string;

describe('csv parser', () => {
  it('handles quotes, escaped quotes, embedded newlines and BOM', () => {
    const source = '\uFEFFa,b\n"x,1","line\nbreak"\n"say ""hi""",2';
    assert.deepEqual(parseCsv(source), [
      ['a', 'b'],
      ['x,1', 'line\nbreak'],
      ['say "hi"', '2'],
    ]);
  });

  it('supports custom delimiters and trimming', () => {
    assert.deepEqual(parseCsv('a; b\n1; 2', { delimiter: ';', trim: true }), [
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('serializes with quoting only when needed', () => {
    const out = serializeCsv([{ a: 'plain', b: 'has,comma', c: 'line\nbreak' }], {}, ['a', 'b', 'c']);
    assert.equal(out, 'a,b,c\nplain,"has,comma","line\nbreak"');
  });
});

describe('table conversions', () => {
  it('converts csv to and from json', async () => {
    const json = JSON.parse(await text('a,b\n1,2', 'csv', 'json'));
    assert.deepEqual(json, [{ a: '1', b: '2' }]);

    const csv = await text(JSON.stringify(json), 'json', 'csv');
    assert.equal(csv, 'a,b\n1,2');
  });

  it('converts csv to a markdown table', async () => {
    const table = await text('a,b\n1,2', 'csv', 'markdown');
    assert.equal(table, '| a | b |\n| --- | --- |\n| 1 | 2 |');
  });

  it('converts csv to an html table', async () => {
    const html = await text('a,b\n1,2', 'csv', 'html');
    assert.match(html, /<th>a<\/th><th>b<\/th>/);
    assert.match(html, /<td>1<\/td><td>2<\/td>/);
  });

  it('escapes pipes when building markdown tables', async () => {
    const table = await text('a\n"x|y"', 'csv', 'markdown');
    assert.match(table, /x\\\|y/);
  });

  it('reads a markdown table back into csv', async () => {
    const csv = await text('| a | b |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |', 'markdown', 'csv');
    assert.equal(csv, 'a,b\n1,2\n3,4');
  });

  it('reads an html table back into csv', async () => {
    const csv = await text('<table><tr><th>a</th></tr><tr><td>1</td></tr></table>', 'html', 'csv');
    assert.equal(csv, 'a\n1');
  });

  it('converts csv to tsv and back', async () => {
    const tsv = await text('a,b\n1,2', 'csv', 'tsv');
    assert.equal(tsv, 'a\tb\n1\t2');
    assert.equal(await text(tsv, 'tsv', 'csv'), 'a,b\n1,2');
  });

  it('nests values containing the target delimiter', async () => {
    const csv = await text('a,b\n"x,y",2', 'csv', 'tsv');
    assert.equal(csv, 'a\tb\nx,y\t2');
  });
});

describe('parsers', () => {
  it('ignores the markdown separator row', () => {
    assert.deepEqual(parseMarkdownTable('| a | b |\n|:--|--:|\n| 1 | 2 |'), [
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('extracts html table cells with br and entities', () => {
    assert.deepEqual(parseHtmlTable('<table><tr><td>a&amp;b<br>c</td></tr></table>'), [['a&b\nc']]);
  });
});
