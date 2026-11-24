import { CheckCircle2, Clock, AlertOctagon, CalendarClock } from 'lucide-react';
import type { Bill, CategoryRow } from '../domain/budget';
import { Progress } from './ui';
import { fmtDate, money } from '../lib/format';
import { getToday, useStore } from '../data/store';

export function BudgetRowView({ row, compact }: { row: CategoryRow; compact?: boolean }) {
  const { category: c, planned, actual, remaining, status } = row;
  return (
    <div className="budget-row">
      <div className="top">
        <div className="name"><span className="stat-dot" style={{ background: c.color }} /><span className="t">{c.name}</span></div>
        <div className="amt"><b style={{ color: 'var(--text)' }}>{money(actual, { cents: false })}</b> / {money(planned, { cents: false })}</div>
      </div>
      <Progress value={actual} max={planned} status={status === 'idle' ? undefined : status} />
      {!compact && (
        <div className="foot">
          <span>{planned > 0 ? `${Math.round((actual / planned) * 100)}% used` : actual > 0 ? 'No budget set' : 'Nothing spent yet'}</span>
          <span className={status === 'over' ? 'danger' : status === 'near' ? 'warn' : ''}>
            {remaining >= 0 ? `${money(remaining, { cents: false })} left` : `${money(-remaining, { cents: false })} over`}
          </span>
        </div>
      )}
    </div>
  );
}

const BILL_ICON = { paid: CheckCircle2, overdue: AlertOctagon, 'due-soon': Clock, upcoming: CalendarClock };

export function BillList({ bills, limit, showPaid = true }: { bills: Bill[]; limit?: number; showPaid?: boolean }) {
  const addTransaction = useStore((s) => s.addTransaction);
  const toast = useStore((s) => s.toast);
  const list = (showPaid ? bills : bills.filter((b) => b.status !== 'paid')).slice(0, limit);
  if (!list.length) return <p className="muted small">{bills.length ? 'All debit orders and bills are paid for this month.' : 'Add a due day to fixed expenses (in Budget) to see upcoming debit orders here.'}</p>;
  return (
    <div className="list">
      {list.map((b) => {
        const Ic = BILL_ICON[b.status];
        const tone = b.status === 'paid' ? 'good' : b.status === 'overdue' ? 'danger' : b.status === 'due-soon' ? 'warn' : '';
        const when = b.status === 'paid' ? 'Paid' : b.daysUntil === 0 ? 'Due today' : b.daysUntil < 0 ? `${-b.daysUntil} day${b.daysUntil === -1 ? '' : 's'} overdue` : b.daysUntil === 1 ? 'Due tomorrow' : `In ${b.daysUntil} days`;
        return (
          <div className="list-item" key={b.category.id}>
            <span className={`avatar ${tone}`} style={{ background: tone ? `var(--${tone}-soft)` : 'var(--surface-2)' }}><Ic size={17} /></span>
            <div className="grow">
              <div className="title">{b.category.name}</div>
              <div className="meta">{fmtDate(b.dueDate)} · {b.category.payMethod || 'Payment'} · <span className={tone}>{when}</span></div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="amount">{money(b.status === 'paid' ? b.paid : b.outstanding)}</div>
              {b.status !== 'paid' && (
                <button className="btn ghost sm" style={{ height: 24, padding: '0 6px', marginRight: -6 }} onClick={() => {
                  addTransaction({ date: getToday(), description: b.category.name, amount: b.outstanding, categoryId: b.category.id, method: b.category.payMethod || 'Debit order' });
                  toast(`${b.category.name} marked as paid`);
                }}>Mark paid</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
