import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';
import ffmpegStatic from 'ffmpeg-static';
import {
  AUDIO_FORMATS,
  buildAudioArgs,
  canConvert,
  convert,
  convertAudio,
  detectFromFileName,
  detectFromMimeType,
  listConverters,
  listFormats,
  resolveFfmpeg,
} from '../../src/index.js';
import type { AudioFormat } from '../../src/index.js';

type ConvertOptions = Parameters<typeof convert>[3];

/** Tests use the bundled static binary so they do not depend on the host PATH. */
const ffmpegPath = ffmpegStatic ?? 'ffmpeg';

const asBinary = async (input: string | Uint8Array, from: string, to: string, options?: ConvertOptions) =>
  (await convert(input, from, to, options)).data as Uint8Array;

/** 16-bit PCM WAV with a sine tone: a dependency-free fixture generator. */
function sineWav(options: { seconds?: number; sampleRate?: number; channels?: number; freq?: number } = {}): Uint8Array {
  const { seconds = 0.2, sampleRate = 8000, channels = 1, freq = 440 } = options;
  const frames = Math.round(seconds * sampleRate);
  const blockAlign = channels * 2;
  const dataSize = frames * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * blockAlign, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let frame = 0; frame < frames; frame += 1) {
    const sample = Math.round(Math.sin((2 * Math.PI * freq * frame) / sampleRate) * 0.3 * 32767);
    for (let channel = 0; channel < channels; channel += 1) {
      buffer.writeInt16LE(sample, 44 + frame * blockAlign + channel * 2);
    }
  }

  return new Uint8Array(buffer);
}

interface WavInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  pcm: Int16Array;
  duration: number;
}

/** Minimal RIFF/WAVE reader used to verify what ffmpeg produced. */
function parseWav(data: Uint8Array): WavInfo {
  const view = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  assert.equal(view.toString('latin1', 0, 4), 'RIFF', 'not a RIFF file');
  assert.equal(view.toString('latin1', 8, 12), 'WAVE', 'not a WAVE file');

  let fmt: { sampleRate: number; channels: number; bitsPerSample: number } | undefined;
  let pcm: Int16Array | undefined;
  let offset = 12;

  while (offset + 8 <= view.length) {
    const id = view.toString('latin1', offset, offset + 4);
    const size = view.readUInt32LE(offset + 4);
    const body = offset + 8;

    if (id === 'fmt ') {
      fmt = {
        channels: view.readUInt16LE(body + 2),
        sampleRate: view.readUInt32LE(body + 4),
        bitsPerSample: view.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      pcm = new Int16Array(size / 2);
      for (let index = 0; index < pcm.length; index += 1) pcm[index] = view.readInt16LE(body + index * 2);
    }

    offset = body + size + (size % 2);
  }

  assert.ok(fmt, 'missing fmt chunk');
  assert.ok(pcm, 'missing data chunk');
  return { ...fmt, pcm, duration: pcm.length / fmt.channels / fmt.sampleRate };
}

const bytesAt = (data: Uint8Array, start: number, end: number) =>
  Buffer.from(data.subarray(start, end)).toString('latin1');

const ascii = (data: Uint8Array) => Buffer.from(data).toString('latin1');

const signatures: Record<Exclude<AudioFormat, 'wav'>, (data: Uint8Array) => boolean> = {
  mp3: (data) => ascii(data).includes('ID3') || (data[0] === 0xff && (data[1]! & 0xe0) === 0xe0),
  flac: (data) => bytesAt(data, 0, 4) === 'fLaC',
  ogg: (data) => bytesAt(data, 0, 4) === 'OggS',
  aac: (data) => data[0] === 0xff && (data[1]! & 0xf0) === 0xf0,
  m4a: (data) => bytesAt(data, 4, 8) === 'ftyp' && ascii(data.subarray(8, 12)).startsWith('M4A'),
};

describe('audio format detection', () => {
  it('maps audio extensions', () => {
    assert.equal(detectFromFileName('voice.wav'), 'wav');
    assert.equal(detectFromFileName('voice.WAVE'), 'wav');
    assert.equal(detectFromFileName('track.mp3'), 'mp3');
    assert.equal(detectFromFileName('track.flac'), 'flac');
    assert.equal(detectFromFileName('track.ogg'), 'ogg');
    assert.equal(detectFromFileName('track.oga'), 'ogg');
    assert.equal(detectFromFileName('track.aac'), 'aac');
    assert.equal(detectFromFileName('track.m4a'), 'm4a');
  });

  it('maps audio mime types', () => {
    assert.equal(detectFromMimeType('audio/wav'), 'wav');
    assert.equal(detectFromMimeType('audio/x-wav; codecs=1'), 'wav');
    assert.equal(detectFromMimeType('audio/mpeg'), 'mp3');
    assert.equal(detectFromMimeType('audio/flac'), 'flac');
    assert.equal(detectFromMimeType('audio/ogg'), 'ogg');
    assert.equal(detectFromMimeType('audio/aac'), 'aac');
    assert.equal(detectFromMimeType('audio/mp4'), 'm4a');
  });
});

describe('audio conversion graph', () => {
  it('connects every audio pair directly', () => {
    for (const from of AUDIO_FORMATS) {
      for (const to of AUDIO_FORMATS) {
        if (from === to) continue;
        assert.equal(canConvert(from, to), true, `${from} -> ${to}`);
      }
    }

    const pairs = listConverters().filter((pair) => AUDIO_FORMATS.includes(pair.from as AudioFormat));
    assert.equal(pairs.length, AUDIO_FORMATS.length * (AUDIO_FORMATS.length - 1));
    for (const format of AUDIO_FORMATS) assert.ok(listFormats().includes(format), `missing format: ${format}`);
  });

  it('builds format-specific ffmpeg arguments', () => {
    assert.ok(buildAudioArgs('mp3', { bitrate: 96 }).join(' ').includes('-b:a 96k'));
    assert.ok(buildAudioArgs('ogg', { bitrate: 192 }).join(' ').includes('-q:a 5'));
    assert.ok(buildAudioArgs('flac', { compressionLevel: 9 }).join(' ').includes('-compression_level 9'));
    assert.deepEqual(buildAudioArgs('wav').slice(-1), ['pipe:1']);
    assert.deepEqual(buildAudioArgs('wav', {}, 'out.wav').slice(-1), ['out.wav']);
  });
});

describe('audio conversions', () => {
  it('transcodes wav into every target container', async () => {
    const wav = sineWav();

    for (const to of AUDIO_FORMATS) {
      if (to === 'wav') continue;
      const out = await asBinary(wav, 'wav', to, { converterOptions: { ffmpegPath } });
      assert.ok(out.byteLength > 0, `${to} should not be empty`);
      assert.ok(signatures[to](out), `${to} header mismatch`);
    }
  });

  it('round-trips wav -> mp3 -> wav keeping duration', async () => {
    const source = sineWav({ seconds: 0.5 });
    const mp3 = await asBinary(source, 'wav', 'mp3', { converterOptions: { ffmpegPath } });
    const back = parseWav(await asBinary(mp3, 'mp3', 'wav', { converterOptions: { ffmpegPath } }));

    assert.equal(back.sampleRate, 8000);
    assert.equal(back.channels, 1);
    // Lossy encoders add a frame of padding on both ends; the tolerance covers it.
    assert.ok(back.duration > 0.45 && back.duration < 0.75, `duration was ${back.duration}`);
  });

  it('keeps flac lossless', async () => {
    const source = sineWav({ seconds: 0.2 });
    const flac = await asBinary(source, 'wav', 'flac', { converterOptions: { ffmpegPath } });
    const back = parseWav(await asBinary(flac, 'flac', 'wav', { converterOptions: { ffmpegPath } }));

    assert.deepEqual([...back.pcm], [...parseWav(source).pcm]);
  });

  it('resamples and downmixes on request', async () => {
    const source = sineWav({ sampleRate: 8000, channels: 1 });
    const flac = await asBinary(source, 'wav', 'flac', {
      converterOptions: { ffmpegPath, sampleRate: 16000, channels: 1 },
    });
    const back = parseWav(await asBinary(flac, 'flac', 'wav', { converterOptions: { ffmpegPath } }));

    assert.equal(back.sampleRate, 16000);
    assert.equal(back.channels, 1);
  });

  it('honours the bitrate option for lossy targets', async () => {
    const source = sineWav({ sampleRate: 44100, channels: 2, seconds: 0.5 });

    const low = await asBinary(source, 'wav', 'mp3', { converterOptions: { ffmpegPath, bitrate: 64 } });
    const high = await asBinary(source, 'wav', 'mp3', { converterOptions: { ffmpegPath, bitrate: 256 } });
    assert.ok(low.byteLength < high.byteLength, `${low.byteLength} should be smaller than ${high.byteLength}`);

    const oggLow = await asBinary(source, 'wav', 'ogg', { converterOptions: { ffmpegPath, bitrate: 64 } });
    const oggHigh = await asBinary(source, 'wav', 'ogg', { converterOptions: { ffmpegPath, bitrate: 256 } });
    assert.ok(oggLow.byteLength < oggHigh.byteLength, `${oggLow.byteLength} should be smaller than ${oggHigh.byteLength}`);
  });

  it('writes a standard (non-fragmented) m4a', async () => {
    const m4a = await asBinary(sineWav(), 'wav', 'm4a', { converterOptions: { ffmpegPath } });
    const text = ascii(m4a);

    assert.ok(signatures.m4a(m4a));
    assert.ok(text.includes('moov') && text.includes('mdat'), 'expected moov+mdat atoms');
    assert.ok(!text.includes('mvex'), 'fragmented output should not be produced');
  });

  it('leaves no temporary files behind', async () => {
    await convertAudio(sineWav(), 'm4a', { ffmpegPath });
    const leftovers = (await readdir(tmpdir())).filter((name) => name.startsWith('any-format-'));
    assert.deepEqual(leftovers, []);
  });

  it('exposes the direct helper and resolves the binary', async () => {
    const out = await convertAudio(sineWav(), 'flac', { ffmpegPath });
    assert.ok(signatures.flac(out));
    assert.equal(await resolveFfmpeg(ffmpegPath), ffmpegPath);
  });

  it('reports binary-input and ffmpeg errors clearly', async () => {
    await assert.rejects(() => convert('not audio', 'wav', 'mp3'), /binary input|readFile/);
    await assert.rejects(
      () => convert(new Uint8Array([1, 2, 3, 4]), 'wav', 'mp3', { converterOptions: { ffmpegPath } }),
      /ffmpeg exited|Invalid data/i,
    );
    await assert.rejects(
      () => convert(sineWav(), 'wav', 'mp3', { converterOptions: { ffmpegPath: 'definitely-not-ffmpeg' } }),
      /ffmpeg-static|ffmpeg/i,
    );
  });
});
