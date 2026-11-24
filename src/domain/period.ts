import type { ISODate, PeriodKey } from './types';
import { addDays, daysBetween, fmtDate, monthName, toISO } from '../lib/format';

/**
 * Budget periods. With startDay = 1 a period is a calendar month.
 * With a payday start (e.g. 25) the period runs 25 Oct – 24 Nov and is named after
 * the month it ends in ("November 2026"), matching how a November salary is spent.
 */

function clampDay(year: number, month0: number, day: number): Date {
  const last = new Date(year, month0 + 1, 0).getDate();
  return new Date(year, month0, Math.min(day, last));
}

export function keyOf(year: number, month0: number): PeriodKey {
  const d = new Date(year, month0, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function parseKey(key: PeriodKey): { year: number; month0: number } {
  const [y, m] = key.split('-').map(Number);
  return { year: y, month0: m - 1 };
}

export function periodStart(key: PeriodKey, startDay: number): ISODate {
  const { year, month0 } = parseKey(key);
  if (startDay <= 1) return toISO(new Date(year, month0, 1));
  return toISO(clampDay(year, month0 - 1, startDay));
}

export function periodEnd(key: PeriodKey, startDay: number): ISODate {
  const { year, month0 } = parseKey(key);
  if (startDay <= 1) return toISO(new Date(year, month0 + 1, 0));
  return addDays(toISO(clampDay(year, month0, startDay)), -1);
}

export function periodKeyFor(date: ISODate, startDay: number): PeriodKey {
  const [y, m] = date.split('-').map(Number);
  const key = keyOf(y, m - 1);
  if (startDay <= 1) return key;
  // On/after this month's start day → the period ending next month.
  const next = shiftPeriod(key, 1);
  return date >= periodStart(next, startDay) ? next : key;
}

export function shiftPeriod(key: PeriodKey, n: number): PeriodKey {
  const { year, month0 } = parseKey(key);
  return keyOf(year, month0 + n);
}

export function periodLabel(key: PeriodKey, short = false): string {
  const { year, month0 } = parseKey(key);
  return short ? `${monthName(month0, true)} ${String(year).slice(2)}` : `${monthName(month0)} ${year}`;
}

export function periodRangeLabel(key: PeriodKey, startDay: number): string {
  return `${fmtDate(periodStart(key, startDay))} – ${fmtDate(periodEnd(key, startDay))}`;
}

export function periodDays(key: PeriodKey, startDay: number): number {
  return daysBetween(periodStart(key, startDay), periodEnd(key, startDay)) + 1;
}

export function inPeriod(date: ISODate, key: PeriodKey, startDay: number): boolean {
  return date >= periodStart(key, startDay) && date <= periodEnd(key, startDay);
}

/** Days left in the period including today (0 if the period is over, full length if in the future). */
export function daysLeft(key: PeriodKey, startDay: number, today: ISODate): number {
  const start = periodStart(key, startDay);
  const end = periodEnd(key, startDay);
  if (today > end) return 0;
  if (today < start) return periodDays(key, startDay);
  return daysBetween(today, end) + 1;
}

/** Calendar date on which a monthly payment with `dueDay` falls inside the period. */
export function dueDateInPeriod(key: PeriodKey, startDay: number, dueDay: number): ISODate {
  const start = periodStart(key, startDay);
  const [sy, sm] = start.split('-').map(Number);
  const first = toISO(clampDay(sy, sm - 1, dueDay));
  if (first >= start) return first;
  return toISO(clampDay(sy, sm, dueDay));
}
