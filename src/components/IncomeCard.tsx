import { useState } from 'react';
import { Check, Plus, Trash2, Undo2 } from 'lucide-react';
import { Card, MoneyInput } from './ui';
import { getToday, useData, useStore } from '../data/store';
import { commissionHistory, resolveBudget, summarize } from '../domain/budget';
import { INCOME_KINDS, type IncomeKind, type IncomeLine, type PeriodKey } from '../domain/types';
import { fmtDate, money, ordinal } from '../lib/format';
import { uid } from '../lib/id';

const DEFAULT_NAME: Record<IncomeKind, string> = { salary: 'Salary', commission: 'Commission', allowance: 'Allowance', other: 'Other income' };

/** Income for one budget month: what you expect, and what actually arrived. */
export function IncomeCard({ period }: { period: PeriodKey }) {
  const data = useData();
  const today = getToday();
  const { setIncome, markIncome } = useStore.getState();
  const budget = resolveBudget(data, period);
  const s = summarize(data, period, today);
  const history = commissionHistory(data, period);
  const [receiving, setReceiving] = useState<{ id: string; amount: number | '' } | null>(null);
  const payDayDefault = data.settings.periodStartDay > 1 ? data.settings.periodStartDay : 25;
  const update = (lines: IncomeLine[]) => setIncome(period, lines);
  const patch = (id: string, p: Partial<IncomeLine>) => update(budget.income.map((l) => (l.id === id ? { ...l, ...p } : l)));
  const add = (kind: IncomeKind) => update([...budget.income, { id: uid(), name: DEFAULT_NAME[kind], kind, amount: kind === 'commission' && history.average ? history.average : 0, payDay: payDayDefault }]);

  return (
    <Card title="Income" action={<span className="muted small">After tax</span>}>
      {budget.income.length === 0 && <p className="muted small" style={{ marginBottom: 12 }}>Add what's paid into your account each month.</p>}
      <div className="stack" style={{ gap: 12 }}>
        {s.incomeLines.map(({ line, payDate, received, difference, late }) => {
          const kind = line.kind || 'other';
          return (
            <div key={line.id} className="income-line" data-testid={`income-${kind}`}>
              <div className="row" style={{ gap: 8 }}>
                <input className="input sm grow" aria-label="Income name" defaultValue={line.name} key={line.name}
                  onBlur={(e) => e.target.value.trim() !== line.name && patch(line.id, { name: e.target.value.trim() || DEFAULT_NAME[kind] })} />
                <select className="input sm" style={{ width: 128 }} value={kind} aria-label={`${line.name} type`} onChange={(e) => patch(line.id, { kind: e.target.value as IncomeKind })}>
                  {INCOME_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
                <button className="btn ghost icon sm" aria-label={`Remove ${line.name}`} onClick={() => update(budget.income.filter((l) => l.id !== line.id))}><Trash2 /></button>
              </div>
              <div className="row wrap mt-8" style={{ gap: 8 }}>
                <div style={{ flex: '1 1 140px' }}>
                  <div className="xs muted" style={{ marginBottom: 3 }}>{kind === 'commission' ? 'Expected (estimate)' : 'Expected'}</div>
                  <MoneyInput value={line.amount} ariaLabel={`${line.name} expected`} onCommit={(v) => v !== line.amount && patch(line.id, { amount: v })} />
                </div>
                <div style={{ flex: '0 1 120px' }}>
                  <div className="xs muted" style={{ marginBottom: 3 }}>Paid on</div>
                  <select className="input" value={line.payDay || ''} aria-label={`${line.name} pay day`} onChange={(e) => patch(line.id, { payDay: e.target.value ? Number(e.target.value) : undefined })}>
                    <option value="">—</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{ordinal(d)}</option>)}
                  </select>
                </div>
                <div style={{ flex: '1 1 170px', alignSelf: 'flex-end' }}>
                  {receiving?.id === line.id ? (
                    <form className="row" style={{ gap: 6 }} onSubmit={(e) => { e.preventDefault(); markIncome(period, line.id, Number(receiving.amount) || 0, today); setReceiving(null); }}>
                      <MoneyInput value={receiving.amount} onChange={(v) => setReceiving({ id: line.id, amount: v })} ariaLabel={`${line.name} received`} autoFocus />
                      <button className="btn primary icon" type="submit" aria-label="Confirm amount received"><Check /></button>
                    </form>
                  ) : received ? (
                    <div className="row" style={{ gap: 6, justifyContent: 'space-between' }}>
                      <span className="chip good" title={line.receivedOn ? `Marked on ${fmtDate(line.receivedOn)}` : undefined}><Check /> {money(line.received!)} in</span>
                      <button className="btn ghost sm icon" aria-label={`Undo ${line.name} received`} title="Not received yet" onClick={() => markIncome(period, line.id, undefined)}><Undo2 /></button>
                    </div>
                  ) : (
                    <button className="btn sm" style={{ width: '100%', height: 40 }} onClick={() => setReceiving({ id: line.id, amount: line.amount })}>Mark as received</button>
                  )}
                </div>
              </div>
              <div className="xs mt-8 row wrap" style={{ gap: 8 }}>
                {payDate && !received && <span className={late ? 'warn' : 'muted'}>{late ? `Expected on ${fmtDate(payDate)} — not marked received yet` : `Due ${fmtDate(payDate)}`}</span>}
                {received && Math.abs(difference) >= 0.01 && <span className={difference > 0 ? 'good' : 'warn'}>{difference > 0 ? `${money(difference)} more than expected` : `${money(-difference)} less than expected — your safe-to-spend has been adjusted`}</span>}
                {kind === 'commission' && history.months > 0 && !received && (
                  <span className="muted">Avg of last {history.months} month{history.months === 1 ? '' : 's'}: {money(history.average, { cents: false })}
                    {Math.abs(history.average - line.amount) >= 1 && <button className="btn ghost sm" style={{ height: 22, padding: '0 6px' }} onClick={() => patch(line.id, { amount: history.average })}>Use</button>}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="row wrap mt-12" style={{ gap: 6 }}>
        {INCOME_KINDS.map((k) => <button key={k.value} className="btn sm" onClick={() => add(k.value)} title={k.hint}><Plus /> {k.label}</button>)}
      </div>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 14, display: 'grid', gap: 6 }}>
        <div className="row between"><span className="text-2">Expected this month</span><b className="num" data-testid="income-expected">{money(s.incomeExpected)}</b></div>
        <div className="row between"><span className="text-2">Received so far</span><b className="num good">{money(s.incomeReceived)}</b></div>
        {s.incomePending > 0 && <div className="row between"><span className="text-2">Still to come</span><b className="num">{money(s.incomePending)}</b></div>}
        {Math.abs(s.income - s.incomeExpected) >= 0.01 && (
          <div className="row between"><b>Income after actual amounts</b><b className="num" data-testid="income-total">{money(s.income)}</b></div>
        )}
      </div>
    </Card>
  );
}
