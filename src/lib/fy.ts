/**
 * Indian financial year helpers (April – March).
 * FY 2026-27 runs from 2026-04-01 to 2027-03-31.
 */

/** Returns the FY string for a given date, e.g. "2026-27" */
export function getFY(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-based
  const startYear = month >= 4 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

/** Returns { start, end } Date objects for the given FY string "2026-27" */
export function getFYBounds(fy: string): { start: Date; end: Date } {
  const startYear = parseInt(fy.split("-")[0]);
  return {
    start: new Date(startYear, 3, 1),        // April 1
    end:   new Date(startYear + 1, 2, 31),   // March 31
  };
}

/** Returns the FY start date for the given date */
export function getFYStart(date: Date = new Date()): Date {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const startYear = month >= 4 ? year : year - 1;
  return new Date(startYear, 3, 1);
}

/** Returns months elapsed in current FY (1 = April is first month) */
export function getFYMonthsElapsed(date: Date = new Date()): number {
  const month = date.getMonth() + 1;
  return month >= 4 ? month - 3 : month + 9;
}

/** Returns total months in FY (always 12) */
export const FY_MONTHS = 12;

/** Returns progress through the current FY as 0–100 */
export function getFYProgress(date: Date = new Date()): number {
  const start = getFYStart(date);
  const end = new Date(start.getFullYear() + 1, 3, 1);
  return Math.round(((date.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100);
}

/** Returns the yyyy-MM strings for every month in the current FY */
export function getFYMonths(date: Date = new Date()): string[] {
  const start = getFYStart(date);
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}
