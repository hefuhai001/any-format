import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { htmlToText } from '../../src/converters/html-to-text.js';

const ctx = {} as never;

const render = (input: string, options?: Parameters<typeof htmlToText.convert>[1]) =>
  htmlToText.convert(input, options ?? {}, ctx) as string;

describe('html -> text structure', () => {
  it('turns headings into suffixed markers', () => {
    assert.equal(render('<h1>Top</h1>'), '# Top');
    assert.equal(render('<h3>Sub</h3>'), '### Sub');
  });

  it('separates paragraphs with a blank line', () => {
    assert.equal(render('<p>one</p><p>two</p>'), 'one\n\ntwo');
  });

  it('renders list items as bullets without blank lines between them', () => {
    assert.equal(render('<ul><li>a</li><li>b</li></ul>'), '- a\n- b');
  });

  it('keeps br as a single newline', () => {
    assert.equal(render('<p>a<br>b</p>'), 'a\nb');
  });

  it('renders horizontal rules', () => {
    assert.equal(render('<p>a</p><hr><p>b</p>'), 'a\n\n---\n\nb');
  });

  it('drops empty and self-closing markup', () => {
    assert.equal(render('<div><span></span></div>'), '');
  });
});

describe('html -> text inline', () => {
  it('keeps links as markdown when the label differs from the href', () => {
    assert.equal(render('<p><a href="https://a.b">label</a></p>'), '[label](https://a.b)');
  });

  it('keeps a bare href when the label equals it', () => {
    assert.equal(render('<p><a href="https://a.b">https://a.b</a></p>'), 'https://a.b');
  });

  it('keeps image alt text', () => {
    assert.equal(render('<p><img src="a.png" alt="pic"></p>'), '[pic]');
    assert.equal(render('<p><img src="a.png" alt=""></p>'), '');
  });

  it('decodes named, decimal and hex entities', () => {
    assert.equal(render('<p>&amp; &lt; &gt; &quot; &apos;</p>'), '& < > " \'');
    assert.equal(render('<p>&nbsp;x</p>'), 'x');
    assert.equal(render('<p>&#65;&#x42;</p>'), 'AB');
    assert.equal(render('<p>&#x4e2d;&#25991;</p>'), '中文');
  });

  it('leaves unknown entities untouched', () => {
    assert.equal(render('<p>&unknown; &notreal</p>'), '&unknown; &notreal');
  });
});

describe('html -> text options', () => {
  it('strips comments, styles, scripts and head', () => {
    assert.equal(render('<!-- c --><style>.a{}</style><script>1</script><head><title>T</title></head><p>body</p>'), 'body');
  });

  it('collapses spaces but keeps explicit line breaks', () => {
    // Newlines inside a paragraph are indistinguishable from `<br>`, so they survive.
    assert.equal(render('<p>a    b\n\n   c</p>'), 'a b\n\nc');
  });

  it('keeps raw whitespace when collapseWhitespace is false', () => {
    assert.equal(render('<p>a    b</p>', { collapseWhitespace: false }), 'a    b');
  });

  it('flattens everything to one line when preserveLineBreaks is false', () => {
    assert.equal(render('<p>a</p><p>b</p>', { preserveLineBreaks: false }), 'a b');
  });

  it('handles empty input', () => {
    assert.equal(render(''), '');
  });
});
