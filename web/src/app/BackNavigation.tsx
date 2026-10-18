import type { ReactNode } from 'react';
import type { BackNavigationPort } from './back-navigation.ts';
import { backNavigationContext } from './use-back-action.ts';

export function BackNavigationProvider({ port, children }: { readonly port?: BackNavigationPort; readonly children: ReactNode }) {
  return <backNavigationContext.Provider value={port}>{children}</backNavigationContext.Provider>;
}
