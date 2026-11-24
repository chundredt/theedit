import type { AppData, ISODate, Routine, WorkoutLog } from './types';
import { addDays, mondayOf } from '../lib/format';
import { weekdayIndex } from './habits';

export function plannedFor(data: AppData, date: ISODate): Routine | undefined {
  const id = data.workoutSchedule[weekdayIndex(date)];
  return id ? data.routines.find((r) => r.id === id) : undefined;
}

export function logsOn(data: AppData, date: ISODate): WorkoutLog[] {
  return data.workoutLogs.filter((l) => l.date === date);
}

export function weekSummary(data: AppData, today: ISODate) {
  const start = mondayOf(today);
  const end = addDays(start, 6);
  const logs = data.workoutLogs.filter((l) => l.date >= start && l.date <= end);
  const planned = [0, 1, 2, 3, 4, 5, 6].filter((i) => data.workoutSchedule[i]).length;
  return { sessions: logs.length, minutes: logs.reduce((s, l) => s + l.minutes, 0), planned };
}

/** Consecutive weeks (ending this week) with at least `min` sessions. This week counts once reached. */
export function weekStreak(data: AppData, today: ISODate, min = 2): number {
  let n = 0;
  let w = mondayOf(today);
  const count = (ws: ISODate) => data.workoutLogs.filter((l) => l.date >= ws && l.date <= addDays(ws, 6)).length;
  if (count(w) < min) w = addDays(w, -7);
  for (let i = 0; i < 104 && count(w) >= min; i++, w = addDays(w, -7)) n++;
  return n;
}

/** Rough intensity of a session, for the activity calendar. */
export function intensityFor(minutes: number, effort?: number): 'low' | 'moderate' | 'high' | 'very-high' {
  const score = minutes * (effort || 2);
  return score >= 120 ? 'very-high' : score >= 70 ? 'high' : score >= 30 ? 'moderate' : 'low';
}
