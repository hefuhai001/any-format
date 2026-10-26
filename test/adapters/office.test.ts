import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canConvert, convert } from '../../src/index.js';

const csv = 'name,age,city\nAlice,30,Beijing\nBob,25,"Shanghai, CN"';
const markdown = '# Report\n\nA **bold** paragraph.\n\n- first\n- second\n\n```js\nconsole.log(1);\n```\n';

const asBinary = async (input: string | Uint8Array, from: string, to: string, options?: Parameters<typeof convert>[3]) =>
  (await convert(input, from, to, options)).data as Uint8Array;

const asText = async (input: string | Uint8Array, from: string, to: string, options?: Parameters<typeof convert>[3]) =>
  (await convert(input, from, to, options)).data as string;

describe('spreadsheet formats', () => {
  it('round-trips csv through xlsx', async () => {
    const xlsx = await asBinary(csv, 'csv', 'xlsx');
    assert.ok(xlsx.byteLength > 0);
    // xlsx is a zip container: check the local file header signature.
    assert.equal(xlsx[0], 0x50);
    assert.equal(xlsx[1], 0x4b);

    const back = await asText(xlsx, 'xlsx', 'csv');
    assert.equal(back.trim(), csv);
  });

  it('round-trips csv through legacy xls', async () => {
    const xls = await asBinary(csv, 'csv', 'xls');
    assert.ok(xls.byteLength > 0);
    // OLE2 compound document signature.
    assert.deepEqual([...xls.subarray(0, 4)], [0xd0, 0xcf, 0x11, 0xe0]);

    const back = await asText(xls, 'xls', 'csv');
    assert.equal(back.trim(), csv);
  });

  it('reads a worksheet as json records', async () => {
    const xlsx = await asBinary(csv, 'csv', 'xlsx');
    const records = JSON.parse(await asText(xlsx, 'xlsx', 'json'));
    assert.deepEqual(records, [
      { name: 'Alice', age: '30', city: 'Beijing' },
      { name: 'Bob', age: '25', city: 'Shanghai, CN' },
    ]);
  });

  it('reads a worksheet as a markdown table', async () => {
    const xlsx = await asBinary(csv, 'csv', 'xlsx');
    const table = await asText(xlsx, 'xlsx', 'markdown');
    assert.match(table, /^\| name \| age \| city \|/);
    assert.match(table, /\| Bob \| 25 \| Shanghai, CN \|/);
  });

  it('selects a worksheet by name and rejects unknown sheets', async () => {
    const xlsx = await asBinary(csv, 'csv', 'xlsx', { converterOptions: { sheetName: 'People' } });
    const rows = await asText(xlsx, 'xlsx', 'csv', { converterOptions: { sheet: 'People' } });
    assert.match(rows, /Alice/);
    await assert.rejects(() => asText(xlsx, 'xlsx', 'csv', { converterOptions: { sheet: 'Nope' } }), /not found/);
  });

  it('builds xlsx from json and markdown tables', async () => {
    const fromJson = await asBinary('[{"a":1,"b":"x"}]', 'json', 'xlsx');
    assert.match(await asText(fromJson, 'xlsx', 'csv'), /^a,b\n1,x$/);

    const fromTable = await asBinary('| a | b |\n| --- | --- |\n| 1 | 2 |', 'markdown', 'xlsx');
    assert.match(await asText(fromTable, 'xlsx', 'csv'), /^a,b\n1,2$/);
  });
});

describe('docx', () => {
  it('generates a docx and reads it back as html/markdown/text', async () => {
    const docx = await asBinary(markdown, 'markdown', 'docx');
    assert.equal(docx[0], 0x50);
    assert.equal(docx[1], 0x4b);

    const html = await asText(docx, 'docx', 'html');
    assert.match(html, /<h1>Report<\/h1>/);
    assert.match(html, /<strong>bold<\/strong>/);

    const md = await asText(docx, 'docx', 'markdown');
    assert.match(md, /# Report/);
    assert.match(md, /- first/);

    const text = await asText(docx, 'docx', 'text');
    assert.match(text, /A bold paragraph\./);
  });

  it('converts plain text and html into docx', async () => {
    const fromText = await asBinary('Hello <world>\n\nSecond paragraph.', 'text', 'docx');
    assert.match(await asText(fromText, 'docx', 'text'), /Hello <world>\n\nSecond paragraph\./);

    const fromHtml = await asBinary('<h2>Title</h2><p>Body</p>', 'html', 'docx');
    assert.match(await asText(fromHtml, 'docx', 'markdown'), /## Title/);
  });

  it('reaches docx from csv through the markdown chain', async () => {
    assert.equal(canConvert('csv', 'docx'), true);
    const result = await convert(csv, 'csv', 'docx');
    assert.deepEqual(result.path, ['csv', 'markdown', 'docx']);
    assert.ok((result.data as Uint8Array).byteLength > 0);
  });
});

describe('pdf', () => {
  it('generates a pdf and extracts its text', async () => {
    const pdf = await asBinary('# Report\n\nHello PDF world.', 'markdown', 'pdf');
    assert.equal(Buffer.from(pdf.subarray(0, 5)).toString(), '%PDF-');

    const text = await asText(pdf, 'pdf', 'text');
    assert.match(text, /Report/);
    assert.match(text, /Hello PDF world\./);
  });

  it('keeps multiple paragraphs as separate lines', async () => {
    const pdf = await asBinary('First paragraph.\n\nSecond paragraph.', 'text', 'pdf');
    const text = await asText(pdf, 'pdf', 'text');
    assert.match(text, /First paragraph\./);
    assert.match(text, /Second paragraph\./);
  });

  it('converts pdf to markdown through text', async () => {
    const pdf = await asBinary('Alpha\n\nBeta', 'text', 'pdf');
    const result = await convert(pdf, 'pdf', 'markdown');
    assert.deepEqual(result.path, ['pdf', 'text', 'markdown']);
  });
});

describe('pptx', () => {
  it('generates slides and reads them back', async () => {
    const pptx = await asBinary(markdown, 'markdown', 'pptx');
    assert.equal(pptx[0], 0x50);
    assert.equal(pptx[1], 0x4b);

    const text = await asText(pptx, 'pptx', 'text');
    assert.match(text, /\[Slide 1\]/);
    assert.match(text, /Report/);
    assert.match(text, /second/);
  });

  it('splits slides on --- and headings', async () => {
    const pptx = await asBinary('# One\n\n- a\n\n---\n\n# Two\n\n- b', 'markdown', 'pptx');
    const md = await asText(pptx, 'pptx', 'markdown');
    assert.match(md, /## 1\. One/);
    assert.match(md, /## 2\. Two/);
  });
});

describe('office conversion graph', () => {
  it('exposes readable paths between office formats', () => {
    assert.equal(canConvert('docx', 'pdf'), true);
    assert.equal(canConvert('xlsx', 'pdf'), true);
    assert.equal(canConvert('pptx', 'docx'), true);
    assert.equal(canConvert('csv', 'pptx'), true);
  });

  it('rejects pdf to xlsx (no structural writer)', async () => {
    const pdf = await asBinary('x', 'text', 'pdf');
    await assert.rejects(() => convert(pdf, 'pdf', 'xlsx'), /Cannot convert/);
  });

  it('explains that legacy doc cannot be written', async () => {
    await assert.rejects(() => convert('x', 'text', 'doc'), /legacy \.doc is not supported/);
  });

  it('surfaces a useful error for a missing optional dependency', async () => {
    const { ConverterRegistry, runConversion } = await import('../../src/index.js');
    const registry = new ConverterRegistry();
    registry.register({
      from: 'a',
      to: 'b',
      async convert() {
        const { optionalImport } = await import('../../src/adapters/loader.js');
        await optionalImport('definitely-not-installed-pkg');
        return '';
      },
    });
    await assert.rejects(() => runConversion(registry, 'x', 'a', 'b'), /npm i definitely-not-installed-pkg/);
  });
});

describe('adapter options', () => {
  it('renders pptx slides as html sections', async () => {
    const pptx = await asBinary('# Deck\n\n- a', 'markdown', 'pptx');
    const html = await asText(pptx, 'pptx', 'html');
    assert.match(html, /<section class="slide">/);
    assert.match(html, /<h2>Deck<\/h2>/);
    assert.match(html, /<li>a<\/li>/);
  });

  it('omits slide numbers when disabled', async () => {
    const pptx = await asBinary('# Deck\n\n- a', 'markdown', 'pptx');
    const text = await asText(pptx, 'pptx', 'text', { converterOptions: { slideNumbers: false } });
    assert.ok(!text.includes('[Slide 1]'));
    assert.match(text, /Deck/);
  });

  it('reads a worksheet without a header row', async () => {
    const xlsx = await asBinary(csv, 'csv', 'xlsx');
    const records = JSON.parse(await asText(xlsx, 'xlsx', 'json', { converterOptions: { header: false } }));
    assert.deepEqual(Object.keys(records[0]), ['0', '1', '2']);
  });

  it('builds xlsx from every text table source', async () => {
    const sources: Array<[string, string]> = [
      ['csv', 'a,b\n1,2'],
      ['tsv', 'a\tb\n1\t2'],
      ['json', '[{"a":"1","b":"2"}]'],
      ['markdown', '| a | b |\n| --- | --- |\n| 1 | 2 |'],
      ['html', '<table><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></table>'],
    ];

    for (const [from, input] of sources) {
      const xlsx = await asBinary(input, from, 'xlsx');
      assert.match(await asText(xlsx, 'xlsx', 'csv'), /^a,b\n1,2$/m, `${from} -> xlsx -> csv`);
    }
  });

  it('writes legacy xls from markdown tables', async () => {
    const xls = await asBinary('| a |\n| --- |\n| 1 |', 'markdown', 'xls');
    assert.deepEqual([...xls.subarray(0, 4)], [0xd0, 0xcf, 0x11, 0xe0]);
    assert.match(await asText(xls, 'xls', 'csv'), /^a\n1$/m);
  });

  it('honours pdf page layout options', async () => {
    const pdf = await asBinary('Hello layout', 'text', 'pdf', {
      converterOptions: { size: 'LETTER', margin: 24, fontSize: 12, title: 'T' },
    });
    assert.equal(Buffer.from(pdf.subarray(0, 5)).toString(), '%PDF-');
    assert.match(await asText(pdf, 'pdf', 'text'), /Hello layout/);
  });

  it('accepts a docx style map', async () => {
    const docx = await asBinary('# H\n\ntext', 'markdown', 'docx');
    const html = await asText(docx, 'docx', 'html', {
      converterOptions: { styleMap: ["p[style-name='Heading 1'] => h1:fresh"] },
    });
    assert.match(html, /<h1>H<\/h1>/);
  });

  it('reports a clear error for malformed binary input', async () => {
    await assert.rejects(() => asText(new Uint8Array([1, 2, 3, 4]), 'docx', 'text'), /failed/i);
    await assert.rejects(() => asText(new Uint8Array([1, 2, 3, 4]), 'pptx', 'text'), /pptx/i);
  });

  it('rejects text input passed to a binary format', async () => {
    await assert.rejects(
      () => asText('plain string', 'docx', 'text'),
      /require binary input|readFile/,
    );
  });
});

describe('rich content rendering', () => {
  it('renders quotes, code, rules and ordered lists into pdf', async () => {
    const pdf = await asBinary('> quoted line\n\n```js\nconst a = 1;\n```\n\n---\n\n1. first\n2. second', 'markdown', 'pdf');
    const text = await asText(pdf, 'pdf', 'text');

    assert.match(text, /quoted line/);
    assert.match(text, /const a = 1;/);
    assert.match(text, /first/);
    assert.match(text, /second/);
  });

  it('handles slides without an explicit title', async () => {
    const pptx = await asBinary('---\n\n- only body', 'markdown', 'pptx');
    const html = await asText(pptx, 'pptx', 'html');

    assert.match(html, /<section class="slide">/);
    // Readers promote the first paragraph of a slide to its heading.
    assert.match(html, /<h2>only body<\/h2>/);
  });

  it('selects a worksheet by numeric index', async () => {
    const xlsx = await asBinary(csv, 'csv', 'xlsx');
    assert.match(await asText(xlsx, 'xlsx', 'csv', { converterOptions: { sheet: 0 } }), /Alice/);
  });

  it('renders a worksheet as tab separated text', async () => {
    const xlsx = await asBinary(csv, 'csv', 'xlsx');
    assert.match(await asText(xlsx, 'xlsx', 'text'), /^name\tage\tcity$/m);
  });
});

describe('legacy doc format', () => {
  it('is registered as a read source', () => {
    assert.equal(canConvert('doc', 'text'), true);
    assert.equal(canConvert('doc', 'pdf'), true);
    assert.equal(canConvert('doc', 'docx'), true);
  });

  it('rejects docx -> doc with backend instructions', async () => {
    const docx = await asBinary('# x', 'markdown', 'docx');
    await assert.rejects(() => convert(docx, 'docx', 'doc'), /LibreOffice/);
  });

  it('rejects text -> doc with backend instructions', async () => {
    await assert.rejects(() => convert('x', 'text', 'doc'), /headless --convert-to doc/);
  });

  it('fails cleanly on malformed binary input', async () => {
    await assert.rejects(() => asText(new Uint8Array([1, 2, 3, 4]), 'doc', 'text'), /failed/i);
  });
});
