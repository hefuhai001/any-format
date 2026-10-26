import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { asBuffer, asText, optionalImport } from '../../src/adapters/loader.js';
import { ConversionError, InvalidInputError } from '../../src/core/errors.js';

describe('optionalImport', () => {
  it('loads an installed module', async () => {
    const mod = await optionalImport<typeof import('node:path')>('node:path');
    assert.equal(typeof mod.join, 'function');
  });

  it('reports the install command for a missing module', async () => {
    await assert.rejects(
      () => optionalImport('definitely-not-installed-pkg', 'used for testing'),
      (error: unknown) =>
        error instanceof ConversionError &&
        error.code === 'CONVERTER_FAILED' &&
        /npm i definitely-not-installed-pkg/.test(error.message) &&
        /used for testing/.test(error.message),
    );
  });

  it('omits the hint when none is given', async () => {
    await assert.rejects(() => optionalImport('another-missing-pkg'), (error: unknown) => {
      assert.ok(error instanceof ConversionError);
      assert.ok(!error.message.includes('undefined'));
      return true;
    });
  });
});

describe('asBuffer', () => {
  it('returns buffers unchanged', () => {
    const buffer = Buffer.from([1, 2, 3]);
    assert.equal(asBuffer(buffer, 'docx'), buffer);
  });

  it('converts a Uint8Array view into a buffer', () => {
    const source = new Uint8Array([0, 1, 2, 3, 4]);
    const view = source.subarray(1, 4);
    const buffer = asBuffer(view, 'xlsx');

    assert.ok(Buffer.isBuffer(buffer));
    assert.deepEqual([...buffer], [1, 2, 3]);
  });

  it('rejects text input with an actionable message', () => {
    assert.throws(
      () => asBuffer('not binary', 'docx'),
      (error: unknown) =>
        error instanceof InvalidInputError &&
        /require binary input/.test(error.message) &&
        /readFile\(path, "utf8"\)/.test(error.message),
    );
  });
});

describe('asText', () => {
  it('passes strings through', () => {
    assert.equal(asText('hello', 'text'), 'hello');
  });

  it('decodes utf8 bytes', () => {
    assert.equal(asText(new Uint8Array(Buffer.from('中文 ok', 'utf8')), 'text'), '中文 ok');
  });

  it('rejects other value types', () => {
    assert.throws(() => asText(42, 'text'), ConversionError);
    assert.throws(() => asText(null, 'text'), ConversionError);
    assert.throws(() => asText(null, 'text'), /not textual/);
  });
});
