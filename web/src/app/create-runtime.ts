import type { BoardLightController } from '../board-control/light-controller';
import { IndexedDbLocalDraftRepository, openDraftDatabase, type LocalDraftRepository } from '../drafts';
import type { ConfiguredBoardInstallation } from '../installations/contracts';
import { activeInstallationId, createAppInstallationRegistry } from './installations';

export interface CruxControlRuntime {
  readonly installation: ConfiguredBoardInstallation;
  readonly drafts: LocalDraftRepository;
  readonly controller: BoardLightController | null;
  close(): void;
}

export async function createCruxControlRuntime(): Promise<CruxControlRuntime> {
  const database = await openDraftDatabase();
  const drafts = new IndexedDbLocalDraftRepository(database);
  try {
    const installation = createAppInstallationRegistry().require(activeInstallationId);
    return Object.freeze({ installation, drafts, controller: installation.createController(), close: () => database.close() });
  } catch (error) { database.close(); throw error; }
}
