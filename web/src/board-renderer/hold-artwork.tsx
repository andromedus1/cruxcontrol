import type { BoardPlacementDefinition } from '../domain/boards/definition';

export type HoldArchetype =
  | 'edge'
  | 'wedge'
  | 'dish'
  | 'pinch'
  | 'pebble'
  | 'rail'
  | 'scoop'
  | 'block';
export interface HoldArtworkChoice {
  readonly archetype: HoldArchetype;
  readonly rotation: number;
  readonly scaleX: number;
  readonly scaleY: number;
}

const paths: Readonly<Record<HoldArchetype, string>> = {
  edge: 'M-2-1.1 Q0-1.8 2-.8 L1.5 1.2 Q0 1.7-1.7 1Z',
  wedge: 'M-1.9 1.3 L-1.4-1.4 1.8-.7 1.4 1.4Z',
  dish: 'M-1.8-.2 Q-1.3-1.8.5-1.5 Q2-.8 1.6.8 Q.5 1.8-1.4 1.2Z',
  pinch: 'M-1.2-1.8 Q.1-1.2 1.2-1.7 L1.7 1.4 Q.2 1.9-1.5 1.2Z',
  pebble: 'M-1.5-1 Q-.4-2 1.2-1.1 Q2 .1 1.1 1.5 Q-.5 2-1.7.7Z',
  rail: 'M-2-1.4 L1.7-1.1 2 1-1.8 1.4Z',
  scoop: 'M-1.8-1.2 Q0-2 1.8-1 L1.3 1.4 Q0 .4-1.4 1.5Z',
  block: 'M-1.7-1.6 L1.5-1.4 1.8 1.3-1.4 1.7Z',
};
const archetypes = Object.keys(paths) as HoldArchetype[];

function hash(text: string): number {
  let value = 2166136261;
  for (const character of text) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return value >>> 0;
}

// This pure selector intentionally shares the component's public artwork module.
// eslint-disable-next-line react-refresh/only-export-components
export function chooseHoldArtwork(placement: BoardPlacementDefinition): HoldArtworkChoice {
  const value = hash(`${placement.id}:${placement.native.setId}`);
  return {
    archetype: archetypes[value % archetypes.length],
    rotation: ((value >>> 3) % 24) * 15,
    scaleX: 0.86 + ((value >>> 8) % 9) * 0.035,
    scaleY: 0.82 + ((value >>> 12) % 10) * 0.038,
  };
}

export function HoldArtwork({
  choice,
  selected,
}: {
  readonly choice: HoldArtworkChoice;
  readonly selected: boolean;
}) {
  const transform = `rotate(${choice.rotation}) scale(${choice.scaleX} ${choice.scaleY})`;
  return (
    <g
      className={`board-hold__artwork ${selected ? 'is-selected' : 'is-neutral'}`}
      transform={transform}
    >
      <path
        className="board-hold__shadow"
        d={paths[choice.archetype]}
        transform="translate(.18 .25)"
      />
      <path
        className="board-hold__body"
        data-archetype={choice.archetype}
        d={paths[choice.archetype]}
      />
      <path className="board-hold__highlight" d="M-1.1-.7 Q0-1.25 1-.65" />
      <circle className="board-hold__bolt" cx="0" cy="0" r=".22" />
    </g>
  );
}
