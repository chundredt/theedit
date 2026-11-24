import { useState } from 'react';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { Card, MoneyInput } from './ui';
import { getToday, useData, useStore } from '../data/store';
import { resolveBudget, summarize } from '../domain/budget';
import type { IncomeKind, IncomeLine, PeriodKey } from '../domain/types';
import { fmtDate, money, ordinal } from '../lib/format';
import { uid } from '../lib/id';

/** The type is worked out from the name, so there's nothing extra to choose. */
export function kindFromName(name: string): IncomeKind {
  return /salar|wage|pay/i.test(name) ? 'salary' : /commission|bonus/i.test(name) ? 'commission' : /allowance/i.test(name) ? 'allowance' : 'other';
}

/**
 * Income for one budget month. One line per income: the amount, and a tick when it's in.
 * Ticking uses the expected amount; if a different amount arrived (commission), just type it over.
 */
export function IncomeCard({ period }: { period: PeriodKey }) {
  const data = useData();
  const today = getToday();
  const { setIncome, markIncome } = useStore.getState();
  const budget = resolveBudget(data, period);
  const s = summarize(data, period, today);
  const [editing, setEditing] = useState(false);
  const payDay = data.settings.periodStartDay > 1 ? data.settings.periodStartDay : 25;
  const update = (lines: IncomeLine[]) => setIncome(period, lines);
  const patch = (id: string, p: Partial<IncomeLine>) => update(budget.income.map((l) => (l.id === id ? { ...l, ...p } : l)));
  const add = (name: string) => {
    update([...budget.income, { id: uid(), name, kind: kindFromName(name), amount: 0, payDay }]);
    setEditing(true);
  };

  return (
    <Card title="Income" action={budget.income.length > 0 && (
      <button className="btn sm ghost" onClick={() => setEditing(!editing)} aria-pressed={editing}>{editing ? 'Done' : <><Pencil /> Edit</>}</button>
    )}>
      {budget.income.length === 0 && (
        <div className="stack" style={{ gap: 10 }}>
          <p className="muted small">What's paid into your account each month?</p>
          <div className="row wrap" style={{ gap: 6 }}>{['Salary', 'Commission', 'Allowance'].map((n) => <button key={n} className="btn sm" onClick={() => add(n)}><Plus /> {n}</button>)}</div>
        </div>
      )}
      <div className="list">
        {s.incomeLines.map(({ line, payDate, received, late }) => (
          <div key={line.id} className="income-row" data-testid={`income-${line.kind || kindFromName(line.name)}`}>
            {editing ? (
              <>
                <div className="grow" style={{ minWidth: 0 }}>
                  <input className="input sm" aria-label="Income name" defaultValue={line.name} key={line.name}
                    onBlur={(e) => { const n = e.target.value.trim() || 'Income'; if (n !== line.name) patch(line.id, { name: n, kind: kindFromName(n) }); }} />
                  <label className="xs muted row" style={{ gap: 6, marginTop: 6 }}>Paid on the
                    <select className="input sm" style={{ width: 92, height: 34 }} value={line.payDay || ''} aria-label={`${line.name} pay day`} onChange={(e) => patch(line.id, { payDay: e.target.value ? Number(e.target.value) : undefined })}>
                      <option value="">—</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{ordinal(d)}</option>)}
                    </select>
                  </label>
                </div>
                <button className="btn ghost icon" aria-label={`Remove ${line.name}`} onClick={() => update(budget.income.filter((l) => l.id !== line.id))}><Trash2 /></button>
              </>
            ) : (
              <>
                <div className="grow" style={{ minWidth: 0 }}>
                  <b style={{ fontSize: 15.5 }}>{line.name}</b>
                  <div className={`xs ${received ? 'good' : late ? 'warn' : 'muted'}`}>
                    {received
                      ? (Math.abs((line.received || 0) - line.amount) >= 1 ? `In · expected ${money(line.amount, { cents: false })}` : 'In')
                      : payDate ? `${late ? 'Was due' : 'Due'} ${fmtDate(payDate).slice(0, 5)}` : 'Expected'}
                  </div>
                </div>
                <div style={{ width: 132, flexShrink: 0 }}>
                  <MoneyInput value={received ? line.received! : line.amount} ariaLabel={`${line.name} amount`}
                    onCommit={(v) => (received ? v !== line.received && markIncome(period, line.id, v, line.receivedOn) : v !== line.amount && patch(line.id, { amount: v }))} />
                </div>
              </>
            )}
            {!editing && (
              <button className={`round-check income-tick ${received ? 'on' : ''}`} aria-pressed={received}
                aria-label={received ? `Undo ${line.name} received` : `Mark ${line.name} as received`}
                onClick={() => markIncome(period, line.id, received ? undefined : line.amount, today)}>
                {received && <Check />}
              </button>
            )}
          </div>
        ))}
      </div>
      {editing && (
        <div className="row wrap mt-12" style={{ gap: 6 }}>
          {['Salary', 'Commission', 'Allowance', 'Other income'].map((n) => <button key={n} className="btn sm" onClick={() => add(n)}><Plus /> {n}</button>)}
        </div>
      )}
      {budget.income.length > 0 && (
        <div className="row between small" style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 6 }}>
          <span className="muted">In <b className="good" style={{ fontSize: 14 }}>{money(s.incomeReceived, { cents: false })}</b>{s.incomePending > 0 && <> · to come {money(s.incomePending, { cents: false })}</>}</span>
          <b className="num" data-testid="income-total">{money(s.income)}</b>
        </div>
      )}
      {!editing && budget.income.some((l) => l.received === undefined) && <p className="muted xs mt-8">Tick when it's in. Different amount? Type over it.</p>}
    </Card>
  );
}
