import { createContext, useContext, useEffect, useRef } from 'react';
import type { BackNavigationPort } from './back-navigation.ts';

export const backNavigationContext = createContext<BackNavigationPort | undefined>(undefined);

// A guarded no-op consumes Back rather than closing a lower surface.
export function useBackAction(action: () => boolean | void, enabled = true, priority = 100) {
  const port = useContext(backNavigationContext);
  const current = useRef(action);
  current.current = action;
  useEffect(() => {
    if (enabled && port) return port.register(() => current.current(), priority);
  }, [enabled, port, priority]);
}
