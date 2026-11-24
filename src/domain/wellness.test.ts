import { describe, expect, it } from 'vitest';
import { emptyData } from '../data/seed';
import { bestStreak, completionRate, dayScore, isDue, streak } from './habits';
import { plannedFor, weekStreak, weekSummary } from './workouts';
import type { Habit } from './types';

const TODAY = '2026-12-03'; // Thursday
const habit = (p: Partial<Habit> = {}): Habit => ({ id: 'h', name: 'Water', emoji: '💧', color: 'sky', days: [], target: 1, createdAt: '2026-11-20', ...p });

describe('habits', () => {
  it('respects scheduled weekdays', () => {
    const h = habit({ days: [0, 2] }); // Mon, Wed
    expect(isDue(h, '2026-11-30')).toBe(true);
    expect(isDue(h, '2026-12-01')).toBe(false);
    expect(isDue(h, '2026-11-19')).toBe(false); // before it was created
  });
  it('counts streaks, skipping unscheduled days and not breaking on an unfinished today', () => {
    const d = emptyData(TODAY);
    const h = habit({ days: [0, 2, 3] }); // Mon, Wed, Thu
    d.habits = [h];
    d.habitLogs = { '2026-11-25': { h: 1 }, '2026-11-26': { h: 1 }, '2026-11-30': { h: 1 }, '2026-12-02': { h: 1 } };
    expect(streak(d, h, TODAY)).toBe(4); // Wed 25, Thu 26, Mon 30, Wed 2 — today not done yet
    d.habitLogs[TODAY] = { h: 1 };
    expect(streak(d, h, TODAY)).toBe(5);
    expect(bestStreak(d, h, TODAY)).toBe(5);
  });
  it('counter habits are done only at the target', () => {
    const d = emptyData(TODAY);
    const h = habit({ target: 8 });
    d.habits = [h];
    d.habitLogs = { [TODAY]: { h: 5 } };
    expect(dayScore(d, TODAY)).toBe(0);
    d.habitLogs[TODAY].h = 8;
    expect(dayScore(d, TODAY)).toBe(1);
  });
  it('completion rate ignores today until it is done', () => {
    const d = emptyData(TODAY);
    const h = habit({ createdAt: '2026-12-01' });
    d.habits = [h];
    d.habitLogs = { '2026-12-01': { h: 1 } };
    expect(completionRate(d, h, TODAY, 30)).toBe(0.5); // 1 Dec done, 2 Dec missed, 3 Dec still open
  });
});

describe('workouts', () => {
  it('plans by weekday and summarises the week', () => {
    const d = emptyData(TODAY);
    expect(plannedFor(d, TODAY)?.id).toBe('r-walk'); // default plan: Thursday walk
    expect(plannedFor(d, '2026-12-06')).toBeUndefined(); // Sunday rest
    d.workoutLogs = [
      { id: '1', date: '2026-11-30', name: 'A', kind: 'strength', minutes: 45, done: [] },
      { id: '2', date: '2026-12-02', name: 'B', kind: 'strength', minutes: 40, done: [] },
      { id: '3', date: '2026-11-24', name: 'A', kind: 'strength', minutes: 45, done: [] },
      { id: '4', date: '2026-11-26', name: 'W', kind: 'cardio', minutes: 30, done: [] },
    ];
    expect(weekSummary(d, TODAY)).toEqual({ sessions: 2, minutes: 85, planned: 6 });
    expect(weekStreak(d, TODAY)).toBe(2);
  });
});
