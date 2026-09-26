import type { BoardInstallationId } from '../installations/contracts.ts';
import type { DraftContent, DraftRevision, LocalClimbDraft, LocalDraftId } from './types.ts';

export interface DraftListOptions {
  readonly installationId?: BoardInstallationId;
  readonly collection?: 'active' | 'drafts' | 'finished' | 'trash';
  /** Opt into partial reads with diagnostics; unreadable rows stay unchanged in storage. */
  readonly onUnreadableRecord?: (issue: DraftReadIssue) => void;
}

export interface DraftReadIssue {
  readonly key: string;
  readonly message: string;
}

export interface LocalDraftRepository {
  create(content: DraftContent): Promise<LocalClimbDraft>;
  get(id: LocalDraftId): Promise<LocalClimbDraft | null>;
  list(options?: DraftListOptions): Promise<readonly LocalClimbDraft[]>;
  update(
    id: LocalDraftId,
    expectedRevision: DraftRevision,
    content: DraftContent,
  ): Promise<LocalClimbDraft>;
  trash(id: LocalDraftId, expectedRevision: DraftRevision): Promise<LocalClimbDraft>;
  restore(id: LocalDraftId, expectedRevision: DraftRevision): Promise<LocalClimbDraft>;
  deletePermanently(id: LocalDraftId, expectedRevision: DraftRevision): Promise<void>;
}

export interface DraftRepositoryOptions {
  readonly now?: () => Date;
  readonly createId?: () => string;
}
