import type { AppData, ISODate, SavingsGoal } from './types';
import { goalProgress, type GoalProgress } from './savings';
import { daysBetween, round2 } from '../lib/format';

/** Common South African once-a-year costs, for quick adding. */
export const YEARLY_IDEAS: { name: string; emoji: string; amount: number; month: number }[] = [
  { name: 'Car licence disc', emoji: '🚗', amount: 650, month: -1 },
  { name: 'Car service', emoji: '🔧', amount: 3500, month: -1 },
  { name: 'Christmas & gifts', emoji: '🎁', amount: 3000, month: 11 },
  { name: 'Birthdays', emoji: '🎂', amount: 1500, month: -1 },
  { name: 'Insurance excess buffer', emoji: '🛡️', amount: 5000, month: -1 },
  { name: 'Dentist & optometrist', emoji: '🦷', amount: 1800, month: -1 },
  { name: 'TV licence', emoji: '📺', amount: 265, month: -1 },
  { name: 'Annual subscriptions', emoji: '🔁', amount: 1200, month: -1 },
  { name: 'December holiday', emoji: '🏖️', amount: 8000, month: 11 },
];

export const isYearly = (g: SavingsGoal) => g.kind === 'yearly';

export interface YearlyStatus extends GoalProgress {
  daysUntil: number;
  /** Due soon (within 60 days) but not fully saved. */
  atRisk: boolean;
}

export function yearlyCosts(data: AppData, today: ISODate): YearlyStatus[] {
  return data.goals
    .filter(isYearly)
    .map((g) => {
      const p = goalProgress(data, g, today);
      const daysUntil = daysBetween(today, g.targetDate);
      return { ...p, daysUntil, atRisk: p.remaining > 0 && daysUntil <= 60 };
    })
    .sort((a, b) => a.goal.targetDate.localeCompare(b.goal.targetDate));
}

/** What to set aside this month across all yearly costs so each is fully saved by its date. */
export function yearlyMonthlyNeed(data: AppData, today: ISODate): number {
  return round2(yearlyCosts(data, today).reduce((s, y) => s + y.requiredMonthly, 0));
}
