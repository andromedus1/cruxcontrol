/** Formats a YYYY-MM-DD calendar date (or the date part of an ISO instant) without local-offset drift. */
export function formatCalendarDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' })
    .format(new Date(`${value.slice(0, 10)}T00:00:00.000Z`));
}
