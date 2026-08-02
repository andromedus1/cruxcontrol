import { describe, expect, it, vi } from 'vitest';
import { kilterFullride7x10Definition } from '../domain/boards/definitions/kilter-fullride-7x10';
import { analyzeKilterScreenshotFile, type ScreenshotAnalysisPlatform } from './file-analysis';
import { SUPPLIED_FULLRIDE_CLIMBS } from './supplied-fullride-climbs';

function platform(overrides: Partial<ScreenshotAnalysisPlatform> = {}): ScreenshotAnalysisPlatform {
  return {
    readBytes: vi.fn(async () => new Uint8Array([1, 2, 3])),
    digestSha256: vi.fn(async () => 'f'.repeat(64)),
    decode: vi.fn(),
    createCanvas: vi.fn(),
    ...overrides,
  };
}

describe('analyzeKilterScreenshotFile', () => {
  it('hashes known files and skips pixel decoding entirely', async () => {
    const decode = vi.fn();
    const source = SUPPLIED_FULLRIDE_CLIMBS[0];
    const adapter = platform({ digestSha256: vi.fn(async () => source.sha256), decode });
    const file = new File(['private pixels'], 'renamed.png', { type: 'image/png' });

    const analyzed = await analyzeKilterScreenshotFile(file, kilterFullride7x10Definition, adapter);

    expect(analyzed.file).toBe(file);
    expect(analyzed.candidate.name).toBe(source.name);
    expect(decode).not.toHaveBeenCalled();
  });

  it('closes decoded bitmaps and clears canvas storage after extracting unknown facts', async () => {
    const close = vi.fn();
    const bitmap = { width: 270, height: 600, close } as unknown as ImageBitmap;
    const imageData = {
      width: 270,
      height: 600,
      data: new Uint8ClampedArray(270 * 600 * 4),
    } as ImageData;
    const context = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => imageData),
      clearRect: vi.fn(),
    };
    const canvas = { width: 0, height: 0, getContext: vi.fn(() => context) };
    const adapter = platform({
      decode: vi.fn(async () => bitmap),
      createCanvas: vi.fn(() => canvas),
    });

    const analyzed = await analyzeKilterScreenshotFile(
      new File(['new'], 'new.png', { type: 'image/png' }),
      kilterFullride7x10Definition,
      adapter,
    );

    expect(analyzed.candidate.name).toBe('');
    expect(analyzed.candidate.warnings.at(-1)?.code).toBe('title-required');
    expect(close).toHaveBeenCalledOnce();
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 270, 600);
    expect(canvas).toMatchObject({ width: 0, height: 0 });
  });

  it('still closes and releases decoded resources when pixel extraction fails', async () => {
    const close = vi.fn();
    const canvas = { width: 0, height: 0, getContext: vi.fn(() => null) };
    const adapter = platform({
      decode: vi.fn(async () => ({ width: 270, height: 600, close }) as unknown as ImageBitmap),
      createCanvas: vi.fn(() => canvas),
    });
    await expect(
      analyzeKilterScreenshotFile(
        new File(['new'], 'new.png'),
        kilterFullride7x10Definition,
        adapter,
      ),
    ).rejects.toThrow('cannot analyze screenshot pixels');
    expect(close).toHaveBeenCalledOnce();
    expect(canvas).toMatchObject({ width: 0, height: 0 });
  });

  it('closes a decoded bitmap even when canvas allocation fails', async () => {
    const close = vi.fn();
    const adapter = platform({
      decode: vi.fn(async () => ({ width: 270, height: 600, close }) as unknown as ImageBitmap),
      createCanvas: vi.fn(() => {
        throw new Error('canvas allocation failed');
      }),
    });
    await expect(
      analyzeKilterScreenshotFile(
        new File(['new'], 'new.png'),
        kilterFullride7x10Definition,
        adapter,
      ),
    ).rejects.toThrow('canvas allocation failed');
    expect(close).toHaveBeenCalledOnce();
  });
});
