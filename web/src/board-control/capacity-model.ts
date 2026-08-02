import type { AuroraApiLevel } from './api-level-2-codec';

export interface EncodedSceneCost {
  readonly apiLevel: AuroraApiLevel;
  readonly lightCount: number;
  readonly packetCount: number;
  readonly framedBytes: number;
  readonly writeCount: number;
}

export function encodedSceneCost(apiLevel: AuroraApiLevel, lightCount: number): EncodedSceneCost {
  if (!Number.isInteger(lightCount) || lightCount < 0) {
    throw new RangeError('Light count must be a non-negative integer.');
  }
  const lightsPerPacket = apiLevel === 3 ? 84 : 127;
  const bytesPerLight = apiLevel === 3 ? 3 : 2;
  const packetCount = Math.max(1, Math.ceil(lightCount / lightsPerPacket));
  const framedBytes = bytesPerLight * lightCount + 6 * packetCount;
  return Object.freeze({
    apiLevel,
    lightCount,
    packetCount,
    framedBytes,
    writeCount: Math.ceil(framedBytes / 20),
  });
}
