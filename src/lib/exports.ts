import type { AppData, PeriodKey, Transaction } from '../domain/types';
import { summarize } from '../domain/budget';
import { periodLabel } from '../domain/period';
import { fmtDate } from './format';
import { download, toCSV } from './csv';

export function exportTransactions(data: AppData, txs: Transaction[], name = 'transactions') {
  const cat = new Map(data.categories.map((c) => [c.id, c]));
  const store = new Map(data.stores.map((s) => [s.id, s.name]));
  const goal = new Map(data.goals.map((g) => [g.id, g.name]));
  const rows = [
    ['Date', 'Description', 'Amount (ZAR)', 'Category', 'Type', 'Payment method', 'Store', 'Savings goal', 'Notes'],
    ...txs
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((t) => [fmtDate(t.date), t.description, t.amount.toFixed(2), cat.get(t.categoryId)?.name || 'Deleted category', cat.get(t.categoryId)?.group || '', t.method, t.storeId ? store.get(t.storeId) : '', t.goalId ? goal.get(t.goalId) : '', t.notes]),
  ];
  download(`theedit-${name}.csv`, toCSV(rows));
}

export function exportBudget(data: AppData, key: PeriodKey, today: string) {
  const s = summarize(data, key, today);
  const rows: (string | number)[][] = [
    [`Budget — ${periodLabel(key)}`],
    [],
    ['Income', 'Amount (ZAR)'],
    ...(data.budgets[key]?.income || []).map((i) => [i.name, i.amount.toFixed(2)]),
    ['Total income', s.income.toFixed(2)],
    [],
    ['Category', 'Type', 'Planned (ZAR)', 'Actual (ZAR)', 'Remaining (ZAR)', 'Status'],
    ...s.rows.map((r) => [r.category.name, r.category.group, r.planned.toFixed(2), r.actual.toFixed(2), r.remaining.toFixed(2), r.status]),
    [],
    ['Total allocated', '', s.plannedTotal.toFixed(2)],
    ['Unallocated', '', s.unallocated.toFixed(2)],
    ['Total spent', '', '', s.spent.toFixed(2)],
    ['Total saved', '', '', s.saved.toFixed(2)],
  ];
  download(`theedit-budget-${key}.csv`, toCSV(rows));
}

export function exportBackup(data: AppData) {
  download(`theedit-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json');
}
