import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, Plus, ShoppingBasket, PiggyBank } from 'lucide-react';
import { Card, ChartTip, PageHeader, PeriodNav, Progress, Ring } from '../components/ui';
import { BillList, BudgetRowView } from '../components/BudgetBits';
import { getToday, useData } from '../data/store';
import { usePeriod, useUI, go, type Route } from '../lib/ui-state';
import { dailySpend, summarize } from '../domain/budget';
import { groceryOverview } from '../domain/grocery';
import { buildInsights } from '../domain/insights';
import { periodKeyFor, periodStart } from '../domain/period';
import { goalProgress } from '../domain/savings';
import { fmtDate, money, moneyShort } from '../lib/format';
import { useCssVars } from '../lib/useChartColors';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

const TONE_ICON = { danger: AlertOctagon, warn: AlertTriangle, good: CheckCircle2, info: Info };

export function Dashboard() {
  const data = useData();
  const today = getToday();
  const [period, setPeriod] = usePeriod();
  const setAddOpen = useUI((s) => s.setAddOpen);
  const sd = data.settings.periodStartDay;
  const isCurrent = period === periodKeyFor(today, sd);
  const s = useMemo(() => summarize(data, period, today), [data, period, today]);
  const g = useMemo(() => groceryOverview(data, period, today), [data, period, today]);
  const insights = useMemo(() => buildInsights(data, s, g, today, isCurrent), [data, s, g, today, isCurrent]);
  const colors = useCssVars(['series-1', 'muted', 'border', 'text-2']);
  const series = useMemo(() => {
    const days = dailySpend(data, period, periodStart(period, sd), s.totalDays);
    const plan = s.planned.fixed + s.planned.variable;
    const lastDay = isCurrent ? s.totalDays - s.daysLeft + 1 : s.totalDays;
    return days.map((d) => ({ ...d, cumulative: d.day <= lastDay ? d.cumulative : null, pace: Math.round((plan * d.day) / s.totalDays) }));
  }, [data, period, sd, s, isCurrent]);

  const variableRows = s.rows.filter((r) => r.category.group === 'variable' && (r.planned > 0 || r.actual > 0)).sort((a, b) => b.ratio - a.ratio);
  const fixedRow = { planned: s.planned.fixed, actual: s.actual.fixed };
  const goals = data.goals.map((gl) => goalProgress(data, gl, today));
  const spentPct = s.income > 0 ? ((s.spent + s.saved) / s.income) * 100 : 0;

  return (
    <>
      <PageHeader title={`${greeting()}${data.settings.name ? `, ${data.settings.name}` : ''}`} sub={isCurrent ? `${fmtDate(today)} · ${s.daysLeft} day${s.daysLeft === 1 ? '' : 's'} left in this budget month` : 'Looking at another month'}>
        <PeriodNav value={period} onChange={setPeriod} startDay={sd} />
        <button className="btn primary hide-sm" onClick={() => setAddOpen(true)}><Plus /> Add expense</button>
      </PageHeader>

      <div className="grid g-main" style={{ alignItems: 'start' }}>
        <section className="card hero">
          <div className="label small">{isCurrent ? 'Safe to spend for the rest of the month' : 'Left over this month'}</div>
          <div className="hero-amount num" data-testid="safe-to-spend">{money(isCurrent ? s.safeToSpend : s.remaining)}</div>
          {isCurrent && s.daysLeft > 0 && (
            <div className="muted">≈ <b style={{ color: '#fff' }}>{money(s.perDay)}</b> a day for {s.daysLeft} days, after unpaid bills and planned savings</div>
          )}
          {s.incomePending > 0 && <div className="muted small mt-8">Includes {money(s.incomePending, { cents: false })} income you haven't marked as received yet.</div>}
          <div className="mt-16"><Progress value={s.spent + s.saved} max={s.income} size="thin" /></div>
          <div className="row between xs mt-8 muted"><span>{Math.round(spentPct)}% of income used</span><span>{money(s.income, { cents: false })} income</span></div>
          <div className="hero-meta">
            <div><div className="label xs">Remaining money</div><div className="v">{money(s.remaining)}</div></div>
            <div><div className="label xs">Bills still to pay</div><div className="v">{money(s.outstandingFixed)}</div></div>
            <div><div className="label xs">Savings to transfer</div><div className="v">{money(s.outstandingSavings)}</div></div>
          </div>
        </section>

        <Card title="Quick insights">
          {insights.length ? insights.slice(0, 5).map((i) => {
            const Ic = TONE_ICON[i.tone];
            const bg = i.tone === 'info' ? 'var(--surface-2)' : `var(--${i.tone}-soft)`;
            const fg = i.tone === 'info' ? 'var(--text-2)' : `var(--${i.tone})`;
            return (
              <div className="insight" key={i.id}>
                <span className="ic" style={{ background: bg, color: fg }}><Ic /></span>
                <div className="grow">
                  {i.text}
                  {i.route && <> <a href={`#${i.route}`} className="small" style={{ fontWeight: 600 }}>View</a></>}
                </div>
              </div>
            );
          }) : <p className="muted small">Nothing to flag — you're on track.</p>}
        </Card>
      </div>

      <div className="grid g-6 mt-16">
        {[
          { label: 'Income', v: s.income, hint: s.income === 0 ? 'Not set up yet' : s.incomePending > 0 ? `${money(s.incomeReceived, { cents: false })} in · ${money(s.incomePending, { cents: false })} to come` : 'All received', dot: 'var(--sage)' },
          { label: 'Fixed expenses', v: s.planned.fixed, hint: `${money(s.actual.fixed, { cents: false })} paid`, dot: 'var(--series-2)' },
          { label: 'Variable expenses', v: s.planned.variable, hint: `${money(s.actual.variable, { cents: false })} spent`, dot: 'var(--series-3)' },
          { label: 'Savings allocated', v: s.planned.savings, hint: `${money(s.saved, { cents: false })} saved`, dot: 'var(--series-6)' },
          { label: 'Total spent', v: s.spent, hint: 'Fixed + variable', dot: 'var(--series-4)' },
          { label: 'Remaining', v: s.remaining, hint: 'Income − spent − saved', dot: s.remaining < 0 ? 'var(--danger)' : 'var(--good)' },
        ].map((t) => (
          <div className="card stat" key={t.label}>
            <div className="label"><span className="stat-dot" style={{ background: t.dot }} />{t.label}</div>
            <div className={`value ${t.label === 'Remaining' && t.v < 0 ? 'danger' : ''}`}>{money(t.v, { cents: false })}</div>
            <div className="hint">{t.hint}</div>
          </div>
        ))}
      </div>

      <div className="grid g-main mt-16">
        <div className="stack">
          <Card title="Budget progress" action={<button className="link" onClick={() => go('budget')}>Edit budget</button>}>
            {variableRows.length === 0 && fixedRow.planned === 0 ? (
              <p className="muted small">Set amounts for your categories in <a href="#budget">Budget</a> to see progress here.</p>
            ) : (
              <>
                {variableRows.map((r) => <BudgetRowView key={r.category.id} row={r} />)}
                <BudgetRowView row={{ category: { id: 'fixed', name: 'All fixed expenses', group: 'fixed', color: 'var(--series-2)' }, planned: fixedRow.planned, actual: fixedRow.actual, remaining: fixedRow.planned - fixedRow.actual, ratio: 0, status: fixedRow.actual > fixedRow.planned + 0.01 ? 'over' : 'ok' }} />
              </>
            )}
          </Card>

          <Card title="Spending this month" action={<span className="legend"><span><i className="stat-dot" style={{ background: colors['series-1'] }} />Actual</span><span><i className="stat-dot" style={{ background: colors.muted }} />Even pace of budget</span></span>}>
            <div style={{ height: 220 }} role="img" aria-label="Cumulative spending compared with an even pace through the month">
              <ResponsiveContainer>
                <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colors['series-1']} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={colors['series-1']} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="0" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis tickFormatter={(v) => moneyShort(v)} tickLine={false} axisLine={false} width={56} />
                  <Tooltip content={<ChartTip labelFormat={(_: unknown, p: any[]) => fmtDate(p[0]?.payload.date)} />} />
                  <Area type="monotone" dataKey="cumulative" name="Spent so far" stroke={colors['series-1']} strokeWidth={2} fill="url(#spendFill)" connectNulls={false} activeDot={{ r: 5 }} />
                  <Line type="linear" dataKey="pace" name="Even pace" stroke={colors.muted} strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card title="Upcoming payments" action={<span className="chip">{s.bills.filter((b) => b.status !== 'paid').length} unpaid</span>}>
            <BillList bills={s.bills} limit={7} showPaid={false} />
            {s.bills.some((b) => b.status === 'paid') && <p className="muted xs mt-8">{s.bills.filter((b) => b.status === 'paid').length} already paid this month · <a href="#budget">see all</a></p>}
          </Card>

          <Card title="Groceries" icon={<ShoppingBasket size={17} />} action={<button className="link" onClick={() => go('groceries' as Route)}>Open</button>}>
            {g.budget > 0 ? (
              <>
                <div className="row between"><span className="display" style={{ fontSize: 26 }}>{money(g.remaining, { cents: false })}</span><span className="muted small">left of {money(g.budget, { cents: false })}</span></div>
                <div className="mt-8"><Progress value={g.spent} max={g.budget} status={g.spent > g.budget ? 'over' : g.pace === 'over' ? 'near' : 'ok'} /></div>
                <div className="row between small mt-12"><span className="muted">This week</span><span><b>{money(g.thisWeekSpent, { cents: false })}</b> / {money(g.thisWeekAllowance, { cents: false })}</span></div>
                <div className="row between small mt-8"><span className="muted">Weekly allowance from here</span><b>{money(g.weeklyNow, { cents: false })}</b></div>
              </>
            ) : <p className="muted small">Set a grocery budget to get weekly and daily allowances.</p>}
          </Card>

          <Card title="Savings goals" icon={<PiggyBank size={17} />} action={<button className="link" onClick={() => go('savings')}>All goals</button>}>
            {goals.length ? goals.slice(0, 3).map((p) => (
              <div className="list-item" key={p.goal.id}>
                <Ring pct={p.pct} size={46} stroke={5} color={p.goal.color}><span style={{ fontSize: 11 }}>{Math.round(p.pct)}%</span></Ring>
                <div className="grow">
                  <div className="title">{p.goal.name}</div>
                  <div className="meta">{money(p.saved, { cents: false })} of {money(p.goal.target, { cents: false })}</div>
                </div>
                <span className={`chip ${p.status === 'behind' || p.status === 'overdue' ? 'warn' : 'good'}`}>{p.status === 'done' ? 'Done' : p.status === 'on-track' ? 'On track' : p.status === 'overdue' ? 'Past date' : 'Behind'}</span>
              </div>
            )) : <p className="muted small">No goals yet. <a href="#savings">Create one</a>.</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
