import { describe, expect, it } from 'vitest';
import {
  assessStaticScene,
  chooseAnimationSchedule,
  FULLRIDE_API2_MEASURED_PROFILE,
  measuredCapacityProfile,
} from './capacity-policy';

describe('measured capacity policy', () => {
  it('publishes only the accepted API2 physical profile', () => {
    expect(measuredCapacityProfile(2)).toBe(FULLRIDE_API2_MEASURED_PROFILE);
    expect(measuredCapacityProfile(3)).toBeNull();
    expect(FULLRIDE_API2_MEASURED_PROFILE).toMatchObject({
      safeStaticLights: 127,
      safeInterChunkDelayMs: 20,
      omittedLightsPersist: false,
      animationPoints: [{ maxLights: 20, maxFps: 2, p95BatchMs: 448.4 }],
    });
  });

  it('accepts the static threshold and truthfully refuses the next light without truncation', () => {
    expect(assessStaticScene(FULLRIDE_API2_MEASURED_PROFILE, 127)).toEqual({
      accepted: true,
      cost: { apiLevel: 2, lightCount: 127, packetCount: 1, framedBytes: 260, writeCount: 13 },
    });
    expect(assessStaticScene(FULLRIDE_API2_MEASURED_PROFILE, 128)).toMatchObject({
      accepted: false,
      cost: { lightCount: 128, packetCount: 2, writeCount: 14 },
      warning: expect.stringMatching(/still saved.*not sent/i),
    });
  });

  it('uses full snapshots at two FPS and refuses the first unmeasured animation size', () => {
    expect(chooseAnimationSchedule(FULLRIDE_API2_MEASURED_PROFILE, 20, [448.4])).toEqual({
      fps: 2,
      interChunkDelayMs: 20,
      strategy: 'full-scene',
    });
    expect(chooseAnimationSchedule(FULLRIDE_API2_MEASURED_PROFILE, 21, [])).toMatchObject({
      fps: 0,
      strategy: 'full-scene',
      warning: expect.stringMatching(/measured animation limit of 20/i),
    });
  });

  it('downgrades from recent p95 before pausing an overloaded stream', () => {
    expect(chooseAnimationSchedule(FULLRIDE_API2_MEASURED_PROFILE, 20, [510])).toMatchObject({
      fps: 1,
      warning: expect.stringMatching(/reduced to 1 FPS/i),
    });
    expect(chooseAnimationSchedule(FULLRIDE_API2_MEASURED_PROFILE, 20, [1_001])).toMatchObject({
      fps: 0,
      warning: expect.stringMatching(/paused/i),
    });
  });
});
