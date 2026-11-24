import type { AppData, ISODate, PeriodKey } from './types';
import { summarize, transactionsIn, type CategoryRow, type PeriodSummary } from './budget';
import { groceryOverview } from './grocery';
import { shiftPeriod } from './period';

export interface MonthReport {
  summary: PeriodSummary;
  grocerySpent: number;
  groceryBudget: number;
  underBudget: CategoryRow[];
  overBudget: CategoryRow[];
  savingsRate: number;
  txCount: number;
}

export function monthReport(data: AppData, key: PeriodKey, today: ISODate): MonthReport {
  const summary = summarize(data, key, today);
  const g = groceryOverview(data, key, today);
  const spendRows = summary.rows.filter((r) => r.category.group !== 'savings');
  return {
    summary,
    grocerySpent: g.spent,
    groceryBudget: g.budget,
    underBudget: spendRows.filter((r) => r.planned > 0 && r.actual < r.planned - 0.004).sort((a, b) => b.remaining - a.remaining),
    overBudget: spendRows.filter((r) => r.actual > r.planned + 0.004).sort((a, b) => a.remaining - b.remaining),
    savingsRate: summary.income > 0 ? (summary.saved / summary.income) * 100 : 0,
    txCount: transactionsIn(data, key).length,
  };
}

/** Last n periods ending at `key`, oldest first. */
export function trend(data: AppData, key: PeriodKey, n: number, today: ISODate) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const k = shiftPeriod(key, -i);
    const s = summarize(data, k, today);
    out.push({ key: k, income: s.income, spent: s.spent, saved: s.saved, planned: s.plannedTotal - s.planned.savings });
  }
  return out;
}

/** Periods that have a budget or any transactions. */
export function knownPeriods(data: AppData, periodKeyFor: (d: ISODate) => PeriodKey): PeriodKey[] {
  const set = new Set<PeriodKey>(Object.keys(data.budgets));
  for (const t of data.transactions) set.add(periodKeyFor(t.date));
  return [...set].sort().reverse();
}
