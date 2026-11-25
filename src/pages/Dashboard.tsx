import { useMemo } from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Card, PageHeader, PeriodNav, Progress } from '../components/ui';
import { BillList, BudgetRowView } from '../components/BudgetBits';
import { getToday, useData } from '../data/store';
import { usePeriod } from '../lib/ui-state';
import { summarize } from '../domain/budget';
import { groceryOverview } from '../domain/grocery';
import { buildInsights } from '../domain/insights';
import { periodKeyFor } from '../domain/period';
import { money } from '../lib/format';

const TONE_ICON = { danger: AlertOctagon, warn: AlertTriangle, good: CheckCircle2, info: Info };

export function Dashboard() {
  const data = useData();
  const today = getToday();
  const [period, setPeriod] = usePeriod();
  const sd = data.settings.periodStartDay;
  const isCurrent = period === periodKeyFor(today, sd);
  const s = useMemo(() => summarize(data, period, today), [data, period, today]);
  const g = useMemo(() => groceryOverview(data, period, today), [data, period, today]);
  const insights = useMemo(() => buildInsights(data, s, g, today, isCurrent), [data, s, g, today, isCurrent]);
  const rows = s.rows.filter((r) => r.category.group === 'variable' && (r.planned > 0 || r.actual > 0)).sort((a, b) => b.ratio - a.ratio);
  const unpaid = s.bills.filter((b) => b.status !== 'paid');

  return (
    <>
      <PageHeader title="Money" sub={isCurrent ? `${s.daysLeft} day${s.daysLeft === 1 ? '' : 's'} to payday` : 'Another month'}>
        <PeriodNav value={period} onChange={setPeriod} startDay={sd} />
      </PageHeader>

      <div className="stack" style={{ gap: 16, maxWidth: 720 }}>
        <section className="card hero">
          <div className="label">{isCurrent ? 'Free to spend' : 'Left over'}</div>
          <div className="hero-amount num" data-testid="safe-to-spend">{money(isCurrent ? s.safeToSpend : s.remaining)}</div>
          <div className="hero-line">{isCurrent && s.daysLeft > 0 ? `About ${money(s.perDay, { cents: false })} a day · after bills and savings` : `${money(s.spent, { cents: false })} spent of ${money(s.income, { cents: false })}`}</div>
          <div className="mt-16"><Progress value={s.spent + s.saved} max={s.income || 1} size="thin" /></div>
          {s.incomePending > 0 && <div className="hero-line xs mt-8">Counts {money(s.incomePending, { cents: false })} income not in yet</div>}
        </section>

        {insights.length > 0 && (
          <Card title="Worth knowing">
            {insights.slice(0, 3).map((i) => {
              const Ic = TONE_ICON[i.tone];
              const fg = i.tone === 'info' ? 'var(--text-2)' : `var(--${i.tone})`;
              return (
                <div className="insight" key={i.id}>
                  <span className="ic" style={{ color: fg }}><Ic /></span>
                  <div className="grow">{i.text}{i.route && <> <a href={`#${i.route}`} style={{ fontWeight: 700 }}>View</a></>}</div>
                </div>
              );
            })}
          </Card>
        )}

        <Card title="Spending" action={<a href="#budget" className="link">Budget</a>}>
          {rows.length ? rows.map((r) => <BudgetRowView key={r.category.id} row={r} />) : <p className="muted small">Set amounts in <a href="#budget">Budget</a> to see what's left in each.</p>}
        </Card>

        <Card title="Bills coming up" action={unpaid.length ? <span className="count">{unpaid.length} to pay</span> : undefined}>
          <BillList bills={s.bills} limit={5} showPaid={false} />
        </Card>
      </div>
    </>
  );
}
