import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  detectFormat,
  detectFromFileName,
  detectFromMimeType,
  listDetectors,
  registerDetector,
} from '../../src/core/detect/index.js';

describe('detectFormat', () => {
  it('detects a full html document with high confidence', () => {
    const result = detectFormat('<!doctype html><html><body><p>hi</p></body></html>');
    assert.equal(result.format, 'html');
    assert.equal(result.confidence, 1);
  });

  it('detects html fragments by tag density', () => {
    assert.equal(detectFormat('<div><p>a</p><span>b</span></div>').format, 'html');
    // A fragment scores lower than a complete document.
    assert.ok(detectFormat('<p>single tag</p>').confidence < detectFormat('<!doctype html><html></html>').confidence);
  });

  it('detects markdown from multiple constructs', () => {
    const md = '# Title\n\n- one\n- two\n\n```js\nx\n```\n\n**bold**\n\n[link](https://a.b)';
    assert.equal(detectFormat(md).format, 'markdown');
    assert.ok(detectFormat(md).confidence > 0.8);
  });

  it('detects a single markdown construct with lower confidence', () => {
    const result = detectFormat('# Only a heading');
    assert.equal(result.format, 'markdown');
    assert.ok(result.confidence > 0 && result.confidence < 0.5);
  });

  it('detects valid json for objects and arrays', () => {
    assert.deepEqual(detectFormat('{"a":1}'), { format: 'json', confidence: 1 });
    assert.deepEqual(detectFormat('[1,2,3]'), { format: 'json', confidence: 1 });
    assert.equal(detectFormat('{ "a": 1, }').format, 'json');
    assert.ok(detectFormat('{ "a": 1, }').confidence < 1);
  });

  it('does not treat a brace-prefixed non-json string as json', () => {
    assert.notEqual(detectFormat('{not json at all').format, 'json');
  });

  it('detects csv only for consistent multi-column rows', () => {
    assert.equal(detectFormat('a,b,c\n1,2,3\n4,5,6').format, 'csv');
    assert.notEqual(detectFormat('a,b,c\n1,2').format, 'csv');
    assert.notEqual(detectFormat('single line, only').format, 'csv');
  });

  it('detects xml declarations', () => {
    assert.deepEqual(detectFormat('  <?xml version="1.0"?><root/>'), { format: 'xml', confidence: 1 });
  });

  it('falls back to text for prose', () => {
    assert.equal(detectFormat('just some ordinary words here').format, 'text');
  });

  it('honours minConfidence', () => {
    assert.deepEqual(detectFormat('Hello there', { minConfidence: 0.9 }), { format: 'text', confidence: 0 });
    assert.equal(detectFormat('# Heading', { minConfidence: 0.1 }).format, 'markdown');
  });

  it('rejects non-string samples', () => {
    // @ts-expect-error intentional invalid input
    assert.throws(() => detectFormat(42), /expects a string/);
  });
});

describe('registerDetector', () => {
  it('participates in detection and can be disposed', () => {
    const dispose = registerDetector({
      format: 'toml',
      score: (sample) => (sample.includes('[package]') ? 1 : 0),
    });

    try {
      assert.equal(detectFormat('[package]\nname = "x"').format, 'toml');
      assert.ok(listDetectors().some((detector) => detector.format === 'toml'));
    } finally {
      dispose();
    }

    assert.equal(detectFormat('[package]\nname = "x"').format, 'text');
    assert.ok(!listDetectors().some((detector) => detector.format === 'toml'));
  });

  it('ignores scores outside the 0..1 range', () => {
    const dispose = registerDetector({ format: 'wild', score: () => 5 });
    try {
      assert.equal(detectFormat('anything at all').confidence, 1);
    } finally {
      dispose();
    }
  });

  it('listDetectors returns a copy', () => {
    const first = listDetectors();
    const second = listDetectors();
    assert.notEqual(first, second);
    assert.deepEqual(first.map((d) => d.format), second.map((d) => d.format));
  });
});

describe('detectFromFileName', () => {
  it('maps common extensions case-insensitively', () => {
    assert.equal(detectFromFileName('report.MD'), 'markdown');
    assert.equal(detectFromFileName('/tmp/a/b/report.docx'), 'docx');
    assert.equal(detectFromFileName('sheet.xls'), 'xls');
    assert.equal(detectFromFileName('slides.pptx'), 'pptx');
    assert.equal(detectFromFileName('legacy.doc'), 'doc');
    assert.equal(detectFromFileName('a.xlsm'), 'xlsx');
  });

  it('ignores query strings and fragments', () => {
    assert.equal(detectFromFileName('https://host/file.csv?token=1#frag'), 'csv');
  });

  it('returns undefined without a usable extension', () => {
    assert.equal(detectFromFileName('Makefile'), undefined);
    assert.equal(detectFromFileName('trailingdot.'), undefined);
    assert.equal(detectFromFileName('unknown.zzz'), undefined);
  });
});

describe('detectFromMimeType', () => {
  it('maps office and text mime types', () => {
    assert.equal(detectFromMimeType('text/html; charset=utf-8'), 'html');
    assert.equal(detectFromMimeType('application/pdf'), 'pdf');
    assert.equal(detectFromMimeType('application/msword'), 'doc');
    assert.equal(detectFromMimeType('application/vnd.ms-excel'), 'xls');
    assert.equal(
      detectFromMimeType('application/vnd.openxmlformats-officedocument.presentationml.presentation'),
      'pptx',
    );
  });

  it('returns undefined for unknown or empty types', () => {
    assert.equal(detectFromMimeType('application/x-unknown'), undefined);
    assert.equal(detectFromMimeType(''), undefined);
  });
});
