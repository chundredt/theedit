import type { AppData, Habit, ID, ISODate } from './types';
import { addDays, toDate } from '../lib/format';

/** 0 = Monday … 6 = Sunday */
export const weekdayIndex = (iso: ISODate) => (toDate(iso).getDay() + 6) % 7;

export function isDue(h: Habit, date: ISODate): boolean {
  if (h.archived || date < h.createdAt) return false;
  return h.days.length === 0 || h.days.includes(weekdayIndex(date));
}

export function countOn(data: AppData, id: ID, date: ISODate): number {
  return data.habitLogs[date]?.[id] || 0;
}

export function isDone(data: AppData, h: Habit, date: ISODate): boolean {
  return countOn(data, h.id, date) >= h.target - 1e-9;
}

/** Consecutive scheduled days completed, ending today (today counts only once done). */
export function streak(data: AppData, h: Habit, today: ISODate): number {
  let n = 0;
  let d = isDone(data, h, today) || !isDue(h, today) ? today : addDays(today, -1);
  for (let i = 0; i < 400 && d >= h.createdAt; i++, d = addDays(d, -1)) {
    if (!isDue(h, d)) continue;
    if (!isDone(data, h, d)) break;
    n++;
  }
  return n;
}

export function bestStreak(data: AppData, h: Habit, today: ISODate): number {
  let best = 0;
  let cur = 0;
  for (let d = h.createdAt; d <= today; d = addDays(d, 1)) {
    if (!isDue(h, d)) continue;
    if (isDone(data, h, d)) best = Math.max(best, ++cur);
    else if (d < today) cur = 0;
  }
  return best;
}

/** Share of scheduled habits completed on a day (0–1), or null if nothing was scheduled. */
export function dayScore(data: AppData, date: ISODate): number | null {
  const due = data.habits.filter((h) => isDue(h, date));
  if (!due.length) return null;
  return due.filter((h) => isDone(data, h, date)).length / due.length;
}

/** Completion rate over the last n days for one habit. */
export function completionRate(data: AppData, h: Habit, today: ISODate, n = 30): number {
  let due = 0;
  let done = 0;
  for (let i = 0; i < n; i++) {
    const d = addDays(today, -i);
    if (!isDue(h, d)) continue;
    if (d === today && !isDone(data, h, d)) continue; // today isn't over yet
    due++;
    if (isDone(data, h, d)) done++;
  }
  return due ? done / due : 0;
}

/** A habit you track by amount (litres, steps, pages…) rather than a single tick. */
export const isCounter = (h: Habit) => h.target !== 1 || !!h.unit || (h.step !== undefined && h.step !== 1);
export const stepOf = (h: Habit) => (h.step && h.step > 0 ? h.step : 1);
const r2 = (n: number) => Math.round(n * 100) / 100;
export const fmtAmount = (n: number) => String(r2(n));
/** One tap of + or −. */
export function bump(h: Habit, current: number, dir: 1 | -1): number {
  return r2(Math.max(0, Math.min(h.target * 3, current + dir * stepOf(h))));
}
export const amountLabel = (h: Habit, c: number) => `${fmtAmount(c)} of ${fmtAmount(h.target)}${h.unit ? ` ${h.unit}` : ''}`;
