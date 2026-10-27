import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConversionError } from '../../core/errors.js';

/** How much of ffmpeg's stderr is quoted back in an error message. */
const STDERR_TAIL = 500;

/**
 * Resolve the ffmpeg executable, in order: explicit option → `FFMPEG_PATH` →
 * the optional `ffmpeg-static` package → `ffmpeg` on `PATH`.
 */
export async function resolveFfmpeg(explicit?: string): Promise<string> {
  if (explicit) return explicit;
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;

  try {
    // A variable specifier keeps bundlers from resolving the optional package.
    const specifier = 'ffmpeg-static';
    const mod = (await import(/* @vite-ignore */ specifier)) as { default?: unknown };
    const candidate = mod.default ?? mod;
    if (typeof candidate === 'string' && candidate.length > 0) return candidate;
  } catch {
    // Not installed: fall back to PATH.
  }

  return 'ffmpeg';
}

export interface FfmpegRun {
  readonly binary: string;
  readonly args: readonly string[];
  readonly input: Buffer;
}

/** Pipe `input` through ffmpeg and resolve with everything written to stdout. */
export async function runFfmpeg({ binary, args, input }: FfmpegRun): Promise<Buffer> {
  const { code, stdout, stderr } = await spawnFfmpeg(binary, args, input);
  if (code === 0 && stdout.byteLength > 0) return stdout;
  throw ffmpegError(code, stderr);
}

export interface FfmpegFileRun {
  readonly binary: string;
  readonly input: Buffer;
  /** File extension for the temporary output, e.g. `m4a`. */
  readonly extension: string;
  /** Build the argument list once the temporary output path is known. */
  readonly buildArgs: (outputPath: string) => readonly string[];
}

/**
 * Some muxers (mp4/ipod above all) refuse non-seekable output, so those writes
 * go through a temporary file in the OS temp directory.
 */
export async function runFfmpegToFile({ binary, input, extension, buildArgs }: FfmpegFileRun): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), 'any-format-'));
  const output = join(dir, `out.${extension}`);

  try {
    const { code, stderr } = await spawnFfmpeg(binary, buildArgs(output), input);
    if (code !== 0) throw ffmpegError(code, stderr);
    return await readFile(output);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

interface SpawnResult {
  readonly code: number | null;
  readonly stdout: Buffer;
  readonly stderr: string;
}

function spawnFfmpeg(binary: string, args: readonly string[], input: Buffer): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(binary, [...args], { stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (error) {
      reject(missingBinary(binary, error));
      return;
    }

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let settled = false;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    child.on('error', (error) => fail(missingBinary(binary, error)));
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      resolve({ code, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr).toString('utf8').trim() });
    });

    // ffmpeg may exit before reading all input; the exit code carries the real error.
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

function ffmpegError(code: number | null, stderr: string): ConversionError {
  return new ConversionError(
    `ffmpeg exited with code ${code ?? 'null'}: ${stderr.slice(-STDERR_TAIL) || 'no output'}`,
    'CONVERTER_FAILED',
  );
}

function missingBinary(binary: string, error: unknown): ConversionError {
  const reason = error instanceof Error ? error.message : String(error);
  return new ConversionError(
    `Could not run ffmpeg ("${binary}"): ${reason}. Install it (brew install ffmpeg / winget install ffmpeg), ` +
      'run `npm i ffmpeg-static`, or point converterOptions.ffmpegPath at the executable.',
    'CONVERTER_FAILED',
    { cause: error },
  );
}
