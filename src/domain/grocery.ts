import type { AppData, ISODate, PeriodKey } from './types';
import { groceryCategory, resolveBudget, transactionsIn } from './budget';
import { daysLeft, periodDays, periodEnd, periodStart } from './period';
import { addDays, daysBetween, mondayOf, round2 } from '../lib/format';

export interface GroceryOverview {
  budget: number;
  spent: number;
  remaining: number;
  /** Even split: monthly budget × 7 ÷ days in the period (≈ budget ÷ 4.3). */
  weekly: number;
  daily: number;
  /** Re-balanced allowance: what's left spread over the weeks that are left. */
  weeklyNow: number;
  dailyNow: number;
  daysLeft: number;
  totalDays: number;
  /** Where spending "should" be today if spread evenly. */
  expectedByNow: number;
  pace: 'under' | 'on' | 'over';
  thisWeekSpent: number;
  thisWeekAllowance: number;
  weeks: { start: ISODate; end: ISODate; spent: number; allowance: number }[];
  categoryId?: string;
}

export function groceryOverview(data: AppData, key: PeriodKey, today: ISODate): GroceryOverview {
  const sd = data.settings.periodStartDay;
  const cat = groceryCategory(data);
  const budget = cat ? resolveBudget(data, key).allocations[cat.id] || 0 : 0;
  const txs = cat ? transactionsIn(data, key).filter((t) => t.categoryId === cat.id) : [];
  const spent = round2(txs.reduce((s, t) => s + t.amount, 0));
  const remaining = round2(budget - spent);
  const total = periodDays(key, sd);
  const left = daysLeft(key, sd, today);
  const start = periodStart(key, sd);
  const end = periodEnd(key, sd);
  const elapsed = Math.min(total, Math.max(0, total - left + (left > 0 ? 1 : 0)));
  const expectedByNow = round2((budget * elapsed) / total);
  const weeksLeft = left / 7;
  const weeklyNow = left > 0 ? round2(Math.max(0, remaining) / Math.max(1, weeksLeft)) : 0;
  const pace = spent > expectedByNow * 1.05 ? 'over' : spent < expectedByNow * 0.9 ? 'under' : 'on';

  // Week buckets (Monday–Sunday), clipped to the period.
  const weeks: GroceryOverview['weeks'] = [];
  let ws = mondayOf(start);
  while (ws <= end) {
    const we = addDays(ws, 6);
    const s = ws < start ? start : ws;
    const e = we > end ? end : we;
    const days = daysBetween(s, e) + 1;
    weeks.push({
      start: s,
      end: e,
      spent: round2(txs.filter((t) => t.date >= s && t.date <= e).reduce((a, t) => a + t.amount, 0)),
      allowance: round2((budget * days) / total),
    });
    ws = addDays(ws, 7);
  }
  const current = weeks.find((w) => today >= w.start && today <= w.end);
  return {
    budget,
    spent,
    remaining,
    weekly: round2((budget * 7) / total),
    daily: round2(budget / total),
    weeklyNow,
    dailyNow: left > 0 ? round2(Math.max(0, remaining) / left) : 0,
    daysLeft: left,
    totalDays: total,
    expectedByNow,
    pace,
    thisWeekSpent: current?.spent || 0,
    thisWeekAllowance: current ? Math.min(current.allowance, Math.max(0, remaining + current.spent)) : 0,
    weeks,
    categoryId: cat?.id,
  };
}
