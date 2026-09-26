import type { BoardDefinition } from '../domain/boards/definition';
import { interpretKilterScreenshot, suppliedEntryToCandidate } from './interpret';
import { SCREENSHOT_MAX_HEIGHT, SCREENSHOT_MAX_WIDTH } from './ring-detector';
import type { AnalyzedScreenshot, ScreenshotPixels } from './types';

interface AnalysisCanvas {
  width: number;
  height: number;
  getContext(
    type: '2d',
    options?: { willReadFrequently?: boolean },
  ): {
    drawImage(image: ImageBitmap, x: number, y: number): void;
    getImageData(x: number, y: number, width: number, height: number): ImageData;
    clearRect(x: number, y: number, width: number, height: number): void;
  } | null;
}

export interface ScreenshotAnalysisPlatform {
  readonly readBytes: (file: File) => Promise<Uint8Array>;
  readonly digestSha256: (bytes: Uint8Array) => Promise<string>;
  readonly decode: (file: File) => Promise<ImageBitmap>;
  readonly createCanvas: () => AnalysisCanvas;
}

async function browserReadBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

async function browserDigestSha256(bytes: Uint8Array): Promise<string> {
  const input = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest('SHA-256', input);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

const browserPlatform: ScreenshotAnalysisPlatform = {
  readBytes: browserReadBytes,
  digestSha256: browserDigestSha256,
  decode: (file) => createImageBitmap(file),
  createCanvas: () => document.createElement('canvas'),
};

export async function analyzeKilterScreenshotFile(
  file: File,
  definition: BoardDefinition,
  platform: ScreenshotAnalysisPlatform = browserPlatform,
): Promise<AnalyzedScreenshot> {
  const bytes = await platform.readBytes(file);
  const sha256 = await platform.digestSha256(bytes);
  const supplied = suppliedEntryToCandidate(sha256, definition);
  if (supplied) return Object.freeze({ file, candidate: supplied });

  const bitmap = await platform.decode(file);
  let canvas: AnalysisCanvas | null = null;
  try {
    if (bitmap.width > SCREENSHOT_MAX_WIDTH || bitmap.height > SCREENSHOT_MAX_HEIGHT) {
      throw new Error(
        `Screenshot dimensions ${bitmap.width}×${bitmap.height} exceed the analysis limit of ${SCREENSHOT_MAX_WIDTH}×${SCREENSHOT_MAX_HEIGHT}.`,
      );
    }
    canvas = platform.createCanvas();
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('This browser cannot analyze screenshot pixels.');
    context.drawImage(bitmap, 0, 0);
    const image = context.getImageData(0, 0, bitmap.width, bitmap.height);
    const pixels: ScreenshotPixels = {
      width: image.width,
      height: image.height,
      data: image.data,
    };
    return Object.freeze({
      file,
      candidate: interpretKilterScreenshot({ fileName: file.name, sha256, pixels, definition }),
    });
  } finally {
    bitmap.close();
    if (canvas && canvas.width > 0 && canvas.height > 0) {
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}
