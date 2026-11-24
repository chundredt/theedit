import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, Plus, ReceiptText, Search } from 'lucide-react';
import { Card, ChartTip, Empty, PageHeader, PeriodNav, Seg } from '../components/ui';
import { CategorySelect, TransactionForm } from '../components/TransactionForm';
import { getToday, useData } from '../data/store';
import { usePeriod } from '../lib/ui-state';
import { summarize, transactionsIn } from '../domain/budget';
import { PAYMENT_METHODS, type Transaction } from '../domain/types';
import { fmtDay, money, moneyShort } from '../lib/format';
import { exportTransactions } from '../lib/exports';
import { useCssVars } from '../lib/useChartColors';

export function TransactionsPage() {
  const data = useData();
  const [period, setPeriod] = usePeriod();
  const [view, setView] = useState<'list' | 'charts'>('list');
  const [cat, setCat] = useState('');
  const [method, setMethod] = useState('');
  const [q, setQ] = useState('');
  const [allTime, setAllTime] = useState(false);
  const [editing, setEditing] = useState<Transaction | 'new' | null>(null);
  const catMap = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories]);

  const txs = useMemo(() => {
    const base = allTime ? data.transactions : transactionsIn(data, period);
    const needle = q.trim().toLowerCase();
    return base
      .filter((t) => (!cat || t.categoryId === cat) && (!method || t.method === method) && (!needle || t.description.toLowerCase().includes(needle) || t.notes?.toLowerCase().includes(needle)))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [data, period, cat, method, q, allTime]);
  const total = txs.reduce((s, t) => s + t.amount, 0);
  const grouped = useMemo(() => {
    const m = new Map<string, Transaction[]>();
    for (const t of txs) m.set(t.date, [...(m.get(t.date) || []), t]);
    return [...m.entries()];
  }, [txs]);

  return (
    <>
      <PageHeader title="Transactions" sub="Every rand in, every rand out.">
        {!allTime && <PeriodNav value={period} onChange={setPeriod} startDay={data.settings.periodStartDay} />}
        <button className="btn" onClick={() => exportTransactions(data, txs, allTime ? 'all-transactions' : period)} disabled={!txs.length}><Download /> Export CSV</button>
        <button className="btn primary" onClick={() => setEditing('new')}><Plus /> Add</button>
      </PageHeader>

      <div className="row wrap" style={{ marginBottom: 16 }}>
        <Seg value={view} onChange={setView} options={[{ value: 'list', label: 'List' }, { value: 'charts', label: 'Charts' }]} />
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 320 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--muted)' }} />
          <input className="input" style={{ paddingLeft: 36 }} placeholder="Search description or notes" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search transactions" />
        </div>
        <div style={{ flex: '0 1 220px' }}><CategorySelect value={cat} onChange={setCat} includeAll="All categories" /></div>
        <select className="input" style={{ flex: '0 1 170px' }} value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Payment method filter">
          <option value="">All payment methods</option>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
        </select>
        <label className="check small"><input type="checkbox" checked={allTime} onChange={(e) => setAllTime(e.target.checked)} /> All months</label>
      </div>

      {view === 'list' ? (
        <Card title={<>{txs.length} transaction{txs.length === 1 ? '' : 's'}</>} action={<b className="num">{money(total)}</b>}>
          {txs.length === 0 ? (
            <Empty icon={<ReceiptText />} title="No transactions here" action={<button className="btn primary" onClick={() => setEditing('new')}><Plus /> Add expense</button>}>
              {q || cat || method ? 'Try clearing the filters.' : 'Add your first expense to start tracking.'}
            </Empty>
          ) : (
            <div className="list">
              {grouped.map(([date, items]) => (
                <div key={date}>
                  <div className="date-head">{fmtDay(date)} <span style={{ float: 'right' }} className="num">{money(items.reduce((s, t) => s + t.amount, 0))}</span></div>
                  {items.map((t) => {
                    const c = catMap.get(t.categoryId);
                    return (
                      <button key={t.id} className="list-item" style={{ width: '100%', background: 'none', border: 0, borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }} onClick={() => setEditing(t)}>
                        <span className="avatar" style={{ background: `color-mix(in srgb, ${c?.color || '#999'} 15%, transparent)`, color: c?.color }}>{(c?.name || '?').slice(0, 2).toUpperCase()}</span>
                        <div className="grow">
                          <div className="title">{t.description}</div>
                          <div className="meta">{c?.name || 'Deleted category'} · {t.method}{t.storeId ? ` · ${data.stores.find((s) => s.id === t.storeId)?.name || ''}` : ''}{t.notes ? ` · ${t.notes}` : ''}</div>
                        </div>
                        <span className={`amount ${c?.group === 'savings' ? 'good' : ''}`}>{c?.group === 'savings' ? '+' : ''}{money(t.amount)}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <Charts txs={txs} period={period} />
      )}
      {editing && <TransactionForm initial={editing === 'new' ? undefined : editing} defaults={editing === 'new' && cat ? { categoryId: cat } : undefined} onClose={() => setEditing(null)} />}
    </>
  );
}

function Charts({ txs, period }: { txs: Transaction[]; period: string }) {
  const data = useData();
  const today = getToday();
  const colors = useCssVars(['series-1', 'series-3', 'surface', 'muted']);
  const catMap = new Map(data.categories.map((c) => [c.id, c]));
  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of txs) if (catMap.get(t.categoryId)?.group !== 'savings') m.set(t.categoryId, (m.get(t.categoryId) || 0) + t.amount);
    const arr = [...m.entries()].map(([id, v]) => ({ id, name: catMap.get(id)?.name || 'Other', value: Math.round(v * 100) / 100, color: catMap.get(id)?.color || '#999' })).sort((a, b) => b.value - a.value);
    // Keep the donut readable: top 7 + "Other".
    if (arr.length > 8) {
      const rest = arr.slice(7).reduce((s, x) => s + x.value, 0);
      return [...arr.slice(0, 7), { id: 'other', name: 'Other', value: rest, color: '#9a948a' }];
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txs, data.categories]);
  const total = byCat.reduce((s, x) => s + x.value, 0);
  const s = summarize(data, period, today);
  const pva = s.rows.filter((r) => r.category.group !== 'savings' && (r.planned > 0 || r.actual > 0)).map((r) => ({ name: r.category.name, Planned: r.planned, Actual: r.actual }));

  return (
    <div className="grid g-2">
      <Card title="Where your money went" action={<span className="muted small">Excludes savings transfers</span>}>
        {total === 0 ? <p className="muted small">No spending in this view.</p> : (
          <div className="row wrap" style={{ alignItems: 'center', gap: 20 }}>
            <div style={{ width: 200, height: 200, position: 'relative' }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={byCat} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={1} stroke={colors.surface} strokeWidth={2}>
                    {byCat.map((c) => <Cell key={c.id} fill={c.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', textAlign: 'center' }}>
                <div><div className="muted xs">Spent</div><b className="num">{moneyShort(total)}</b></div>
              </div>
            </div>
            <div className="grow" style={{ minWidth: 180 }}>
              {byCat.map((c) => (
                <div key={c.id} className="row between small" style={{ padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                  <span className="row" style={{ gap: 8 }}><i className="stat-dot" style={{ background: c.color }} />{c.name}</span>
                  <span className="num"><b>{money(c.value, { cents: false })}</b> <span className="muted">{Math.round((c.value / total) * 100)}%</span></span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
      <Card title="Planned vs actual" action={<span className="muted small">This month's budget</span>}>
        {pva.length === 0 ? <p className="muted small">Set a budget to compare.</p> : (
          <div style={{ height: Math.max(220, pva.length * 34 + 40) }}>
            <ResponsiveContainer>
              <BarChart data={pva} layout="vertical" margin={{ left: 0, right: 12, top: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => moneyShort(v)} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={130} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                <Tooltip content={<ChartTip />} cursor={{ fill: 'var(--surface-2)' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Planned" fill={colors.muted} fillOpacity={0.45} radius={[0, 4, 4, 0]} />
                <Bar dataKey="Actual" fill={colors['series-3']} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
