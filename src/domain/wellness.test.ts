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

import { summarize } from './budget';
import { yearlyCosts, yearlyMonthlyNeed } from './yearly';
import { resetWeek } from '../pages/Reset';

describe('yearly costs', () => {
  it('works out the monthly set-aside per cost', () => {
    const d = emptyData(TODAY);
    d.goals = [
      { id: 'y1', name: 'Car licence disc', kind: 'yearly', repeats: true, target: 600, openingBalance: 0, targetDate: '2027-05-31', monthlyContribution: 100, color: '', createdAt: TODAY, categoryId: 'sav-yearly' },
      { id: 'y2', name: 'Christmas', kind: 'yearly', repeats: true, target: 3000, openingBalance: 2000, targetDate: '2027-01-31', monthlyContribution: 500, color: '', createdAt: TODAY, categoryId: 'sav-yearly' },
    ];
    const ys = yearlyCosts(d, TODAY);
    expect(ys.map((y) => y.goal.id)).toEqual(['y2', 'y1']); // soonest first
    expect(ys[1].requiredMonthly).toBe(100); // 600 over 6 months (Dec–May)
    expect(ys[0].requiredMonthly).toBe(500); // 1000 left over 2 months
    expect(yearlyMonthlyNeed(d, TODAY)).toBe(600);
  });
  it('bills paid from the fund are spending, but not against category budgets, and leave money unchanged', () => {
    const d = emptyData(TODAY);
    d.budgets['2026-12'] = { period: '2026-12', income: [{ id: 'i', name: 'Salary', amount: 20000 }], allocations: { misc: 300 } };
    const tx = (p: any) => ({ id: Math.random().toString(), description: 'x', method: 'EFT', createdAt: '', ...p });
    d.transactions = [
      tx({ date: '2026-12-02', amount: 650, categoryId: 'misc', fundedBy: 'y1' }),
      tx({ date: '2026-12-02', amount: -650, categoryId: 'sav-yearly', goalId: 'y1' }),
    ];
    const s = summarize(d, '2026-12', TODAY);
    expect(s.spent).toBe(650);
    expect(s.paidFromFunds).toBe(650);
    expect(s.saved).toBe(-650);
    expect(s.remaining).toBe(20000);
    expect(s.rows.find((r) => r.category.id === 'misc')!.actual).toBe(0);
    expect(s.overspent).toEqual([]);
  });
});

describe('weekly reset', () => {
  it('plans next week from Friday, this week earlier in the week', () => {
    expect(resetWeek('2026-12-03')).toBe('2026-11-30'); // Thursday → this week
    expect(resetWeek('2026-12-04')).toBe('2026-12-07'); // Friday → next week
    expect(resetWeek('2026-12-06')).toBe('2026-12-07'); // Sunday → next week
    expect(resetWeek('2026-12-07')).toBe('2026-12-07'); // Monday → this week
  });
});

describe('safe to spend with yearly-cost withdrawals', () => {
  it('paying a bill from the pot does not change safe-to-spend', () => {
    const d = emptyData(TODAY);
    d.budgets['2026-12'] = { period: '2026-12', income: [{ id: 'i', name: 'Salary', amount: 20000 }], allocations: { 'sav-yearly': 1000 } };
    const tx = (p: any) => ({ id: Math.random().toString(), description: 'x', method: 'EFT', createdAt: '', ...p });
    d.transactions = [tx({ date: '2026-12-01', amount: 1000, categoryId: 'sav-yearly' })];
    const before = summarize(d, '2026-12', TODAY).safeToSpend;
    d.transactions.push(tx({ date: '2026-12-02', amount: 400, categoryId: 'misc', fundedBy: 'y' }), tx({ date: '2026-12-02', amount: -400, categoryId: 'sav-yearly', goalId: 'y' }));
    expect(summarize(d, '2026-12', TODAY).safeToSpend).toBe(before);
  });
});

import { challengeStreak, pickChallenge, describeChallenge } from './challenges';

describe('daily challenge', () => {
  it('puts food about to expire first, and swapping gives something else', () => {
    const d = emptyData(TODAY);
    d.pantry = [{ id: 'p', productId: 'spinach', quantity: 100, expiry: '2026-12-04', addedOn: TODAY }];
    const first = pickChallenge(d, TODAY, 0);
    expect(first.challenge.id).toBe('use-up');
    expect(first.text.title).toBe('Use up the baby spinach');
    expect(pickChallenge(d, TODAY, 1).challenge.id).not.toBe('use-up');
  });
  it('fills in the protein target and avoids repeating recent challenges', () => {
    const d = emptyData(TODAY);
    d.settings.proteinTarget = 110;
    expect(describeChallenge(d, TODAY, 'protein')!.title).toBe('Hit 110 g of protein');
    d.challenges['2026-12-02'] = { id: 'walk', swaps: 0, done: true };
    for (let i = 0; i < 25; i++) expect(pickChallenge(d, TODAY, i).challenge.id).not.toBe('walk');
  });
  it('counts a streak of done days', () => {
    const d = emptyData(TODAY);
    d.challenges = { '2026-12-01': { id: 'a', swaps: 0, done: true }, '2026-12-02': { id: 'b', swaps: 0, done: true }, [TODAY]: { id: 'c', swaps: 0, done: false } };
    expect(challengeStreak(d, TODAY)).toBe(2);
    d.challenges[TODAY].done = true;
    expect(challengeStreak(d, TODAY)).toBe(3);
  });
});

import { migrate } from '../data/migrations';

describe('ingredient list', () => {
  it('older saved data gets the extra ingredients once, without duplicates', () => {
    const d: any = emptyData(TODAY);
    d.version = 5;
    d.products = d.products.filter((p: any) => p.id !== 'boerewors' && p.id !== 'feta');
    const before = d.products.length;
    const m = migrate(d);
    expect(m.products.filter((p) => p.id === 'boerewors')).toHaveLength(1);
    expect(m.products.length).toBe(before + 2);
    expect(m.version).toBe(6);
  });
});
