export type ClimbNavigationDirection = 'previous' | 'next';

/**
 * Result of moving to a neighbor. Synchronous moves return nothing; a surface
 * that must load more results (catalog pages) returns a promise that resolves
 * `false` when it discovers there is no neighbor after all.
 */
export type ClimbNavigationResult = void | Promise<boolean>;

/** Position of the viewed climb in the list it was opened from. */
export interface ClimbNavigation {
  readonly positionLabel: string; // "12 of 340" | "12 of 50+"
  readonly canPrevious: boolean;
  readonly canNext: boolean;
  readonly onPrevious: () => ClimbNavigationResult;
  readonly onNext: () => ClimbNavigationResult;
}

export interface ListNavigationOptions {
  /** More results exist after the last key (shown as "+"). */
  readonly more?: boolean;
  /** Moves past the last key; only offered while `more` is true. */
  readonly onNextBeyond?: () => ClimbNavigationResult;
  /** Moves before the first key, e.g. to an earlier page. */
  readonly onPreviousBeyond?: () => ClimbNavigationResult;
  /** Number of results before the first key. */
  readonly offset?: number;
}

export function endAnnouncement(direction: ClimbNavigationDirection): string {
  return direction === 'previous' ? 'First climb' : 'Last climb';
}

/** Ordered previous/next over the list as shown; null when `current` is not in it. */
export function listNavigation<K>(
  keys: readonly K[],
  current: K,
  select: (key: K) => void,
  options: ListNavigationOptions = {},
): ClimbNavigation | null {
  const index = keys.indexOf(current);
  if (index < 0) return null;
  const offset = Math.max(0, options.offset ?? 0);
  const more = Boolean(options.more);
  const nextBeyond = more ? options.onNextBeyond : undefined;
  const previousBeyond = options.onPreviousBeyond;
  const last = keys.length - 1;
  return {
    positionLabel: `${offset + index + 1} of ${offset + keys.length}${more ? '+' : ''}`,
    canPrevious: index > 0 || Boolean(previousBeyond),
    canNext: index < last || Boolean(nextBeyond),
    onPrevious: () => {
      if (index > 0) return select(keys[index - 1]!);
      return previousBeyond?.();
    },
    onNext: () => {
      if (index < last) return select(keys[index + 1]!);
      return nextBeyond?.();
    },
  };
}
