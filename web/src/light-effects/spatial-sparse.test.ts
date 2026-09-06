import { describe, expect, it } from 'vitest';
import type { BoardHoldAssignment, SpatialLightEffectGroup } from '../board-renderer/types';
import { quantizeApiLevel3ColorForApiLevel2 } from '../board-control/api-level-2-codec';
import { apiLevel3Color } from '../domain/boards/colors';
import { kilterFullride7x10Definition as definition } from '../domain/boards/definitions/kilter-fullride-7x10';
import type { LightScene } from '../domain/boards/light-scene';
import { renderAnimationFrame } from './frame';
import { createSpatialPreset } from './preset-library';
import { renderSpatialGroup } from './spatial-frame';
import { prepareSpatialGeometry } from './spatial-geometry';

const kinds = ['matrix-rain', 'fireflies', 'shooting-stars', 'jellyfish', 'embers'] as const;
const geometry = prepareSpatialGeometry(definition);
const assignments: readonly BoardHoldAssignment[] = [];
const point = (light: LightScene[number]) => geometry.byId.get(light.placementId)!;
const sceneAt = (group: SpatialLightEffectGroup, frame: number) => renderSpatialGroup(definition, assignments, group, frame * 500);
const framesOf = (group: SpatialLightEffectGroup) => Array.from({ length: Math.round(group.periodMs / 500) }, (_, frame) => sceneAt(group, frame));
const encodedLevel = (light: LightScene[number]) => {
  const color = quantizeApiLevel3ColorForApiLevel2(light.color);
  return ((color >> 6) & 3) + ((color >> 4) & 3) + ((color >> 2) & 3);
};

it.each(kinds)('%s stays inside every 1..11 hold reserve across full authored cycles', (kind) => {
  const reserved = new Set(Object.values(definition.rolePresets).map(({ lightColor }) => quantizeApiLevel3ColorForApiLevel2(lightColor)));
  reserved.add(0);
  for (const seed of [0, 7, -42]) for (const periodMs of [61_000, createSpatialPreset(kind).periodMs]) {
    for (let footprint = 1; footprint <= 11; footprint += 1) {
      const group = { ...createSpatialPreset(kind, seed), periodMs, footprint };
      const frames = framesOf(group);
      expect(frames.some((scene) => scene.length > 0)).toBe(true);
      for (const scene of frames) {
        expect(scene.length).toBeLessThanOrEqual(footprint);
        expect(new Set(scene.map(({ placementId }) => placementId)).size).toBe(scene.length);
        expect(scene.every(({ color }) => !reserved.has(quantizeApiLevel3ColorForApiLevel2(color)))).toBe(true);
      }
      expect(sceneAt(group, frames.length)).toEqual(frames[0]);
    }
  }
});

it.each(kinds)('%s applies masks to intended cells, preserves route colors, and responds to authored palette/intensity', (kind) => {
  const group = createSpatialPreset(kind, 7);
  const frames = framesOf(group);
  const frame = frames.findIndex((scene) => scene.length >= 2);
  expect(frame).toBeGreaterThanOrEqual(0);
  const first = frames[frame]![0]!.placementId;
  const second = frames[frame]![1]!.placementId;
  const painted: BoardHoldAssignment[] = [{ placementId: first, appearance: { kind: 'role', role: 'start' } }];
  const masked = { ...group, target: { scope: 'background-board' as const, include: [], exclude: [second] } };
  expect(renderSpatialGroup(definition, painted, masked, frame * 500))
    .toEqual(frames[frame]!.filter(({ placementId }) => placementId !== first && placementId !== second));
  const selected = { ...group, target: { scope: 'selected' as const, include: [first, second], exclude: [] } };
  expect(renderSpatialGroup(definition, painted, selected, frame * 500)).toEqual([frames[frame]![1]]);
  expect(renderAnimationFrame({ definition, assignments: painted, effectGroups: [masked], elapsedMs: frame * 500 }))
    .toContainEqual({ placementId: first, color: definition.rolePresets.start.lightColor });
  expect(sceneAt({ ...group, intensity: 0 }, frame)).toEqual([]);
  const recolored = { ...group, palette: [apiLevel3Color(0xe3)] };
  expect(sceneAt(recolored, frame).map(({ placementId }) => placementId)).toEqual(frames[frame]!.map(({ placementId }) => placementId));
  expect(sceneAt(recolored, frame)).not.toEqual(frames[frame]);
  expect(sceneAt({ ...group, intensity: .4 }, frame)).not.toEqual(frames[frame]);
  expect(renderSpatialGroup(definition, assignments, group, frame * 500 + 499)).toBe(sceneAt(group, frame));
});

describe('three-trail Matrix', () => {
  it('spends ten cells on aligned 4/3/3 trails with bright heads and age decay after API2 encoding', () => {
    const group = createSpatialPreset('matrix-rain', 0);
    expect(group.recipe).toEqual({ kind: 'matrix-rain', columns: 3, direction: 'down' });
    const frames = framesOf(group);
    const full = frames.find((scene) => scene.length === 10)!;
    expect(full).toBeDefined();
    const columns = new Map<number, LightScene[number][]>();
    for (const light of full) columns.set(point(light).x, [...columns.get(point(light).x) ?? [], light]);
    expect([...columns.values()].map((trail) => trail.length).sort()).toEqual([3, 3, 4]);
    for (const trail of columns.values()) {
      expect(encodedLevel(trail[0]!)).toBeGreaterThan(encodedLevel(trail[1]!));
      expect(encodedLevel(trail[1]!)).toBeGreaterThanOrEqual(encodedLevel(trail.at(-1)!));
      for (let i = 1; i < trail.length; i += 1) {
        expect(point(trail[i]!).y).toBeGreaterThan(point(trail[i - 1]!).y);
        expect(point(trail[i]!).y - point(trail[i - 1]!).y).toBeLessThan(.08);
      }
    }
  });

  it.each(Array.from({ length: 20 }, (_, index) => index + 1))('reaches every one of %i authored lanes across full cycles and reduced reserves', (columns) => {
    for (const seed of [0, 7, -42]) for (const footprint of [1, 2, 6, 10]) for (const periodMs of [61_000, 90_000, 180_000]) {
      const group = { ...createSpatialPreset('matrix-rain', seed), footprint, periodMs,
        recipe: { kind: 'matrix-rain' as const, direction: 'down' as const, columns } };
      const before = JSON.stringify(group);
      const frames = framesOf(group);
      const visited = new Set<number>();
      for (const scene of frames) {
        const xs = new Set(scene.map((light) => point(light).x));
        expect(xs.size).toBeLessThanOrEqual(Math.min(columns, 3));
        expect(scene.length).toBeLessThanOrEqual(footprint);
        for (const x of xs) visited.add(x);
      }
      expect(visited.size, `columns=${columns}, seed=${seed}, reserve=${footprint}, period=${periodMs}`).toBe(columns);
      expect(sceneAt(group, frames.length)).toEqual(frames[0]);
      expect(JSON.stringify(group)).toBe(before);
    }
  });
});

describe('natural sparse motion', () => {
  it('moves a firefly to its next perch only across dark intervals, including the loop join', () => {
    for (const seed of [0, 7, 42]) {
      const group = { ...createSpatialPreset('fireflies', seed), footprint: 1 };
      const frames = framesOf(group);
      expect(new Set(frames.flatMap((scene) => scene.map(({ placementId }) => placementId))).size).toBe(8);
      expect(frames.some((scene) => !scene.length)).toBe(true);
      for (let i = 0; i < frames.length; i += 1) {
        const current = frames[i]!, previous = frames[(i + frames.length - 1) % frames.length]!;
        if (current.length && previous.length) expect(current[0]!.placementId).toBe(previous[0]!.placementId);
      }
    }
  });

  it('gives shooting stars a descending head, trailing cells and a quiet gap between alternating passes', () => {
    const group = createSpatialPreset('shooting-stars', 0);
    const frames = framesOf(group);
    expect(frames.filter((scene) => !scene.length).length).toBeGreaterThan(frames.length / 2);
    expect(frames[0]).toEqual([]);
    expect(frames.at(-1)).toEqual([]);
    expect(Math.max(...frames.map((scene) => scene.length))).toBe(6);
    const headColor = frames.find((scene) => scene.length >= 4)![0]!.color;
    for (let pass = 0; pass < 8; pass += 1) {
      const heads = frames.slice(pass * 30, (pass + 1) * 30).flatMap((scene) => scene[0]?.color === headColor ? [scene[0]] : []);
      expect(heads.length).toBeGreaterThan(2);
      const first = point(heads[0]!), last = point(heads.at(-1)!);
      expect(last.y).toBeLessThan(first.y);
      expect((last.x - first.x) * (pass % 2 ? 1 : -1)).toBeGreaterThan(0);
      for (let i = 1; i < heads.length; i += 1) expect(point(heads[i]!).y).toBeLessThanOrEqual(point(heads[i - 1]!).y);
    }
    for (const scene of frames.filter((frame) => frame.length >= 3 && frame[0]!.color === headColor)) {
      expect(encodedLevel(scene[0]!)).toBeGreaterThan(encodedLevel(scene.at(-1)!));
      expect(point(scene.at(-1)!).y).toBeGreaterThanOrEqual(point(scene[0]!).y);
    }
  });

  it('keeps a compact pulsing jellyfish with tentacles below the bell and nearby seam poses', () => {
    const group = createSpatialPreset('jellyfish', 7);
    const frames = framesOf(group);
    const widths: number[] = [];
    for (const scene of frames) {
      const xs = scene.map((light) => point(light).x), ys = scene.map((light) => point(light).y);
      widths.push(Math.max(...xs) - Math.min(...xs));
      expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(.25);
      expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(.3);
      expect(scene.length).toBeGreaterThanOrEqual(6);
    }
    expect(Math.max(...widths) - Math.min(...widths)).toBeGreaterThan(.03);
    const full = frames.find((scene) => scene.length === 9)!;
    expect(full).toBeDefined();
    expect(Math.max(...full.slice(5).map((light) => point(light).y))).toBeLessThanOrEqual(Math.min(...full.slice(0, 5).map((light) => point(light).y)));
    for (const light of frames.at(-1)!) {
      expect(Math.min(...frames[0]!.map((next) => Math.hypot(point(light).x - point(next).x, point(light).y - point(next).y)))).toBeLessThan(.08);
    }
  });

  it('keeps six breathing coals low and at most four sparks rising above them', () => {
    const group = createSpatialPreset('embers', 0);
    const frames = framesOf(group);
    const coals = frames[0]!.slice(0, 6).map(({ placementId }) => placementId);
    expect(coals).toHaveLength(6);
    for (const scene of frames) {
      expect(scene.slice(0, 6).map(({ placementId }) => placementId)).toEqual(coals);
      expect(scene.slice(0, 6).every((light) => point(light).y < .2)).toBe(true);
      expect(scene.slice(6).length).toBeLessThanOrEqual(4);
    }
    expect(frames.some((scene) => scene.some((light) => point(light).y > .6))).toBe(true);
    expect(new Set(frames.map((scene) => scene[0]!.color)).size).toBeGreaterThan(1);
    for (const light of frames.at(-1)!.slice(6)) {
      expect(Math.min(...frames[0]!.slice(6).map((next) => Math.hypot(point(light).x - point(next).x, point(light).y - point(next).y)))).toBeLessThan(.08);
    }
  });
});
