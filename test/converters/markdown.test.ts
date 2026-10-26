import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { markdownToHtml } from '../../src/converters/markdown/index.js';

const ctx = {} as never;

const render = (input: string, options?: Parameters<typeof markdownToHtml.convert>[1]) =>
  markdownToHtml.convert(input, options ?? {}, ctx) as string;

describe('markdown -> html blocks', () => {
  it('renders every heading level', () => {
    for (let level = 1; level <= 6; level += 1) {
      assert.equal(render(`${'#'.repeat(level)} Title`), `<h${level}>Title</h${level}>`);
    }
  });

  it('does not treat seven hashes as a heading', () => {
    assert.equal(render('####### x'), '<p>####### x</p>');
  });

  it('renders paragraphs separated by blank lines', () => {
    assert.equal(render('one\n\ntwo'), '<p>one</p>\n<p>two</p>');
  });

  it('keeps soft line breaks inside a paragraph', () => {
    assert.equal(render('a\nb'), '<p>a\nb</p>');
  });

  it('renders all thematic break flavours', () => {
    for (const rule of ['---', '***', '___', '- - -']) {
      assert.equal(render(rule), '<hr>');
    }
  });

  it('renders unordered and ordered lists', () => {
    assert.equal(render('- a\n- b'), '<ul>\n<li>a</li>\n<li>b</li>\n</ul>');
    assert.equal(render('1. a\n2. b'), '<ol>\n<li>a</li>\n<li>b</li>\n</ol>');
  });

  it('renders nested lists inside the parent item', () => {
    const html = render('- outer\n  - inner');
    assert.match(html, /<li>outer\n<ul>\n<li>inner<\/li>\n<\/ul><\/li>/);
  });

  it('renders blockquotes, including multiple lines', () => {
    assert.equal(render('> quoted'), '<blockquote>\n<p>quoted</p>\n</blockquote>');
    assert.match(render('> a\n> b'), /<blockquote>[\s\S]*<p>a\nb<\/p>[\s\S]*<\/blockquote>/);
  });

  it('renders fenced code blocks with and without a language', () => {
    assert.equal(render('```\nplain\n```'), '<pre><code>plain\n</code></pre>');
    assert.equal(render('```ts\nconst a = 1;\n```'), '<pre><code class="language-ts">const a = 1;\n</code></pre>');
    assert.equal(render('~~~js\nx\n~~~'), '<pre><code class="language-js">x\n</code></pre>');
  });

  it('escapes html inside code blocks', () => {
    assert.match(render('```\n<div>\n```'), /&lt;div&gt;/);
  });

  it('consumes an unterminated code fence to the end of input', () => {
    assert.equal(render('```js\nconst a = 1;'), '<pre><code class="language-js">const a = 1;\n</code></pre>');
  });

  it('returns an empty string for empty or whitespace input', () => {
    assert.equal(render(''), '');
    assert.equal(render('   \n\n  '), '');
  });
});

describe('markdown -> html inline', () => {
  it('renders emphasis variants', () => {
    assert.equal(render('**bold**'), '<p><strong>bold</strong></p>');
    assert.equal(render('__bold__'), '<p><strong>bold</strong></p>');
    assert.equal(render('*italic*'), '<p><em>italic</em></p>');
    assert.equal(render('_italic_'), '<p><em>italic</em></p>');
    assert.equal(render('~~gone~~'), '<p><del>gone</del></p>');
  });

  it('renders inline code and escapes its content', () => {
    assert.equal(render('use `a < b` here'), '<p>use <code>a &lt; b</code> here</p>');
  });

  it('renders links with and without titles', () => {
    assert.match(render('[text](https://a.b)'), /<a href="https:\/\/a\.b">text<\/a>/);
    assert.match(render('[text](https://a.b "Title")'), /<a href="https:\/\/a\.b" title="Title">text<\/a>/);
  });

  it('renders images with alt text', () => {
    assert.match(render('![alt](img.png)'), /<img src="img\.png" alt="alt">/);
    assert.match(render('![alt](img.png "T")'), /title="T"/);
  });

  it('escapes quotes in attributes', () => {
    assert.match(render('[x](https://a.b?q="1")'), /&quot;/);
  });

  it('turns two trailing spaces into a line break', () => {
    assert.match(render('a  \nb'), /a<br>/);
  });

  it('leaves raw html untouched by default', () => {
    assert.equal(render('<span>x</span>'), '<p><span>x</span></p>');
  });

  it('escapes raw html when escapeHtml is set', () => {
    assert.equal(render('<span>x</span>', { escapeHtml: true }), '<p>&lt;span&gt;x&lt;/span&gt;</p>');
  });
});

describe('markdown -> html document mode', () => {
  it('wraps output in a full document', () => {
    const html = render('# Title', { document: true });
    assert.match(html, /^<!doctype html>/);
    assert.match(html, /<meta charset="utf-8">/);
    assert.match(html, /<title>Document<\/title>/);
    assert.match(html, /<body>\n<h1>Title<\/h1>\n<\/body>/);
    assert.match(html, /<\/html>$/);
  });
});
