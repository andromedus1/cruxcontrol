/** A complete out-and-back crossing planned against periodic traffic before playback. */
export interface FroggerPosition {
  readonly x: number;
  readonly y: number;
}
interface Vehicle {
  readonly id: number;
  readonly lane: number;
  readonly offset: number;
  readonly direction: number;
}
interface Hop {
  readonly start: number;
  readonly end: number;
  readonly from: number;
  readonly to: number;
}
export interface FroggerPlan {
  readonly x: number;
  readonly banks: readonly number[];
  readonly laneHeights: readonly number[];
  readonly vehicles: readonly Vehicle[];
  readonly hops: readonly Hop[];
}
export interface FroggerPose {
  readonly frog: FroggerPosition;
  readonly traffic: readonly (FroggerPosition & { readonly id: number; readonly lane: number })[];
}
const fraction = (value: number) => ((value % 1) + 1) % 1;
const travelFraction = 0.52;
const margin = 0.18;
const span = 1 + margin * 2;
const clearance = 0.18;
const pause = 0.003;
function random(seed: number, salt: number): number {
  let value = Math.imul((seed | 0) ^ salt, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 0x1_0000_0000;
}

/** Traffic has two trips per loop, alternating lane directions and a seeded convoy gap. */
export function prepareFroggerPlan(
  lanes: number,
  seed: number,
  trafficBudget: number,
): FroggerPlan {
  const count = Math.max(1, Math.min(8, Math.round(lanes)));
  const laneHeights = Array.from(
    { length: count },
    (_, lane) => 0.06 + ((lane + 0.5) * 0.88) / count,
  );
  const banks = Array.from({ length: count + 1 }, (_, bank) => 0.06 + (bank * 0.88) / count);
  const vehicles: Vehicle[] = Array.from(
    { length: Math.max(0, Math.min(count * 2, Math.floor(trafficBudget))) },
    (_, id) => {
      const lane = id % count;
      return Object.freeze({
        id,
        lane,
        offset: random(seed, lane + 1) * 0.1 + Math.floor(id / count) * 0.16,
        direction: lane % 2 === 0 ? 1 : -1,
      });
    },
  );
  const x = 0.35 + random(seed, 101) * 0.3;
  // Conservatively keep the entire hop clear, including the two-light frog's width.
  // Vehicle x is linear during each trip, so these occupied intervals are exact.
  const danger = laneHeights.map((_, lane) =>
    vehicles
      .filter((vehicle) => vehicle.lane === lane)
      .flatMap((vehicle) => {
        const low =
          vehicle.direction > 0
            ? (x - clearance + margin) / span
            : (1 + margin - x - clearance) / span;
        const high =
          vehicle.direction > 0
            ? (x + clearance + margin) / span
            : (1 + margin - x + clearance) / span;
        return [-1, 0, 1, 2].map((trip) => ({
          start: (vehicle.offset + low * travelFraction + trip) / 2,
          end: (vehicle.offset + high * travelFraction + trip) / 2,
        }));
      })
      .sort((a, b) => a.start - b.start),
  );
  const duration = 0.06 / count;
  const safeStart = (lane: number, earliest: number) => {
    let start = earliest;
    for (const occupied of danger[lane]!) {
      if (start + duration >= occupied.start && start <= occupied.end) start = occupied.end + pause;
    }
    return start;
  };
  const crossing = (reverse: boolean, half: number): Hop[] => {
    const make = (early: boolean) => {
      const result: Hop[] = [];
      let available = half + (early ? 0.035 : 0.4);
      for (let step = 0; step < count; step += 1) {
        const from = reverse ? count - step : step;
        const to = from + (reverse ? -1 : 1);
        const lane = Math.min(from, to);
        const desired = early ? half + 0.035 + (step * 0.34) / count : available;
        const start = safeStart(lane, Math.max(available, desired));
        const end = start + duration;
        result.push(Object.freeze({ start, end, from, to }));
        available = end + pause;
      }
      return result;
    };
    const early = make(true);
    // Every generated convoy is off-board during .4–.5 of each half-cycle.
    // If staggered gaps cannot fit the full crossing, wait on the bank for that
    // known common gap. The complete crossing plus pauses fits inside it.
    return early[early.length - 1]!.end < half + 0.49 ? early : make(false);
  };
  return Object.freeze({
    x,
    banks: Object.freeze(banks),
    laneHeights: Object.freeze(laneHeights),
    vehicles: Object.freeze(vehicles),
    hops: Object.freeze([...crossing(false, 0), ...crossing(true, 0.5)]),
  });
}

export function sampleFroggerPlan(plan: FroggerPlan, phase: number): FroggerPose {
  const time = fraction(phase);
  let y = plan.banks[0]!;
  for (const hop of plan.hops) {
    if (time < hop.start) break;
    if (time >= hop.end) {
      y = plan.banks[hop.to]!;
      continue;
    }
    const progress = (time - hop.start) / (hop.end - hop.start);
    const eased = progress * progress * (3 - 2 * progress);
    y = plan.banks[hop.from]! + (plan.banks[hop.to]! - plan.banks[hop.from]!) * eased;
    break;
  }
  const traffic = plan.vehicles.flatMap((vehicle) => {
    const local = fraction(time * 2 - vehicle.offset);
    if (local >= travelFraction) return [];
    const progress = local / travelFraction;
    const x = vehicle.direction > 0 ? -margin + progress * span : 1 + margin - progress * span;
    // Actors leave the board before re-entering. Do not project off-board cars to edge holds.
    return x < 0 || x > 1
      ? []
      : [
          Object.freeze({
            id: vehicle.id,
            lane: vehicle.lane,
            x,
            y: plan.laneHeights[vehicle.lane]!,
          }),
        ];
  });
  return Object.freeze({ frog: Object.freeze({ x: plan.x, y }), traffic: Object.freeze(traffic) });
}
