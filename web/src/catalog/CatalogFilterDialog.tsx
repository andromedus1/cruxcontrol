import { useEffect, useRef, useState } from 'react';
import { useBackAction } from '../app/use-back-action.ts';
import type { CatalogGradeOption, CatalogRatingScale } from './types.ts';
import { ratingScaleDescription, type CatalogSourceCopy } from './presentation.ts';
import './catalog.css';

export interface CatalogFilterValues {
  readonly minGrade: number | null;
  readonly maxGrade: number | null;
  readonly minRating: number | null;
  readonly minAscents: number | null;
  readonly setter: string;
}

export const EMPTY_CATALOG_FILTERS: CatalogFilterValues = Object.freeze({
  minGrade: null,
  maxGrade: null,
  minRating: null,
  minAscents: null,
  setter: '',
});

interface FilterDraft {
  readonly minGrade: string;
  readonly maxGrade: string;
  readonly minRating: string;
  readonly minAscents: string;
  readonly setter: string;
}

function draftFrom(filters: CatalogFilterValues): FilterDraft {
  return {
    minGrade: filters.minGrade === null ? '' : String(filters.minGrade),
    maxGrade: filters.maxGrade === null ? '' : String(filters.maxGrade),
    minRating: filters.minRating === null ? '' : String(filters.minRating),
    minAscents: filters.minAscents === null ? '' : String(filters.minAscents),
    setter: filters.setter,
  };
}

export interface CatalogFilterDialogProps {
  readonly initial: CatalogFilterValues;
  readonly grades: readonly CatalogGradeOption[];
  /** Rating range declared by the installed catalog. */
  readonly ratingScale: CatalogRatingScale;
  readonly source: CatalogSourceCopy;
  readonly onApply: (filters: CatalogFilterValues) => void;
  readonly onClose: () => void;
}

export function CatalogFilterDialog({
  initial,
  grades,
  ratingScale,
  source,
  onApply,
  onClose,
}: CatalogFilterDialogProps): React.JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closing = useRef(false);
  const [draft, setDraft] = useState(() => draftFrom(initial));
  const [error, setError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    closing.current = false;
    dialog.showModal();
    dialog.querySelector<HTMLElement>('[data-dialog-title]')?.focus();
  }, []);

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    if (dialogRef.current?.open) dialogRef.current.close();
    onClose();
  };
  useBackAction(close, true, 110);

  const apply = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const minGrade = draft.minGrade === '' ? null : Number(draft.minGrade);
    const maxGrade = draft.maxGrade === '' ? null : Number(draft.maxGrade);
    const minRating = draft.minRating === '' ? null : Number(draft.minRating);
    const minAscents = draft.minAscents === '' ? null : Number(draft.minAscents);
    if ((minGrade !== null && !Number.isInteger(minGrade))
      || (maxGrade !== null && !Number.isInteger(maxGrade))
      || (minGrade !== null && maxGrade !== null && minGrade > maxGrade)
      || (minRating !== null
        && (!Number.isFinite(minRating) || minRating < ratingScale.min || minRating > ratingScale.max))
      || (minAscents !== null && (!Number.isSafeInteger(minAscents) || minAscents < 0))
      || draft.setter.length > 200) {
      setError(`Check the grade range, rating from ${ratingScale.min} to ${ratingScale.max}, and whole-number send count.`);
      return;
    }
    setError('');
    onApply({
      minGrade,
      maxGrade,
      minRating,
      minAscents,
      setter: draft.setter.trim(),
    });
    close();
  };

  const reset = () => {
    setDraft({ minGrade: '', maxGrade: '', minRating: '', minAscents: '', setter: '' });
    setError('');
  };

  return (
    <dialog
      ref={dialogRef}
      className="catalog-filter-dialog"
      aria-labelledby="catalog-filter-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <form className="catalog-filter-dialog__form" onSubmit={apply}>
        <header className="catalog-filter-dialog__heading">
          <div>
            <p className="catalog-eyebrow">{source.name}</p>
            <h2 id="catalog-filter-title" data-dialog-title tabIndex={-1}>Filter climbs</h2>
          </div>
          <button
            className="catalog-icon-button"
            type="button"
            aria-label="Close filters"
            onClick={close}
          >×</button>
        </header>

        <fieldset className="catalog-grade-range">
          <legend>Grade range</legend>
          <div className="catalog-filter-pair">
            <label className="catalog-field">
              <span>From</span>
              <select
                className="catalog-input"
                value={draft.minGrade}
                onChange={(event) => {
                  setError('');
                  setDraft((current) => ({ ...current, minGrade: event.target.value }));
                }}
              >
                <option value="">Any grade</option>
                {grades.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="catalog-field">
              <span>To</span>
              <select
                className="catalog-input"
                value={draft.maxGrade}
                onChange={(event) => {
                  setError('');
                  setDraft((current) => ({ ...current, maxGrade: event.target.value }));
                }}
              >
                <option value="">Any grade</option>
                {grades.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
        </fieldset>

        <div className="catalog-filter-dialog__fields">
          <div className="catalog-filter-pair">
            <label className="catalog-field">
              <span>Minimum rating</span>
              <input
                className="catalog-input"
                type="number"
                min={ratingScale.min}
                max={ratingScale.max}
                step="0.1"
                inputMode="decimal"
                placeholder="Any"
                value={draft.minRating}
                onChange={(event) => {
                  setError('');
                  setDraft((current) => ({ ...current, minRating: event.target.value }));
                }}
              />
            </label>
            <label className="catalog-field">
              <span>Minimum sends</span>
              <input
                className="catalog-input"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                placeholder="Any"
                value={draft.minAscents}
                onChange={(event) => {
                  setError('');
                  setDraft((current) => ({ ...current, minAscents: event.target.value }));
                }}
              />
            </label>
          </div>
          <p className="catalog-field__help">
            Rating uses a {ratingScaleDescription(ratingScale)} scale. Sends count distinct climbers at this angle
            {source.kind === 'boardsesh' ? ' and can go down as well as up between catalog versions.' : '.'}
          </p>
          <label className="catalog-field">
            <span>Setter</span>
            <input
              className="catalog-input"
              type="search"
              maxLength={200}
              autoComplete="off"
              placeholder="Search setter names"
              value={draft.setter}
              onChange={(event) => {
                setError('');
                setDraft((current) => ({ ...current, setter: event.target.value }));
              }}
            />
          </label>
        </div>

        {error && <p className="catalog-filter-error" role="alert">{error}</p>}
        <footer className="catalog-filter-dialog__actions">
          <button className="catalog-button catalog-button--ghost" type="button" onClick={reset}>Reset</button>
          <div>
            <button className="catalog-button catalog-button--secondary" type="button" onClick={close}>Cancel</button>
            <button className="catalog-button catalog-button--primary" type="submit">Apply filters</button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
