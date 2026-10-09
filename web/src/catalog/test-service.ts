import { kilterFullride7x10Definition } from '../domain/boards/definitions/kilter-fullride-7x10.ts';
import { createCatalogService } from './service.ts';

export function unopenedCatalogService() {
  return createCatalogService(kilterFullride7x10Definition, {
    createPort: () => { throw new Error('The catalog test service must remain unopened.'); },
    fetcher: globalThis.fetch.bind(globalThis),
  });
}
