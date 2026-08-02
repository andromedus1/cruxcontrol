import { render } from '@testing-library/react';
import { kilterFullride7x10Definition as fullride } from '../domain/boards/definitions/kilter-fullride-7x10';
import { chooseHoldArtwork, HoldArtwork } from './hold-artwork';

describe('independent hold artwork', () => {
  it('is deterministic, bounded, and covers all eight original archetypes', () => {
    const choices = fullride.placements.map(chooseHoldArtwork);
    expect(chooseHoldArtwork(fullride.placements[0])).toEqual(choices[0]);
    expect(new Set(choices.map(({ archetype }) => archetype))).toHaveLength(8);
    choices.forEach((choice) => {
      expect(choice.rotation).toBeGreaterThanOrEqual(0);
      expect(choice.rotation).toBeLessThan(360);
      expect(choice.scaleX).toBeGreaterThan(0);
      expect(choice.scaleY).toBeGreaterThan(0);
    });
  });

  it('renders a silhouette and bolt without an image or external reference', () => {
    const { container } = render(
      <svg>
        <HoldArtwork choice={chooseHoldArtwork(fullride.placements[0])} selected />
      </svg>,
    );
    expect(container.querySelector('[data-archetype]')).toBeInTheDocument();
    expect(container.querySelector('.board-hold__bolt')).toBeInTheDocument();
    expect(container.querySelector('image')).not.toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/https?:|kilter_fullride/);
  });
});
