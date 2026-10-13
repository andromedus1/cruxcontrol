export interface BackNavigationPort {
  register(action: () => boolean | void, priority: number): () => void;
}

export function createBackNavigation() {
  let next = 0;
  const actions = new Map<number, { action: () => boolean | void; priority: number }>();
  return {
    register(action: () => boolean | void, priority: number) {
      const id = ++next;
      actions.set(id, { action, priority });
      return () => { actions.delete(id); };
    },
    dispatch(): boolean {
      const ordered = [...actions.entries()].sort((a, b) => b[1].priority - a[1].priority || b[0] - a[0]);
      for (const [, { action }] of ordered) if (action() !== false) return true;
      return false;
    },
    close() { actions.clear(); },
  };
}
