import type { ApiLevel3Light } from './api-level-3-codec.ts';

const FRAME_START = 0x01;
const PAYLOAD_START = 0x02;
const FRAME_END = 0x03;
const SINGLE_PACKET = 0x50;
const FIRST_PACKET = 0x4e;
const MIDDLE_PACKET = 0x4d;
const LAST_PACKET = 0x4f;
const LIGHTS_PER_PACKET = 127;
const MAX_WRITE_BYTES = 20;

export type AuroraApiLevel = 2 | 3;

export function apiLevelForAuroraDeviceName(name: string | null): AuroraApiLevel {
  const suffix = name?.match(/@(\d+)$/)?.[1];
  return suffix !== undefined && Number(suffix) >= 3 ? 3 : 2;
}

export function quantizeApiLevel3ColorForApiLevel2(color: number): number {
  if (!Number.isInteger(color) || color < 0 || color > 0xff) {
    throw new RangeError(`API-level-3 color must be an integer from 0 to 255; received ${String(color)}`);
  }
  const red = (color >>> 6) & 0x03;
  const green = (color >>> 3) & 0x03;
  const blue = color & 0x03;
  return (red << 6) | (green << 4) | (blue << 2);
}

function checksum(payload: Uint8Array): number {
  let sum = 0;
  for (const byte of payload) sum = (sum + byte) & 0xff;
  return ~sum & 0xff;
}

function markerForPacket(packetIndex: number, packetCount: number): number {
  if (packetCount === 1) return SINGLE_PACKET;
  if (packetIndex === 0) return FIRST_PACKET;
  if (packetIndex === packetCount - 1) return LAST_PACKET;
  return MIDDLE_PACKET;
}

export function encodeApiLevel2Packets(scene: readonly ApiLevel3Light[]): readonly Uint8Array[] {
  const seen = new Set<number>();
  scene.forEach(({ ledPosition, color }, index) => {
    if (!Number.isInteger(ledPosition) || ledPosition < 0 || ledPosition > 0x03ff) {
      throw new RangeError(`Scene index ${index} ledPosition must be an integer from 0 to 1023; received ${String(ledPosition)}`);
    }
    quantizeApiLevel3ColorForApiLevel2(color);
    if (seen.has(ledPosition)) throw new Error(`Duplicate LED position ${ledPosition}`);
    seen.add(ledPosition);
  });

  const packetCount = Math.max(1, Math.ceil(scene.length / LIGHTS_PER_PACKET));
  return Array.from({ length: packetCount }, (_, packetIndex) => {
    const lights = scene.slice(packetIndex * LIGHTS_PER_PACKET, (packetIndex + 1) * LIGHTS_PER_PACKET);
    const payload = new Uint8Array(1 + lights.length * 2);
    payload[0] = markerForPacket(packetIndex, packetCount);
    lights.forEach((light, lightIndex) => {
      const offset = 1 + lightIndex * 2;
      payload[offset] = light.ledPosition & 0xff;
      payload[offset + 1] =
        quantizeApiLevel3ColorForApiLevel2(light.color) | ((light.ledPosition >>> 8) & 0x03);
    });
    const frame = new Uint8Array(payload.length + 5);
    frame[0] = FRAME_START;
    frame[1] = payload.length;
    frame[2] = checksum(payload);
    frame[3] = PAYLOAD_START;
    frame.set(payload, 4);
    frame[frame.length - 1] = FRAME_END;
    return frame;
  });
}

export function encodeApiLevel2Scene(scene: readonly ApiLevel3Light[]): readonly Uint8Array[] {
  const message = Uint8Array.from(encodeApiLevel2Packets(scene).flatMap((packet) => [...packet]));
  const writes: Uint8Array[] = [];
  for (let offset = 0; offset < message.length; offset += MAX_WRITE_BYTES) {
    writes.push(message.slice(offset, offset + MAX_WRITE_BYTES));
  }
  return writes;
}
