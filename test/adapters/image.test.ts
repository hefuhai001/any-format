import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import sharp from 'sharp';
import {
  IMAGE_FORMATS,
  canConvert,
  convert,
  convertImage,
  detectFromFileName,
  detectFromMimeType,
  listConverters,
  listFormats,
  readImageInfo,
} from '../../src/index.js';
import type { ImageFormat } from '../../src/index.js';

type ConvertOptions = Parameters<typeof convert>[3];

const asBinary = async (input: string | Uint8Array, from: string, to: string, options?: ConvertOptions) =>
  (await convert(input, from, to, options)).data as Uint8Array;

/** 16×16 half-transparent PNG: the canonical sample for every case below. */
async function samplePng(width = 16, height = 16): Promise<Uint8Array> {
  const buffer = await sharp({
    create: { width, height, channels: 4, background: { r: 200, g: 40, b: 40, alpha: 0.5 } },
  })
    .png()
    .toBuffer();
  return new Uint8Array(buffer);
}

/** Fully transparent PNG, used to check background flattening. */
async function transparentPng(): Promise<Uint8Array> {
  const buffer = await sharp({
    create: { width: 8, height: 8, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .png()
    .toBuffer();
  return new Uint8Array(buffer);
}

const bytesAt = (data: Uint8Array, start: number, end: number) =>
  Buffer.from(data.subarray(start, end)).toString('latin1');

const signatures: Record<string, (data: Uint8Array) => boolean> = {
  png: (data) => bytesAt(data, 1, 4) === 'PNG',
  jpeg: (data) => bytesAt(data, 0, 3) === '\u00ff\u00d8\u00ff',
  webp: (data) => bytesAt(data, 0, 4) === 'RIFF' && bytesAt(data, 8, 12) === 'WEBP',
  avif: (data) => bytesAt(data, 4, 8) === 'ftyp' && bytesAt(data, 8, 12) === 'avif',
  tiff: (data) => bytesAt(data, 0, 2) === 'II' || bytesAt(data, 0, 2) === 'MM',
  gif: (data) => bytesAt(data, 0, 4) === 'GIF8',
};

describe('image format detection', () => {
  it('maps image extensions to canonical formats', () => {
    assert.equal(detectFromFileName('photo.png'), 'png');
    assert.equal(detectFromFileName('photo.JPG'), 'jpeg');
    assert.equal(detectFromFileName('photo.jpeg'), 'jpeg');
    assert.equal(detectFromFileName('photo.webp'), 'webp');
    assert.equal(detectFromFileName('photo.avif'), 'avif');
    assert.equal(detectFromFileName('scan.TIF'), 'tiff');
    assert.equal(detectFromFileName('scan.tiff'), 'tiff');
    assert.equal(detectFromFileName('anim.gif'), 'gif');
  });

  it('maps image mime types', () => {
    assert.equal(detectFromMimeType('image/png'), 'png');
    assert.equal(detectFromMimeType('image/jpeg'), 'jpeg');
    assert.equal(detectFromMimeType('image/jpg'), 'jpeg');
    assert.equal(detectFromMimeType('image/webp'), 'webp');
    assert.equal(detectFromMimeType('image/avif'), 'avif');
    assert.equal(detectFromMimeType('image/tiff'), 'tiff');
    assert.equal(detectFromMimeType('image/gif'), 'gif');
  });
});

describe('image conversion graph', () => {
  it('connects every image pair directly', () => {
    for (const from of IMAGE_FORMATS) {
      for (const to of IMAGE_FORMATS) {
        if (from === to) continue;
        assert.equal(canConvert(from, to), true, `${from} -> ${to}`);
      }
    }
    const imagePairs = listConverters().filter((pair) => IMAGE_FORMATS.includes(pair.from as ImageFormat));
    assert.equal(imagePairs.length, 30);
    assert.equal(IMAGE_FORMATS.length * (IMAGE_FORMATS.length - 1), 30);
  });

  it('lists image formats and folds jpg/tif aliases into jpeg/tiff', async () => {
    const formats = listFormats();
    for (const format of IMAGE_FORMATS) assert.ok(formats.includes(format), `missing format: ${format}`);

    assert.equal(canConvert('jpg', 'png'), true);
    assert.equal(canConvert('png', 'tif'), true);

    const result = await convert(await samplePng(), 'png', 'jpg');
    assert.equal(result.to, 'jpeg');
    assert.deepEqual(result.path, ['png', 'jpeg']);
    assert.ok(signatures.jpeg!(result.data as Uint8Array));
  });

  it('treats png as a binary format', async () => {
    await assert.rejects(() => convert('not an image', 'png', 'jpeg'), /binary input|readFile/);
    await assert.rejects(() => convert(new Uint8Array([1, 2, 3, 4]), 'png', 'jpeg'), /failed/i);
  });
});

describe('image conversions', () => {
  it('converts png to every writable target with a valid container header', async () => {
    const png = await samplePng();

    for (const to of IMAGE_FORMATS) {
      if (to === 'png') continue;
      const out = await asBinary(png, 'png', to);
      assert.ok(out.byteLength > 0, `${to} should not be empty`);
      assert.ok(signatures[to]!(out), `${to} header mismatch`);
    }
  });

  it('keeps dimensions when transcoding', async () => {
    const jpeg = await asBinary(await samplePng(24, 12), 'png', 'jpeg');
    const info = await readImageInfo(jpeg);

    assert.equal(info.width, 24);
    assert.equal(info.height, 12);
    assert.equal(info.format, 'jpeg');
  });

  it('round-trips png -> jpeg -> png', async () => {
    const jpeg = await asBinary(await samplePng(), 'png', 'jpeg');
    const back = await asBinary(jpeg, 'jpeg', 'png');

    assert.ok(signatures.png!(back));
    const info = await readImageInfo(back);
    assert.equal(info.width, 16);
    assert.equal(info.height, 16);
  });

  it('flattens transparency when the target has no alpha channel', async () => {
    const png = await transparentPng();

    const white = await asBinary(png, 'png', 'jpeg');
    const black = await asBinary(png, 'png', 'jpeg', { converterOptions: { background: '#000000' } });

    assert.equal((await readImageInfo(white)).hasAlpha, false);
    assert.equal((await readImageInfo(black)).hasAlpha, false);

    const whiteMean = (await sharp(white).stats()).channels[0]!.mean;
    const blackMean = (await sharp(black).stats()).channels[0]!.mean;
    assert.ok(whiteMean > 225, `expected white background, got ${whiteMean}`);
    assert.ok(blackMean < 30, `expected black background, got ${blackMean}`);
  });

  it('honours the quality option for lossy targets', async () => {
    const gradient = new Uint8Array(
      await sharp({
        create: { width: 64, height: 64, channels: 3, background: { r: 20, g: 120, b: 200 } },
      })
        .composite([
          {
            input: await sharp({
              create: { width: 32, height: 64, channels: 3, background: { r: 240, g: 200, b: 10 } },
            })
              .png()
              .toBuffer(),
            top: 0,
            left: 16,
          },
        ])
        .png()
        .toBuffer(),
    );

    const low = await asBinary(gradient, 'png', 'jpeg', { converterOptions: { quality: 10 } });
    const high = await asBinary(gradient, 'png', 'jpeg', { converterOptions: { quality: 95 } });

    assert.ok(low.byteLength < high.byteLength, `${low.byteLength} should be smaller than ${high.byteLength}`);
  });

  it('supports lossless webp/avif and clamps out-of-range quality', async () => {
    const png = await samplePng();

    const lossy = await asBinary(png, 'png', 'webp', { converterOptions: { quality: 50 } });
    const lossless = await asBinary(png, 'png', 'webp', { converterOptions: { lossless: true } });
    assert.ok(signatures.webp!(lossy));
    assert.ok(signatures.webp!(lossless));
    assert.notDeepEqual(lossy, lossless);

    const avif = await asBinary(png, 'png', 'avif', { converterOptions: { lossless: true } });
    assert.ok(signatures.avif!(avif));

    const clamped = await convertImage(png, 'jpeg', { quality: 5000 });
    assert.ok(signatures.jpeg!(clamped));
  });

  it('accepts the animated flag for frame-capable targets', async () => {
    const gif = await asBinary(await samplePng(), 'png', 'gif', { converterOptions: { animated: true } });
    assert.ok(signatures.gif!(gif));
  });

  it('reports image metadata through the public helper', async () => {
    const info = await readImageInfo(await samplePng());

    assert.equal(info.format, 'png');
    assert.equal(info.width, 16);
    assert.equal(info.height, 16);
    assert.equal(info.channels, 4);
    assert.equal(info.hasAlpha, true);
  });
});
