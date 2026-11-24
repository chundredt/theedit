import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import { CalendarDays, ListChecks, Plus, Tags, ShoppingBasket } from 'lucide-react';
import { Banner, Card, ChartTip, Empty, MoneyInput, PageHeader, PeriodNav, Progress } from '../components/ui';
import { TransactionForm } from '../components/TransactionForm';
import { getToday, useData, useStore } from '../data/store';
import { usePeriod, useUI } from '../lib/ui-state';
import { groceryOverview } from '../domain/grocery';
import { transactionsIn } from '../domain/budget';
import { periodKeyFor } from '../domain/period';
import { buildShoppingList } from '../domain/shopping';
import { activeSpecials } from '../domain/prices';
import { fmtDate, fmtDay, money, moneyShort } from '../lib/format';
import { useCssVars } from '../lib/useChartColors';
import type { Transaction } from '../domain/types';

export function GroceriesPage() {
  const data = useData();
  const today = getToday();
  const [period, setPeriod] = usePeriod();
  const week = useUI((s) => s.week);
  const setAllocation = useStore((s) => s.setAllocation);
  const g = useMemo(() => groceryOverview(data, period, today), [data, period, today]);
  const isCurrent = period === periodKeyFor(today, data.settings.periodStartDay);
  const [adding, setAdding] = useState<Transaction | 'new' | null>(null);
  const colors = useCssVars(['series-1', 'danger', 'muted', 'warn']);
  const txs = transactionsIn(data, period).filter((t) => t.categoryId === g.categoryId).sort((a, b) => b.date.localeCompare(a.date));
  const byStore = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of txs) m.set(t.storeId || 'other', (m.get(t.storeId || 'other') || 0) + t.amount);
    return [...m.entries()].map(([id, v]) => ({ store: data.stores.find((s) => s.id === id), id, v })).sort((a, b) => b.v - a.v);
  }, [txs, data.stores]);
  const list = useMemo(() => buildShoppingList(data, data.mealPlans[week], today, data.shopping[week]?.storeOverride), [data, week, today]);
  const specials = activeSpecials(data, today).length;

  const weekData = g.weeks.map((w) => ({ name: `${fmtDate(w.start).slice(0, 5)}`, label: `${fmtDay(w.start)} – ${fmtDay(w.end)}`, Spent: w.spent, allowance: w.allowance, over: w.spent > w.allowance }));

  return (
    <>
      <PageHeader title="Grocery budget" sub="Know what you can spend this week, not just this month.">
        <PeriodNav value={period} onChange={setPeriod} startDay={data.settings.periodStartDay} />
        <button className="btn primary" onClick={() => setAdding('new')}><Plus /> Add purchase</button>
      </PageHeader>

      {!g.categoryId ? <Banner tone="warn">No groceries category found. Add one in Budget.</Banner> : (
        <>
          <div className="grid g-main">
            <section className="card hero">
              <div className="label small">Grocery money left this month</div>
              <div className="hero-amount num" data-testid="grocery-remaining">{money(g.remaining)}</div>
              <div className="muted">{g.remaining < 0 ? 'Over budget — consider pantry meals for the rest of the month.' : isCurrent ? <>About <b style={{ color: '#fff' }}>{money(g.weeklyNow)}</b> a week ({money(g.dailyNow)} a day) for the {g.daysLeft} days left</> : ''}</div>
              <div className="mt-16"><Progress value={g.spent} max={g.budget} size="thin" /></div>
              <div className="hero-meta">
                <div><div className="label xs">Monthly budget</div>
                  <div style={{ maxWidth: 160, marginTop: 4 }}><MoneyInput value={g.budget} ariaLabel="Monthly grocery budget" onCommit={(v) => v !== g.budget && setAllocation(period, g.categoryId!, v)} /></div>
                </div>
                <div><div className="label xs">Spent</div><div className="v">{money(g.spent)}</div></div>
                <div><div className="label xs">Weekly allocation</div><div className="v" data-testid="grocery-weekly">{money(g.weekly)}</div></div>
                <div><div className="label xs">Daily allowance</div><div className="v">{money(g.daily)}</div></div>
              </div>
            </section>
            <Card title="How the allowance works">
              <div className="small text-2 stack" style={{ gap: 10 }}>
                <p><b>Weekly allocation</b> spreads the month evenly: {money(g.budget, { cents: false })} × 7 ÷ {g.totalDays} days = <b>{money(g.weekly)}</b> (a month is ~{(g.totalDays / 7).toFixed(1)} weeks, so it's a bit less than ÷ 4).</p>
                <p><b>From here</b> re-balances what's left over the remaining days, so an expensive week is absorbed by the rest of the month.</p>
                {isCurrent && g.budget > 0 && (
                  <Banner tone={g.pace === 'over' ? 'warn' : 'good'}>
                    {g.pace === 'over' ? <>You've spent <b>{money(g.spent - g.expectedByNow, { cents: false })}</b> more than an even pace by today.</> : g.pace === 'under' ? <>You're <b>{money(g.expectedByNow - g.spent, { cents: false })}</b> under an even pace. </> : 'Right on pace.'}
                  </Banner>
                )}
              </div>
            </Card>
          </div>

          <div className="grid g-3 mt-16">
            <a className="card" href="#meals" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="row"><span className="avatar" style={{ background: 'var(--sage-soft)', color: 'var(--sage-strong)' }}><CalendarDays size={18} /></span><div><b>Meal planner</b><div className="muted small">Plan the week's meals</div></div></div>
            </a>
            <a className="card" href="#shopping" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="row"><span className="avatar" style={{ background: 'var(--sage-soft)', color: 'var(--sage-strong)' }}><ListChecks size={18} /></span>
                <div><b>This week's list</b><div className="muted small">{list.items.length ? <>{list.items.length} items · est. {money(list.total, { cents: false })} {g.weeklyNow > 0 && <span className={list.total > g.weeklyNow ? 'danger' : 'good'}>({list.total > g.weeklyNow ? 'over' : 'within'} allowance)</span>}</> : 'Plan meals to generate it'}</div></div></div>
            </a>
            <a className="card" href="#prices" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="row"><span className="avatar" style={{ background: 'var(--sage-soft)', color: 'var(--sage-strong)' }}><Tags size={18} /></span><div><b>Specials</b><div className="muted small">{specials} active special{specials === 1 ? '' : 's'} recorded</div></div></div>
            </a>
          </div>

          <div className="grid g-main mt-16">
            <Card title="Spending by week" action={<span className="legend"><span><i className="stat-dot" style={{ background: colors['series-1'] }} />Spent</span><span><i className="stat-dot" style={{ background: colors.danger }} />Over allowance</span></span>}>
              <div style={{ height: 230 }}>
                <ResponsiveContainer>
                  <BarChart data={weekData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(v) => moneyShort(v)} tickLine={false} axisLine={false} width={52} />
                    <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={<ChartTip labelFormat={(_: unknown, p: any[]) => p[0]?.payload.label} valueFormat={(v: number, p: any) => `${money(v)} of ${money(p.payload.allowance)}`} />} />
                    <ReferenceLine y={g.weekly} stroke={colors.muted} strokeDasharray="4 4" label={{ value: 'weekly allocation', position: 'insideTopRight', fontSize: 11, fill: colors.muted }} />
                    <Bar dataKey="Spent" radius={[4, 4, 0, 0]} maxBarSize={48}>
                      {weekData.map((w) => <Cell key={w.name} fill={w.over ? colors.danger : colors['series-1']} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="muted xs">Partial weeks at the start and end of the month get a proportional allowance.</p>
            </Card>
            <Card title="By store">
              {byStore.length === 0 ? <p className="muted small">No grocery purchases yet.</p> : byStore.map((b) => (
                <div key={b.id} className="budget-row">
                  <div className="top"><div className="name"><span className="store-dot" style={{ background: b.store?.color || 'var(--muted)' }} />{b.store?.name || 'Store not recorded'}</div><div className="amt"><b>{money(b.v, { cents: false })}</b></div></div>
                  <Progress value={b.v} max={g.spent} size="thin" />
                </div>
              ))}
            </Card>
          </div>

          <Card className="mt-16" title="Grocery purchases" action={<button className="btn sm" onClick={() => setAdding('new')}><Plus /> Add</button>}>
            {txs.length === 0 ? <Empty icon={<ShoppingBasket />} title="No purchases this month">Add a shop here, or record it from your shopping list.</Empty> : (
              <div className="list">
                {txs.map((t) => (
                  <button key={t.id} className="list-item" style={{ width: '100%', background: 'none', border: 0, borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }} onClick={() => setAdding(t)}>
                    <span className="store-dot" style={{ background: data.stores.find((s) => s.id === t.storeId)?.color || 'var(--muted)', width: 12, height: 12 }} />
                    <div className="grow"><div className="title">{t.description}</div><div className="meta">{fmtDate(t.date)} · {t.method}</div></div>
                    <span className="amount">{money(t.amount)}</span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
      {adding && <TransactionForm initial={adding === 'new' ? undefined : adding} defaults={{ categoryId: g.categoryId }} onClose={() => setAdding(null)} />}
    </>
  );
}
