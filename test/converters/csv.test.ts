import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { collectHeaders, parseCsv, rowsToRecords, serializeCsv } from '../../src/converters/csv/index.js';
import { convert } from '../../src/index.js';

const text = async (input: string, from: string, to: string, options?: Parameters<typeof convert>[3]) =>
  (await convert(input, from, to, options)).data as string;

describe('parseCsv', () => {
  it('parses quoted fields, escaped quotes and embedded newlines', () => {
    const source = '\uFEFFa,b\n"x,1","line\nbreak"\n"say ""hi""",2';
    assert.deepEqual(parseCsv(source), [
      ['a', 'b'],
      ['x,1', 'line\nbreak'],
      ['say "hi"', '2'],
    ]);
  });

  it('handles CRLF and CR line endings', () => {
    assert.deepEqual(parseCsv('a,b\r\n1,2\r3,4'), [
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('does not emit a trailing empty row', () => {
    assert.deepEqual(parseCsv('a,b\n1,2\n'), [
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('returns no rows for empty or blank input', () => {
    assert.deepEqual(parseCsv(''), []);
    assert.deepEqual(parseCsv('\n\n'), []);
  });

  it('supports custom delimiters', () => {
    assert.deepEqual(parseCsv('a;b\n1;2', { delimiter: ';' }), [
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('supports a custom quote character', () => {
    assert.deepEqual(parseCsv("a,b\n'x,y',2", { quote: "'" }), [
      ['a', 'b'],
      ['x,y', '2'],
    ]);
  });

  it('trims only unquoted fields when asked', () => {
    assert.deepEqual(parseCsv(' a , b \n 1 , 2 ', { trim: true }), [
      ['a', 'b'],
      ['1', '2'],
    ]);
    assert.deepEqual(parseCsv('" x ",y', { trim: true }), [[' x ', 'y']]);
  });

  it('keeps an empty first field', () => {
    assert.deepEqual(parseCsv(',b\n1,2'), [
      ['', 'b'],
      ['1', '2'],
    ]);
  });

  it('keeps a lone empty field as a row', () => {
    assert.deepEqual(parseCsv('a\n""'), [['a'], ['']]);
  });
});

describe('rowsToRecords', () => {
  it('uses the first row as the header by default', () => {
    assert.deepEqual(rowsToRecords([['a', 'b'], ['1', '2']]), [{ a: '1', b: '2' }]);
  });

  it('fills missing cells with empty strings', () => {
    assert.deepEqual(rowsToRecords([['a', 'b'], ['1']]), [{ a: '1', b: '' }]);
  });

  it('names blank headers column_N', () => {
    assert.deepEqual(rowsToRecords([['a', ''], ['1', '2']]), [{ a: '1', column_2: '2' }]);
  });

  it('indexes columns when header is disabled', () => {
    assert.deepEqual(rowsToRecords([['1', '2']], { header: false }), [{ '0': '1', '1': '2' }]);
  });

  it('returns nothing for empty input', () => {
    assert.deepEqual(rowsToRecords([]), []);
  });
});

describe('serializeCsv', () => {
  it('quotes only fields that need it', () => {
    assert.equal(
      serializeCsv([{ a: 'plain', b: 'has,comma', c: 'line\nbreak' }], {}, ['a', 'b', 'c']),
      'a,b,c\nplain,"has,comma","line\nbreak"',
    );
  });

  it('escapes embedded quotes', () => {
    assert.equal(serializeCsv([{ a: 'say "hi"' }], {}, ['a']), 'a\n"say ""hi"""');
  });

  it('quotes everything with quoteAll', () => {
    assert.equal(serializeCsv([{ a: 'x' }], { quoteAll: true }, ['a']), '"a"\n"x"');
  });

  it('supports a custom eol and delimiter', () => {
    assert.equal(serializeCsv([{ a: '1', b: '2' }], { eol: '\r\n', delimiter: ';' }, ['a', 'b']), 'a;b\r\n1;2');
  });

  it('omits the header when disabled', () => {
    assert.equal(serializeCsv([{ a: '1' }], { header: false }, ['a']), '1');
  });

  it('renders null and undefined as empty fields', () => {
    assert.equal(serializeCsv([{ a: null, b: undefined }], {}, ['a', 'b']), 'a,b\n,');
  });

  it('returns an empty string without records or headers', () => {
    assert.equal(serializeCsv([], {}), '');
  });

  it('collects headers in first-seen order', () => {
    assert.deepEqual(collectHeaders([{ a: 1 }, { b: 2, a: 3 }, { c: 4 }]), ['a', 'b', 'c']);
  });
});

describe('csv converters', () => {
  it('converts csv to json objects', async () => {
    assert.deepEqual(JSON.parse(await text('a,b\n1,2', 'csv', 'json')), [{ a: '1', b: '2' }]);
  });

  it('converts tsv to json', async () => {
    assert.deepEqual(JSON.parse(await text('a\tb\n1\t2', 'tsv', 'json')), [{ a: '1', b: '2' }]);
  });

  it('converts csv to tsv and back', async () => {
    const tsv = await text('a,b\n1,2', 'csv', 'tsv');
    assert.equal(tsv, 'a\tb\n1\t2');
    assert.equal(await text(tsv, 'tsv', 'csv'), 'a,b\n1,2');
  });

  it('nests values containing the target delimiter', async () => {
    assert.equal(await text('a,b\n"x,y",2', 'csv', 'tsv'), 'a\tb\nx,y\t2');
  });

  it('returns an empty string when converting an empty table', async () => {
    assert.equal(await text('', 'csv', 'markdown'), '');
    assert.equal(await text('', 'csv', 'html'), '');
  });
});
