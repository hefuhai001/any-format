import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { textToHtml } from '../../src/converters/text-to-html.js';
import { textToMarkdown } from '../../src/converters/text-to-markdown.js';
import { decodeEntities } from '../../src/converters/entities.js';
import { escapeAttribute, escapeText } from '../../src/converters/escape.js';

const ctx = {} as never;

describe('text -> html', () => {
  const render = (input: string, options?: Parameters<typeof textToHtml.convert>[1]) =>
    textToHtml.convert(input, options ?? {}, ctx) as string;

  it('splits paragraphs on blank lines', () => {
    assert.equal(render('one\n\ntwo'), '<p>one</p>\n<p>two</p>');
  });

  it('keeps single newlines as <br> inside a paragraph', () => {
    assert.equal(render('a\nb'), '<p>a<br>\nb</p>');
  });

  it('escapes html characters', () => {
    assert.equal(render('a <b> & "c"'), '<p>a &lt;b&gt; &amp; "c"</p>');
  });

  it('uses only <br> when paragraphs is false', () => {
    assert.equal(render('a\n\nb', { paragraphs: false }), 'a<br>\n<br>\nb');
  });

  it('wraps output in a document when asked', () => {
    const html = render('hi', { document: true, title: 'T' });
    assert.match(html, /^<!doctype html>/);
    assert.match(html, /<title>T<\/title>/);
    assert.match(html, /<body>\n<p>hi<\/p>\n<\/body>/);
  });

  it('escapes the document title', () => {
    assert.match(render('x', { document: true, title: '<T>' }), /<title>&lt;T&gt;<\/title>/);
  });

  it('defaults the document title', () => {
    assert.match(render('x', { document: true }), /<title>Document<\/title>/);
  });

  it('collapses extra blank lines between paragraphs', () => {
    assert.equal(render('a\n\n\n\nb'), '<p>a</p>\n<p>b</p>');
  });

  it('returns an empty string for blank input', () => {
    assert.equal(render(''), '');
    assert.equal(render('   \n\n  '), '');
  });

  it('normalizes CRLF input', () => {
    assert.equal(render('a\r\n\r\nb'), '<p>a</p>\n<p>b</p>');
  });
});

describe('text -> markdown', () => {
  const render = (input: string, options?: Parameters<typeof textToMarkdown.convert>[1]) =>
    textToMarkdown.convert(input, options ?? {}, ctx) as string;

  it('preserves line structure and ends with a newline', () => {
    assert.equal(render('line one\nline two'), 'line one\nline two\n');
  });

  it('normalizes CRLF', () => {
    assert.equal(render('a\r\nb'), 'a\nb\n');
  });

  it('collapses runs of blank lines', () => {
    assert.equal(render('a\n\n\n\nb'), 'a\n\nb\n');
  });

  it('leaves markdown syntax alone by default', () => {
    assert.equal(render('# not a heading'), '# not a heading\n');
  });

  it('escapes markdown syntax when requested', () => {
    assert.equal(render('# heading\n\n- item\n\n*bold*', { escape: true }), '\\# heading\n\n\\- item\n\n\\*bold\\*\n');
  });

  it('trims surrounding whitespace', () => {
    assert.equal(render('\n\n  x  \n\n'), 'x\n');
  });

  it('handles empty input', () => {
    assert.equal(render(''), '\n');
  });
});

describe('escape helpers', () => {
  it('escapes the three text characters', () => {
    assert.equal(escapeText('a & b < c > d'), 'a &amp; b &lt; c &gt; d');
  });

  it('escapes quotes for attributes', () => {
    assert.equal(escapeAttribute('a "b"'), 'a &quot;b&quot;');
  });

  it('leaves plain text untouched', () => {
    assert.equal(escapeText('plain'), 'plain');
  });
});

describe('decodeEntities', () => {
  it('decodes named entities', () => {
    assert.equal(decodeEntities('&amp; &lt; &gt; &quot; &apos;'), '& < > " \'');
    assert.equal(decodeEntities('&hellip;&mdash;&nbsp;'), '…— ');
  });

  it('decodes decimal and hex code points', () => {
    assert.equal(decodeEntities('&#65;&#x42;&#x4e2d;'), 'AB中');
  });

  it('keeps unknown or malformed entities', () => {
    assert.equal(decodeEntities('&nope; &amp'), '&nope; &amp');
  });

  it('is case-insensitive for named entities', () => {
    assert.equal(decodeEntities('&AMP;&Lt;'), '&<');
  });
});
