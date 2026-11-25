import { useMemo, useState } from 'react';
import { Camera, Plus, ShoppingBasket } from 'lucide-react';
import { ReceiptScan } from '../components/ReceiptScan';
import { Banner, Card, Empty, MoneyInput, PageHeader, PeriodNav, Progress } from '../components/ui';
import { TransactionForm } from '../components/TransactionForm';
import { getToday, useData, useStore } from '../data/store';
import { usePeriod } from '../lib/ui-state';
import { groceryOverview } from '../domain/grocery';
import { transactionsIn } from '../domain/budget';
import { periodKeyFor } from '../domain/period';
import { fmtDate, fmtDay, money } from '../lib/format';
import type { Transaction } from '../domain/types';

export function GroceriesPage() {
  const data = useData();
  const today = getToday();
  const [period, setPeriod] = usePeriod();
  const setAllocation = useStore((s) => s.setAllocation);
  const g = useMemo(() => groceryOverview(data, period, today), [data, period, today]);
  const isCurrent = period === periodKeyFor(today, data.settings.periodStartDay);
  const [adding, setAdding] = useState<Transaction | 'new' | null>(null);
  const [scanning, setScanning] = useState(false);
  const txs = transactionsIn(data, period).filter((t) => t.categoryId === g.categoryId).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <PageHeader title="Grocery money" sub="What you can spend on food this week.">
        <PeriodNav value={period} onChange={setPeriod} startDay={data.settings.periodStartDay} />
      </PageHeader>

      {!g.categoryId ? <Banner tone="warn">No groceries category found. Add one in Budget.</Banner> : (
        <div className="stack" style={{ gap: 16, maxWidth: 720 }}>
          <section className="card hero money-today">
            <div className="label">Left for groceries this month</div>
            <div className="hero-amount num" data-testid="grocery-remaining">{money(g.remaining)}</div>
            <div className="hero-line">{g.remaining < 0 ? 'Over budget for the month.' : isCurrent ? `About ${money(g.weeklyNow, { cents: false })} a week for the ${g.daysLeft} days left` : ''}</div>
            <div className="mt-16"><Progress value={g.spent} max={g.budget} size="thin" /></div>
            <div className="row wrap mt-16" style={{ gap: 8 }}>
              <button className="btn primary" onClick={() => setAdding('new')}><Plus /> Add purchase</button>
              <button className="btn" onClick={() => setScanning(true)}><Camera /> Scan till slip</button>
            </div>
          </section>

          <Card title="Each week">
            <div className="row between" style={{ marginBottom: 8 }}>
              <span className="muted">Monthly budget</span>
              <div style={{ width: 150 }}><MoneyInput value={g.budget} ariaLabel="Monthly grocery budget" onCommit={(v) => v !== g.budget && setAllocation(period, g.categoryId!, v)} /></div>
            </div>
            <div className="row between" style={{ marginBottom: 6 }}>
              <span className="muted">Weekly amount</span><b className="num" data-testid="grocery-weekly">{money(g.weekly)}</b>
            </div>
            {g.weeks.map((w) => {
              const left = w.allowance - w.spent;
              return (
                <div key={w.start} className="budget-row">
                  <div className="top">
                    <div className="name"><span className="t">{fmtDay(w.start)} – {fmtDay(w.end)}</span></div>
                    <div className={`amt ${left < 0 ? 'danger' : ''}`}>{w.start > today ? money(w.allowance, { cents: false }) : left >= 0 ? `${money(left, { cents: false })} left` : `${money(-left, { cents: false })} over`}</div>
                  </div>
                  <Progress value={w.spent} max={w.allowance} status={left < 0 ? 'over' : undefined} />
                </div>
              );
            })}
          </Card>

          <Card title="Purchases">
            {txs.length === 0 ? <Empty icon={<ShoppingBasket />} title="No purchases this month">Add a shop, or scan the till slip.</Empty> : (
              <div className="list">
                {txs.map((t) => (
                  <button key={t.id} className="list-item" style={{ width: '100%', background: 'none', border: 0, borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }} onClick={() => setAdding(t)}>
                    <div className="grow"><div className="title">{t.description}</div><div className="meta">{fmtDate(t.date)}</div></div>
                    <span className="amount">{money(t.amount, { cents: false })}</span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
      {scanning && <ReceiptScan onClose={() => setScanning(false)} />}
      {adding && <TransactionForm initial={adding === 'new' ? undefined : adding} defaults={{ categoryId: g.categoryId }} onClose={() => setAdding(null)} />}
    </>
  );
}
