import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { htmlToMarkdown } from '../../src/converters/html-to-markdown/index.js';

const ctx = {} as never;

const render = (input: string, options?: Parameters<typeof htmlToMarkdown.convert>[1]) =>
  htmlToMarkdown.convert(input, options ?? {}, ctx) as string;

describe('html -> markdown headings and blocks', () => {
  it('renders atx headings for every level', () => {
    for (let level = 1; level <= 6; level += 1) {
      assert.equal(render(`<h${level}>T</h${level}>`), `${'#'.repeat(level)} T\n`);
    }
  });

  it('renders setext headings when requested', () => {
    assert.equal(render('<h1>T</h1>', { headingStyle: 'setext' }), 'T\n===\n');
    assert.equal(render('<h2>TT</h2>', { headingStyle: 'setext' }), 'TT\n---\n');
    // h3 has no setext form and stays atx.
    assert.match(render('<h3>T</h3>', { headingStyle: 'setext' }), /^### T/);
  });

  it('renders paragraphs without extra blank lines at the edges', () => {
    assert.equal(render('<p>one</p><p>two</p>'), 'one\n\ntwo\n');
  });

  it('renders horizontal rules', () => {
    assert.equal(render('<hr>'), '---\n');
  });

  it('turns br into a hard line break', () => {
    assert.match(render('<p>a<br>b</p>'), /a {2}\nb/);
  });

  it('collapses div boundaries into paragraph breaks', () => {
    assert.equal(render('<div>a</div><div>b</div>'), 'a\n\nb\n');
  });

  it('renders blockquotes line by line', () => {
    assert.match(render('<blockquote><p>a</p><p>b</p></blockquote>'), /> a\n>\n> b/);
  });
});

describe('html -> markdown lists', () => {
  it('renders unordered lists with the default bullet', () => {
    assert.equal(render('<ul><li>a</li><li>b</li></ul>'), '- a\n- b\n');
  });

  it('honours bullet variants', () => {
    assert.equal(render('<ul><li>a</li></ul>', { bullet: '*' }), '* a\n');
    assert.equal(render('<ul><li>a</li></ul>', { bullet: '+' }), '+ a\n');
  });

  it('numbers ordered lists', () => {
    assert.equal(render('<ol><li>a</li><li>b</li></ol>'), '1. a\n2. b\n');
  });

  it('indents nested lists under their parent', () => {
    const markdown = render('<ul><li>outer<ul><li>inner</li></ul></li></ul>');
    assert.match(markdown, /^- outer\n {3}- inner/);
  });

  it('indents continuation content inside an item', () => {
    assert.match(render('<ul><li>a<br>b</li></ul>'), /- a\n {3}b/);
  });
});

describe('html -> markdown code', () => {
  it('keeps the language hint from the class name', () => {
    assert.match(render('<pre><code class="language-js">let a = 1;</code></pre>'), /^```js\nlet a = 1;\n```$/m);
  });

  it('renders code blocks without a language', () => {
    assert.match(render('<pre><code>x</code></pre>'), /^```\nx\n```$/m);
  });

  it('handles a bare pre element', () => {
    assert.match(render('<pre>raw\nlines</pre>'), /^```\nraw\nlines\n```$/m);
  });

  it('decodes entities inside code and inlines', () => {
    assert.match(render('<pre><code>a &lt; b</code></pre>'), /a < b/);
    assert.match(render('<p>a &amp; b</p>'), /a & b/);
  });

  it('preserves inline code fences', () => {
    assert.equal(render('<p>use <code>x</code></p>'), 'use `x`\n');
  });
});

describe('html -> markdown tables', () => {
  it('renders a markdown table', () => {
    const markdown = render('<table><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></table>');
    assert.equal(markdown, '| a | b |\n| --- | --- |\n| 1 | 2 |\n');
  });

  it('escapes pipes and flattens newlines in cells', () => {
    const markdown = render('<table><tr><th>a</th></tr><tr><td>x|y<br>z</td></tr></table>');
    assert.match(markdown, /x\\\|y<br>z/);
  });
});

describe('html -> markdown inline', () => {
  it('renders emphasis and strikethrough', () => {
    assert.equal(render('<p><strong>b</strong></p>'), '**b**\n');
    assert.equal(render('<p><b>b</b></p>'), '**b**\n');
    assert.equal(render('<p><em>i</em></p>'), '*i*\n');
    assert.equal(render('<p><i>i</i></p>'), '*i*\n');
    assert.equal(render('<p><del>d</del></p>'), '~~d~~\n');
    assert.equal(render('<p><mark>m</mark></p>'), '==m==\n');
  });

  it('renders links and images', () => {
    assert.equal(render('<p><a href="https://a.b">label</a></p>'), '[label](https://a.b)\n');
    // Autolink syntax would be mistaken for a tag by the final strip pass.
    assert.equal(render('<p><a href="https://a.b">https://a.b</a></p>'), '[https://a.b](https://a.b)\n');
    assert.equal(render('<p><img src="i.png" alt="alt"></p>'), '![alt](i.png)\n');
    assert.equal(render('<p><img alt="alt" src="i.png"></p>'), '![alt](i.png)\n');
  });

  it('strips unknown tags but keeps their text', () => {
    assert.equal(render('<p><custom>kept</custom></p>'), 'kept\n');
  });

  it('drops comments, scripts and styles', () => {
    assert.equal(render('<!-- hidden --><style>.a{}</style><script>1</script><p>shown</p>'), 'shown\n');
  });

  it('handles an empty document', () => {
    assert.equal(render(''), '\n');
  });
});
