import { describe, expect, it } from 'vitest';
import { samplePongPose } from './spatial-pong';

describe('Pong contact choreography', () => {
  it.each([0, 5, 7, 42])('meets the ball at every wall reflection for seed %s', (seed) => {
    for (const period of [5000, 90000, 150000, 179999])
      for (const direction of ['forward', 'reverse'] as const) {
        const samples = 10000;
        let contacts = 0;
        let previous = samplePongPose(seed, period, -1 / samples, direction);
        let current = samplePongPose(seed, period, 0, direction);
        for (let frame = 0; frame < samples; frame += 1) {
          const next = samplePongPose(seed, period, (frame + 1) / samples, direction);
          if ((current.ball.x - previous.ball.x) * (next.ball.x - current.ball.x) < 0) {
            contacts += 1;
            const left = current.ball.x < 0.5;
            expect(Math.abs(current.ball.x - (left ? 0.08 : 0.92))).toBeLessThan(0.002);
            expect(
              Math.abs(current.ball.y - (left ? current.leftPaddleY : current.rightPaddleY)),
            ).toBeLessThan(0.004);
          }
          previous = current;
          current = next;
        }
        expect(contacts).toBeGreaterThanOrEqual(6);
      }
  });

  it('reverses the whole trajectory and joins both paddle motions across the loop', () => {
    for (const phase of [0, 0.01, 0.249, 0.5, 0.751, 0.999]) {
      const forward = samplePongPose(5, 90000, phase, 'forward');
      const reverse = samplePongPose(5, 90000, 1 - phase, 'reverse');
      expect(reverse.ball.x).toBeCloseTo(forward.ball.x, 10);
      expect(reverse.ball.y).toBeCloseTo(forward.ball.y, 10);
      expect(reverse.leftPaddleY).toBeCloseTo(forward.leftPaddleY, 10);
      expect(reverse.rightPaddleY).toBeCloseTo(forward.rightPaddleY, 10);
    }
    const frames = [-2, -1, 0, 1].map((frame) => samplePongPose(42, 90000, frame / 180, 'forward'));
    for (let frame = 1; frame < frames.length; frame += 1) {
      expect(Math.abs(frames[frame]!.leftPaddleY - frames[frame - 1]!.leftPaddleY)).toBeLessThan(
        0.03,
      );
      expect(Math.abs(frames[frame]!.rightPaddleY - frames[frame - 1]!.rightPaddleY)).toBeLessThan(
        0.03,
      );
      expect(Math.abs(frames[frame]!.ball.x - frames[frame - 1]!.ball.x)).toBeLessThan(0.04);
      expect(Math.abs(frames[frame]!.ball.y - frames[frame - 1]!.ball.y)).toBeLessThan(0.05);
    }
  });
});
