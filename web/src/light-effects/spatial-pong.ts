export interface PongPose {
  readonly ball: Readonly<{ x: number; y: number }>;
  readonly leftPaddleY: number;
  readonly rightPaddleY: number;
}
const fraction = (value: number) => ((value % 1) + 1) % 1;
const triangle = (value: number) => Math.abs(fraction(value) * 2 - 1);
function offset(label: string, seed: number): number {
  let value = seed | 0;
  for (const character of label) value = Math.imul(value ^ character.codePointAt(0)!, 16777619);
  return (value >>> 0) / 0x1_0000_0000;
}

/** Each paddle travels between its own consecutive wall contacts. */
export function samplePongPose(
  seed: number,
  periodMs: number,
  phase: number,
  direction: 'forward' | 'reverse',
): PongPose {
  const rallies = 2 + Math.max(1, Math.round(periodMs / 45_000));
  const time = direction === 'forward' ? phase : -phase;
  const xOffset = offset('pong-x', seed);
  const yOffset = offset('pong-y', seed);
  const horizontalPhase = time * rallies + xOffset;
  const ballY = (at: number) => 0.1 + triangle(at * (rallies + 1) + yOffset) * 0.8;
  const paddleY = (wallPhase: number) => {
    const previousContact = Math.floor(horizontalPhase - wallPhase) + wallPhase;
    const progress = horizontalPhase - previousContact;
    const eased = progress * progress * (3 - 2 * progress);
    const from = ballY((previousContact - xOffset) / rallies);
    const to = ballY((previousContact + 1 - xOffset) / rallies);
    return from + (to - from) * eased;
  };
  return Object.freeze({
    ball: Object.freeze({ x: 0.08 + triangle(horizontalPhase) * 0.84, y: ballY(time) }),
    leftPaddleY: paddleY(0.5),
    rightPaddleY: paddleY(0),
  });
}
