import type { AppData, Budget, Category, CategoryGroup, ID, IncomeLine, ISODate, PeriodKey, Transaction } from './types';
import { daysLeft, dueDateInPeriod, inPeriod, periodDays } from './period';
import { daysBetween, round2 } from '../lib/format';

export const NEAR_LIMIT = 0.85;

/**
 * The budget for a period. A month that hasn't been set up yet inherits the most
 * recent earlier month (income + allocations) so you never start from zero.
 */
export function resolveBudget(data: AppData, key: PeriodKey): Budget & { inherited: boolean } {
  const own = data.budgets[key];
  if (own) return { ...own, inherited: false };
  const earlier = Object.keys(data.budgets).filter((k) => k < key).sort();
  const later = Object.keys(data.budgets).filter((k) => k > key).sort();
  const src = earlier.length ? data.budgets[earlier[earlier.length - 1]] : later.length ? data.budgets[later[0]] : undefined;
  return {
    period: key,
    // A new month starts with the same expected income, not yet received.
    income: src ? src.income.map(({ received: _r, receivedOn: _o, ...i }) => ({ ...i })) : [],
    allocations: src ? { ...src.allocations } : {},
    inherited: true,
  };
}

export function transactionsIn(data: AppData, key: PeriodKey): Transaction[] {
  const sd = data.settings.periodStartDay;
  return data.transactions.filter((t) => inPeriod(t.date, key, sd));
}

export function sumBy(txs: Transaction[]): Record<ID, number> {
  const out: Record<ID, number> = {};
  for (const t of txs) out[t.categoryId] = round2((out[t.categoryId] || 0) + t.amount);
  return out;
}

export type BudgetStatus = 'ok' | 'near' | 'over' | 'idle';

export interface CategoryRow {
  category: Category;
  planned: number;
  actual: number;
  remaining: number;
  ratio: number; // actual / planned
  status: BudgetStatus;
}

export function statusFor(planned: number, actual: number): BudgetStatus {
  if (planned <= 0) return actual > 0 ? 'over' : 'idle';
  if (actual > planned + 0.004) return 'over';
  if (actual >= planned * NEAR_LIMIT) return 'near';
  return 'ok';
}

export type BillStatus = 'paid' | 'overdue' | 'due-soon' | 'upcoming';

export interface Bill {
  category: Category;
  dueDate: ISODate;
  amount: number; // planned
  paid: number;
  outstanding: number;
  status: BillStatus;
  daysUntil: number;
}

export interface IncomeStatus {
  line: IncomeLine;
  payDate?: ISODate;
  received: boolean;
  /** Actual if received, otherwise expected. */
  value: number;
  /** received − expected (only once received). */
  difference: number;
  late: boolean;
}

export interface PeriodSummary {
  key: PeriodKey;
  /** Income used for every calculation: actual where received, expected otherwise. */
  income: number;
  incomeExpected: number;
  incomeReceived: number;
  /** Expected income that hasn't been marked received yet. */
  incomePending: number;
  incomeLines: IncomeStatus[];
  planned: Record<CategoryGroup, number>;
  plannedTotal: number;
  unallocated: number;
  overAllocated: boolean;
  allocatedPct: number;
  /** Income left after fixed costs and savings — what's available for day-to-day spending. */
  discretionary: number;
  actual: Record<CategoryGroup, number>;
  /** Fixed + variable spending (savings transfers excluded). */
  spent: number;
  saved: number;
  /** Income − spending − savings transfers made so far. */
  remaining: number;
  outstandingFixed: number;
  outstandingSavings: number;
  /** What can be spent for the rest of the period after unpaid bills and planned savings. */
  safeToSpend: number;
  perDay: number;
  daysLeft: number;
  totalDays: number;
  rows: CategoryRow[];
  bills: Bill[];
  overspent: CategoryRow[];
  nearLimit: CategoryRow[];
  inherited: boolean;
}

export function summarize(data: AppData, key: PeriodKey, today: ISODate): PeriodSummary {
  const sd = data.settings.periodStartDay;
  const budget = resolveBudget(data, key);
  const txs = transactionsIn(data, key);
  const spentMap = sumBy(txs);
  const incomeLines: IncomeStatus[] = budget.income.map((line) => {
    const received = line.received !== undefined && line.received !== null;
    const payDate = line.payDay ? dueDateInPeriod(key, sd, line.payDay) : undefined;
    return {
      line,
      payDate,
      received,
      value: received ? line.received! : line.amount || 0,
      difference: received ? round2(line.received! - (line.amount || 0)) : 0,
      late: !received && !!payDate && payDate < today,
    };
  });
  const income = round2(incomeLines.reduce((s, i) => s + i.value, 0));
  const incomeExpected = round2(budget.income.reduce((s, i) => s + (i.amount || 0), 0));
  const incomeReceived = round2(incomeLines.filter((i) => i.received).reduce((s, i) => s + i.value, 0));

  const planned: Record<CategoryGroup, number> = { fixed: 0, variable: 0, savings: 0 };
  const actual: Record<CategoryGroup, number> = { fixed: 0, variable: 0, savings: 0 };
  const rows: CategoryRow[] = [];
  const catById = new Map(data.categories.map((c) => [c.id, c]));

  for (const c of data.categories) {
    const p = budget.allocations[c.id] || 0;
    const a = spentMap[c.id] || 0;
    if (c.archived && !p && !a) continue;
    planned[c.group] += p;
    actual[c.group] += a;
    let status = statusFor(p, a);
    // Paying a bill or making a savings transfer in full is "done", not "near the limit".
    if (status === 'near' && c.group !== 'variable') status = 'ok';
    rows.push({ category: c, planned: p, actual: a, remaining: round2(p - a), ratio: p > 0 ? a / p : a > 0 ? Infinity : 0, status });
  }
  // Transactions whose category was deleted still count as spending.
  for (const [cid, a] of Object.entries(spentMap)) if (!catById.has(cid)) actual.variable += a;

  (Object.keys(planned) as CategoryGroup[]).forEach((g) => {
    planned[g] = round2(planned[g]);
    actual[g] = round2(actual[g]);
  });
  const plannedTotal = round2(planned.fixed + planned.variable + planned.savings);
  const spent = round2(actual.fixed + actual.variable);
  const saved = actual.savings;
  // A bill with a due day counts as paid once a payment is recorded (amounts like electricity vary);
  // other categories still owe whatever is left of their plan.
  const owed = (r: CategoryRow) => (r.category.group === 'fixed' && r.category.dueDay ? (r.actual > 0 ? 0 : r.planned) : Math.max(0, r.planned - r.actual));
  const outstanding = (g: CategoryGroup) => round2(rows.filter((r) => r.category.group === g).reduce((s, r) => s + owed(r), 0));
  const outstandingFixed = outstanding('fixed');
  const outstandingSavings = outstanding('savings');
  const remaining = round2(income - spent - saved);
  const safeToSpend = round2(Math.max(0, remaining - outstandingFixed - outstandingSavings));
  const dl = daysLeft(key, sd, today);

  const bills: Bill[] = rows
    .filter((r) => r.category.group === 'fixed' && r.category.dueDay && r.planned > 0)
    .map((r) => {
      const dueDate = dueDateInPeriod(key, sd, r.category.dueDay!);
      const isPaid = r.actual > 0;
      const until = daysBetween(today, dueDate);
      const status: BillStatus = isPaid ? 'paid' : until < 0 ? 'overdue' : until <= 7 ? 'due-soon' : 'upcoming';
      return { category: r.category, dueDate, amount: r.planned, paid: r.actual, outstanding: isPaid ? 0 : r.planned, status, daysUntil: until };
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const spendRows = rows.filter((r) => r.category.group !== 'savings');
  return {
    key,
    income,
    incomeExpected,
    incomeReceived,
    incomePending: round2(income - incomeReceived),
    incomeLines,
    planned,
    plannedTotal,
    unallocated: round2(incomeExpected - plannedTotal),
    overAllocated: plannedTotal > incomeExpected + 0.004,
    allocatedPct: incomeExpected > 0 ? (plannedTotal / incomeExpected) * 100 : 0,
    discretionary: round2(incomeExpected - planned.fixed - planned.savings),
    actual,
    spent,
    saved,
    remaining,
    outstandingFixed,
    outstandingSavings,
    safeToSpend,
    perDay: dl > 0 ? round2(safeToSpend / dl) : 0,
    daysLeft: dl,
    totalDays: periodDays(key, sd),
    rows,
    bills,
    overspent: spendRows.filter((r) => r.status === 'over').sort((a, b) => (a.remaining - b.remaining)),
    nearLimit: rows.filter((r) => r.category.group === 'variable' && r.status === 'near'),
    inherited: budget.inherited,
  };
}

export function groceryCategory(data: AppData): Category | undefined {
  return data.categories.find((c) => c.role === 'groceries') || data.categories.find((c) => /grocer/i.test(c.name));
}

/** Daily cumulative spend for a sparkline / burn-down. */
export function dailySpend(data: AppData, key: PeriodKey, start: ISODate, days: number, groups: CategoryGroup[] = ['fixed', 'variable']) {
  const groupOf = new Map(data.categories.map((c) => [c.id, c.group]));
  const byDay = new Map<ISODate, number>();
  for (const t of transactionsIn(data, key)) {
    const g = groupOf.get(t.categoryId) || 'variable';
    if (!groups.includes(g)) continue;
    byDay.set(t.date, (byDay.get(t.date) || 0) + t.amount);
  }
  const out: { date: ISODate; day: number; amount: number; cumulative: number }[] = [];
  let cum = 0;
  const d0 = new Date(start + 'T00:00:00');
  for (let i = 0; i < days; i++) {
    const d = new Date(d0);
    d.setDate(d.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const amt = byDay.get(iso) || 0;
    cum += amt;
    out.push({ date: iso, day: i + 1, amount: round2(amt), cumulative: round2(cum) });
  }
  return out;
}

/** Average commission actually received over the last `n` months before `key` (for a realistic estimate). */
export function commissionHistory(data: AppData, key: PeriodKey, n = 3): { average: number; months: number; last?: number } {
  const keys = Object.keys(data.budgets).filter((k) => k < key).sort().slice(-n);
  const vals = keys
    .map((k) => data.budgets[k].income.filter((l) => l.kind === 'commission' && l.received !== undefined).reduce((s, l) => s + (l.received || 0), 0))
    .filter((_, i) => data.budgets[keys[i]].income.some((l) => l.kind === 'commission' && l.received !== undefined));
  if (!vals.length) return { average: 0, months: 0 };
  return { average: round2(vals.reduce((a, b) => a + b, 0) / vals.length), months: vals.length, last: vals[vals.length - 1] };
}

export function incomeKindOf(line: IncomeLine) {
  return line.kind || 'other';
}
