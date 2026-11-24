import type { AppData, ISODate, SavingsGoal } from './types';
import { round2, toDate, toISO } from '../lib/format';

export interface GoalProgress {
  goal: SavingsGoal;
  saved: number;
  remaining: number;
  pct: number;
  monthsLeft: number;
  /** What has to go in each month from now to hit the target on time. */
  requiredMonthly: number;
  /** When the goal completes at the planned monthly contribution. */
  projectedDate?: ISODate;
  status: 'done' | 'on-track' | 'behind' | 'overdue';
  thisMonth: number;
}

/** Whole months between today and the target date, counting the current month if the date isn't past. */
export function monthsUntil(today: ISODate, target: ISODate): number {
  const a = toDate(today);
  const b = toDate(target);
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() >= a.getDate()) m += 1;
  return Math.max(0, m);
}

export function goalProgress(data: AppData, goal: SavingsGoal, today: ISODate): GoalProgress {
  const contributions = data.transactions.filter((t) => t.goalId === goal.id);
  const saved = round2(goal.openingBalance + contributions.reduce((s, t) => s + t.amount, 0));
  const remaining = round2(Math.max(0, goal.target - saved));
  const monthsLeft = monthsUntil(today, goal.targetDate);
  const requiredMonthly = remaining <= 0 ? 0 : monthsLeft > 0 ? round2(remaining / monthsLeft) : remaining;
  let projectedDate: ISODate | undefined;
  if (remaining <= 0) projectedDate = today;
  else if (goal.monthlyContribution > 0) {
    const d = toDate(today);
    d.setMonth(d.getMonth() + Math.ceil(remaining / goal.monthlyContribution));
    projectedDate = toISO(d);
  }
  const status: GoalProgress['status'] =
    remaining <= 0 ? 'done' : today > goal.targetDate ? 'overdue' : goal.monthlyContribution + 0.004 >= requiredMonthly ? 'on-track' : 'behind';
  const ym = today.slice(0, 7);
  return {
    goal,
    saved,
    remaining,
    pct: goal.target > 0 ? Math.min(100, (saved / goal.target) * 100) : 0,
    monthsLeft,
    requiredMonthly,
    projectedDate,
    status,
    thisMonth: round2(contributions.filter((t) => t.date.startsWith(ym)).reduce((s, t) => s + t.amount, 0)),
  };
}
