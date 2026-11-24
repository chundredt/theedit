import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, Printer, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, ChartTip, PageHeader, Progress } from '../components/ui';
import { getToday, useData } from '../data/store';
import { usePeriod } from '../lib/ui-state';
import { monthReport, trend, knownPeriods } from '../domain/reports';
import { periodKeyFor, periodLabel, shiftPeriod } from '../domain/period';
import { money, moneyShort } from '../lib/format';
import { exportBudget } from '../lib/exports';
import { useCssVars } from '../lib/useChartColors';

export function ReportsPage() {
  const data = useData();
  const today = getToday();
  const sd = data.settings.periodStartDay;
  const [period, setPeriod] = usePeriod();
  const periods = useMemo(() => {
    const k = knownPeriods(data, (d) => periodKeyFor(d, sd));
    return k.includes(period) ? k : [period, ...k].sort().reverse();
  }, [data, sd, period]);
  const [compareTo, setCompareTo] = useState(shiftPeriod(period, -1));
  const r = useMemo(() => monthReport(data, period, today), [data, period, today]);
  const c = useMemo(() => monthReport(data, compareTo, today), [data, compareTo, today]);
  const t = useMemo(() => trend(data, period, 6, today), [data, period, today]);
  const colors = useCssVars(['series-1', 'series-3', 'series-6', 'muted']);
  const s = r.summary;
  const isCurrent = period === periodKeyFor(today, sd);
  const spendRows = s.rows.filter((x) => x.category.group !== 'savings' && (x.planned > 0 || x.actual > 0));

  const compareRows = useMemo(() => {
    const ids = new Set([...r.summary.rows, ...c.summary.rows].filter((x) => x.actual > 0 || x.planned > 0).map((x) => x.category.id));
    return [...ids].map((id) => {
      const a = r.summary.rows.find((x) => x.category.id === id);
      const b = c.summary.rows.find((x) => x.category.id === id);
      return { name: (a || b)!.category.name, group: (a || b)!.category.group, a: a?.actual || 0, b: b?.actual || 0 };
    }).sort((x, y) => Math.abs(y.a - y.b) - Math.abs(x.a - x.b));
  }, [r, c]);

  const delta = (a: number, b: number, goodWhenLower = true) => {
    const d = a - b;
    if (Math.abs(d) < 0.5) return <span className="muted xs">no change</span>;
    const good = goodWhenLower ? d < 0 : d > 0;
    const Ic = d > 0 ? TrendingUp : TrendingDown;
    return <span className={`xs row ${good ? 'good' : 'danger'}`} style={{ gap: 4, display: 'inline-flex' }}><Ic size={13} />{money(Math.abs(d), { cents: false })}</span>;
  };

  return (
    <>
      <PageHeader title="Monthly report" sub={isCurrent ? 'This month so far — the full picture is ready at month-end.' : `How ${periodLabel(period)} went.`}>
        <select className="input" style={{ width: 'auto' }} value={period} onChange={(e) => { setPeriod(e.target.value); setCompareTo(shiftPeriod(e.target.value, -1)); }} aria-label="Report month">
          {periods.map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
        </select>
        <button className="btn" onClick={() => exportBudget(data, period, today)}><Download /> CSV</button>
        <button className="btn hide-sm" onClick={() => window.print()}><Printer /> Print</button>
      </PageHeader>

      <div className="grid g-6">
        {[
          ['Income', money(s.income, { cents: false }), ''],
          ['Total spending', money(s.spent, { cents: false }), `${money(s.planned.fixed + s.planned.variable, { cents: false })} planned`],
          ['Saved', money(s.saved, { cents: false }), `${r.savingsRate.toFixed(0)}% of income`],
          ['Groceries', money(r.grocerySpent, { cents: false }), `of ${money(r.groceryBudget, { cents: false })}`],
          ['Left over', money(s.remaining, { cents: false }), s.remaining >= 0 ? 'Unspent income' : 'Overspent'],
          ['Transactions', String(r.txCount), ''],
        ].map(([l, v, h]) => (
          <div className="card stat" key={l}><div className="label">{l}</div><div className={`value ${l === 'Left over' && s.remaining < 0 ? 'danger' : ''}`}>{v}</div>{h && <div className="hint">{h}</div>}</div>
        ))}
      </div>

      <div className="grid g-2 mt-16">
        <Card title="Where you saved money" icon={<TrendingDown size={17} className="good" />}>
          {r.underBudget.length === 0 ? <p className="muted small">No categories under budget.</p> : r.underBudget.slice(0, 6).map((x) => (
            <div key={x.category.id} className="row between small" style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
              <span className="row" style={{ gap: 8 }}><i className="stat-dot" style={{ background: x.category.color }} />{x.category.name}</span>
              <span><b className="good">{money(x.remaining, { cents: false })}</b> <span className="muted">under</span></span>
            </div>
          ))}
          {r.underBudget.length > 0 && <p className="muted xs mt-8">Total under budget: {money(r.underBudget.reduce((a, x) => a + x.remaining, 0), { cents: false })}{isCurrent ? ' so far' : ''}.</p>}
        </Card>
        <Card title="Where you overspent" icon={<TrendingUp size={17} className="danger" />}>
          {r.overBudget.length === 0 ? <p className="muted small">Nothing over budget{isCurrent ? ' so far' : ''}. 👏</p> : r.overBudget.map((x) => (
            <div key={x.category.id} className="row between small" style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
              <span className="row" style={{ gap: 8 }}><i className="stat-dot" style={{ background: x.category.color }} />{x.category.name}</span>
              <span><b className="danger">{money(-x.remaining, { cents: false })}</b> <span className="muted">over</span></span>
            </div>
          ))}
        </Card>
      </div>

      <Card className="mt-16" title="Budget vs actual">
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Category</th><th className="r">Planned</th><th className="r">Actual</th><th className="r">Difference</th><th className="hide-sm" style={{ width: '28%' }}></th></tr></thead>
            <tbody>
              {spendRows.map((x) => (
                <tr key={x.category.id}>
                  <td><span className="row" style={{ gap: 8 }}><i className="stat-dot" style={{ background: x.category.color }} />{x.category.name}</span></td>
                  <td className="r">{money(x.planned)}</td>
                  <td className="r">{money(x.actual)}</td>
                  <td className={`r ${x.remaining < -0.004 ? 'danger' : 'good'}`}>{x.remaining >= 0 ? '' : '−'}{money(Math.abs(x.remaining))}</td>
                  <td className="hide-sm"><Progress value={x.actual} max={x.planned} status={x.status === 'idle' ? undefined : x.status} size="thin" /></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td>Total spending</td><td className="r">{money(s.planned.fixed + s.planned.variable)}</td><td className="r">{money(s.spent)}</td><td className={`r ${s.spent > s.planned.fixed + s.planned.variable ? 'danger' : 'good'}`}>{money(s.planned.fixed + s.planned.variable - s.spent)}</td><td className="hide-sm" /></tr>
              <tr><td>Savings</td><td className="r">{money(s.planned.savings)}</td><td className="r">{money(s.saved)}</td><td className="r">{money(s.saved - s.planned.savings)}</td><td className="hide-sm" /></tr></tfoot>
          </table>
        </div>
      </Card>

      <Card className="mt-16" title="Last 6 months" action={<span className="muted small">Income, spending and savings per month</span>}>
        <div style={{ height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={t.map((x) => ({ name: periodLabel(x.key, true), Income: x.income, Spent: x.spent, Saved: x.saved }))} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(v) => moneyShort(v)} tickLine={false} axisLine={false} width={56} />
              <Tooltip content={<ChartTip />} cursor={{ fill: 'var(--surface-2)' }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Income" fill={colors.muted} fillOpacity={0.5} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="Spent" fill={colors['series-3']} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="Saved" fill={colors['series-6']} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="mt-16" title="Compare months" action={
        <span className="row small" style={{ gap: 6 }}>{periodLabel(period, true)} vs
          <select className="input sm" style={{ width: 'auto' }} value={compareTo} onChange={(e) => setCompareTo(e.target.value)} aria-label="Compare with">
            {[...new Set([...periods, shiftPeriod(period, -1)])].filter((p) => p !== period).sort().reverse().map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
          </select>
        </span>}>
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Category</th><th className="r">{periodLabel(period, true)}</th><th className="r">{periodLabel(compareTo, true)}</th><th className="r">Change</th></tr></thead>
            <tbody>
              <tr><td><b>Income</b></td><td className="r">{money(r.summary.income)}</td><td className="r">{money(c.summary.income)}</td><td className="r">{delta(r.summary.income, c.summary.income, false)}</td></tr>
              <tr><td><b>Total spending</b></td><td className="r">{money(r.summary.spent)}</td><td className="r">{money(c.summary.spent)}</td><td className="r">{delta(r.summary.spent, c.summary.spent)}</td></tr>
              <tr><td><b>Saved</b></td><td className="r">{money(r.summary.saved)}</td><td className="r">{money(c.summary.saved)}</td><td className="r">{delta(r.summary.saved, c.summary.saved, false)}</td></tr>
              {compareRows.map((x) => (
                <tr key={x.name}><td>{x.name}</td><td className="r">{money(x.a)}</td><td className="r">{money(x.b)}</td><td className="r">{delta(x.a, x.b, x.group !== 'savings')}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {isCurrent && <p className="muted xs mt-8">{periodLabel(period)} isn't finished yet, so it will usually look lower than a full month.</p>}
      </Card>
    </>
  );
}
