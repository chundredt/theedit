import type { AppData, ISODate } from './types';
import type { PeriodSummary } from './budget';
import type { GroceryOverview } from './grocery';
import { money } from '../lib/format';
import { daysBetween, fmtDate } from '../lib/format';

export type InsightTone = 'good' | 'warn' | 'danger' | 'info';
export interface Insight {
  id: string;
  tone: InsightTone;
  text: string;
  route?: string;
}

/** Plain-language observations, most urgent first. */
export function buildInsights(data: AppData, s: PeriodSummary, g: GroceryOverview, today: ISODate, isCurrent: boolean): Insight[] {
  const out: Insight[] = [];
  if (s.income === 0) {
    out.push({ id: 'no-income', tone: 'info', text: 'Add your monthly income to see what you can safely spend.', route: 'budget' });
    return out;
  }
  if (isCurrent) {
    for (const i of s.incomeLines.filter((x) => x.late))
      out.push({ id: `late-${i.line.id}`, tone: 'warn', text: `${i.line.name} (${money(i.line.amount, { cents: false })}) was due on ${fmtDate(i.payDate)}. Mark it as received once it's in, with the actual amount.`, route: 'budget' });
  }
  for (const i of s.incomeLines.filter((x) => x.received && x.difference <= -1))
    out.push({ id: `short-${i.line.id}`, tone: 'warn', text: `${i.line.name} came in ${money(-i.difference, { cents: false })} lower than planned. Safe-to-spend is adjusted — trim a flexible category to match.`, route: 'budget' });
  for (const i of s.incomeLines.filter((x) => x.received && x.difference >= 1))
    out.push({ id: `extra-${i.line.id}`, tone: 'good', text: `${i.line.name} was ${money(i.difference, { cents: false })} more than planned. Consider sending the extra to savings.`, route: 'savings' });
  if (isCurrent && s.daysLeft > 0 && s.daysLeft <= 5 && data.settings.periodStartDay > 1)
    out.push({ id: 'payday', tone: 'info', text: `Payday is ${s.daysLeft === 1 ? 'tomorrow' : `in ${s.daysLeft} days`} — set up next month's budget.`, route: 'budget' });
  if (s.overAllocated) out.push({ id: 'over-alloc', tone: 'danger', text: `You've planned ${money(-s.unallocated)} more than you earn this month. Trim a category or add income.`, route: 'budget' });
  const overdue = s.bills.filter((b) => b.status === 'overdue');
  if (isCurrent && overdue.length)
    out.push({ id: 'overdue', tone: 'danger', text: `${overdue.map((b) => b.category.name).join(', ')} ${overdue.length > 1 ? 'are' : 'is'} past the due date and not marked paid.` });
  for (const r of s.overspent.slice(0, 3))
    out.push({ id: `over-${r.category.id}`, tone: 'danger', text: r.planned > 0 ? `${r.category.name} is ${money(-r.remaining)} over budget.` : `${money(r.actual)} spent on ${r.category.name}, which has no budget.`, route: 'transactions' });
  if (isCurrent)
    for (const r of s.nearLimit.slice(0, 2))
      out.push({ id: `near-${r.category.id}`, tone: 'warn', text: `${r.category.name} is at ${Math.round(r.ratio * 100)}% with ${s.daysLeft} day${s.daysLeft === 1 ? '' : 's'} to go — ${money(r.remaining)} left.` });

  if (isCurrent && s.daysLeft > 0) {
    const elapsed = (s.totalDays - s.daysLeft + 1) / s.totalDays;
    const expected = s.planned.variable * elapsed;
    if (s.planned.variable > 0 && s.actual.variable > expected * 1.1)
      out.push({ id: 'pace', tone: 'warn', text: `Day-to-day spending is ${Math.round((s.actual.variable / expected - 1) * 100)}% ahead of pace for this point in the month.` });
    else if (s.planned.variable > 0 && s.actual.variable < expected * 0.9)
      out.push({ id: 'pace', tone: 'good', text: `Day-to-day spending is ${money(expected - s.actual.variable, { cents: false })} below pace — nicely done.` });
    if (g.budget > 0 && g.pace === 'over')
      out.push({ id: 'grocery', tone: 'warn', text: `Groceries are running ahead: ${money(g.spent, { cents: false })} spent vs ${money(g.expectedByNow, { cents: false })} expected by today. Aim for ${money(g.weeklyNow, { cents: false })} a week from here.`, route: 'groceries' });
  }

  if (s.planned.savings > 0) {
    const pct = Math.round((s.saved / s.planned.savings) * 100);
    out.push({ id: 'saved', tone: pct >= 100 ? 'good' : 'info', text: pct >= 100 ? `You've saved ${money(s.saved, { cents: false })} this month — your full savings plan.` : `${money(s.saved, { cents: false })} saved so far (${pct}% of the ${money(s.planned.savings, { cents: false })} planned).`, route: 'savings' });
  }
  if (!s.overAllocated && s.unallocated >= 50)
    out.push({ id: 'unalloc', tone: 'info', text: `${money(s.unallocated, { cents: false })} of income isn't allocated yet. Give it a job — savings is a good home.`, route: 'budget' });

  if (isCurrent) {
    const expiring = data.pantry.filter((p) => p.expiry && p.expiry >= today && daysBetween(today, p.expiry) <= 3);
    if (expiring.length) {
      const names = expiring.map((e) => data.products.find((p) => p.id === e.productId)?.name).filter(Boolean);
      out.push({ id: 'pantry', tone: 'warn', text: `Use soon: ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` and ${names.length - 3} more` : ''} expire${names.length === 1 ? 's' : ''} within 3 days.`, route: 'pantry' });
    }
  }
  const rank = { danger: 0, warn: 1, info: 2, good: 3 };
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]);
}
