export interface Rgb24 {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

export interface ApiLevel3Light {
  readonly ledPosition: number;
  readonly color: number;
}

const FRAME_START = 0x01;
const PAYLOAD_START = 0x02;
const FRAME_END = 0x03;
const SINGLE_PACKET = 0x54;
const FIRST_PACKET = 0x52;
const MIDDLE_PACKET = 0x51;
const LAST_PACKET = 0x53;
const LIGHTS_PER_PACKET = 84;
const DEFAULT_MAX_WRITE_BYTES = 20;

function assertIntegerInRange(
  value: number,
  minimum: number,
  maximum: number,
  field: string,
  context: string,
): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(
      `${context} ${field} must be an integer from ${minimum} to ${maximum}; received ${String(value)}`,
    );
  }
}

export function quantizeApiLevel3Color(rgb: Rgb24): number {
  assertIntegerInRange(rgb.red, 0, 255, 'red', 'RGB');
  assertIntegerInRange(rgb.green, 0, 255, 'green', 'RGB');
  assertIntegerInRange(rgb.blue, 0, 255, 'blue', 'RGB');

  return ((rgb.red >> 5) << 5) | ((rgb.green >> 5) << 2) | (rgb.blue >> 6);
}

export function checksumApiLevel3Payload(payload: Uint8Array): number {
  let sum = 0;
  for (const byte of payload) {
    sum = (sum + byte) & 0xff;
  }
  return ~sum & 0xff;
}

function validateScene(scene: readonly ApiLevel3Light[]): void {
  const positionIndexes = new Map<number, number>();

  scene.forEach((light, index) => {
    assertIntegerInRange(light.ledPosition, 0, 0xffff, 'ledPosition', `Scene index ${index}`);
    assertIntegerInRange(light.color, 0, 0xff, 'color', `Scene index ${index}`);

    const priorIndex = positionIndexes.get(light.ledPosition);
    if (priorIndex !== undefined) {
      throw new Error(
        `Duplicate LED position ${light.ledPosition} at scene indexes ${priorIndex} and ${index}`,
      );
    }
    positionIndexes.set(light.ledPosition, index);
  });
}

function markerForPacket(packetIndex: number, packetCount: number): number {
  if (packetCount === 1) return SINGLE_PACKET;
  if (packetIndex === 0) return FIRST_PACKET;
  if (packetIndex === packetCount - 1) return LAST_PACKET;
  return MIDDLE_PACKET;
}

function framePayload(payload: Uint8Array): Uint8Array {
  const frame = new Uint8Array(payload.length + 5);
  frame[0] = FRAME_START;
  frame[1] = payload.length;
  frame[2] = checksumApiLevel3Payload(payload);
  frame[3] = PAYLOAD_START;
  frame.set(payload, 4);
  frame[frame.length - 1] = FRAME_END;
  return frame;
}

export function encodeApiLevel3Packets(
  scene: readonly ApiLevel3Light[],
): readonly Uint8Array[] {
  validateScene(scene);

  const packetCount = Math.max(1, Math.ceil(scene.length / LIGHTS_PER_PACKET));
  const packets: Uint8Array[] = [];

  for (let packetIndex = 0; packetIndex < packetCount; packetIndex += 1) {
    const firstLightIndex = packetIndex * LIGHTS_PER_PACKET;
    const lights = scene.slice(firstLightIndex, firstLightIndex + LIGHTS_PER_PACKET);
    const payload = new Uint8Array(1 + lights.length * 3);
    payload[0] = markerForPacket(packetIndex, packetCount);

    lights.forEach((light, lightIndex) => {
      const offset = 1 + lightIndex * 3;
      payload[offset] = light.ledPosition & 0xff;
      payload[offset + 1] = light.ledPosition >>> 8;
      payload[offset + 2] = light.color;
    });

    packets.push(framePayload(payload));
  }

  return packets;
}

export function splitApiLevel3Writes(
  framedPackets: readonly Uint8Array[],
  maxWriteBytes = DEFAULT_MAX_WRITE_BYTES,
): readonly Uint8Array[] {
  assertIntegerInRange(maxWriteBytes, 1, Number.MAX_SAFE_INTEGER, 'maxWriteBytes', 'Write');
  if (framedPackets.length === 0) {
    throw new Error('At least one framed packet is required');
  }

  const byteLength = framedPackets.reduce((total, packet) => total + packet.length, 0);
  const message = new Uint8Array(byteLength);
  let offset = 0;
  for (const packet of framedPackets) {
    message.set(packet, offset);
    offset += packet.length;
  }

  const writes: Uint8Array[] = [];
  for (let start = 0; start < message.length; start += maxWriteBytes) {
    writes.push(message.slice(start, start + maxWriteBytes));
  }
  return writes;
}

export function encodeApiLevel3Scene(
  scene: readonly ApiLevel3Light[],
): readonly Uint8Array[] {
  return splitApiLevel3Writes(encodeApiLevel3Packets(scene));
}
