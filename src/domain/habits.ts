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
  return countOn(data, h.id, date) >= h.target;
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
