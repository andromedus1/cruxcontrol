import { DraftRepositoryError, translateDraftStorageError } from './errors.ts';
import { openDraftDatabase } from './open-draft-database.ts';

describe('draft storage failures', () => {
  it('translates unavailable factories and quota errors to stable codes', async () => {
    const cause = new DOMException('denied', 'SecurityError');
    await expect(
      openDraftDatabase({
        open: () => {
          throw cause;
        },
      }),
    ).rejects.toMatchObject({
      code: 'unavailable',
      cause,
    });
    const quota = new DOMException('full', 'QuotaExceededError');
    expect(translateDraftStorageError(quota, 'write failed')).toMatchObject({
      code: 'quota-exceeded',
      cause: quota,
    });
  });

  it('does not erase an existing typed repository error', () => {
    const error = new DraftRepositoryError('conflict', 'already typed');
    expect(translateDraftStorageError(error, 'ignored')).toBe(error);
  });
});
