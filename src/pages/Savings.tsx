import { useState } from 'react';
import { Minus, Pencil, PiggyBank, Plus, Trash2 } from 'lucide-react';
import { Banner, Card, Confirm, Empty, Field, Modal, MoneyInput, PageHeader, Ring } from '../components/ui';
import { DateInput } from '../components/DateInput';
import { getToday, useData, useStore } from '../data/store';
import { goalProgress, monthsUntil } from '../domain/savings';
import { addDays, fmtDate, money } from '../lib/format';
import type { SavingsGoal } from '../domain/types';

export function SavingsPage() {
  const data = useData();
  const today = getToday();
  const [editing, setEditing] = useState<SavingsGoal | 'new' | null>(null);
  const [moving, setMoving] = useState<{ goal: SavingsGoal; dir: 1 | -1 } | null>(null);
  const [deleting, setDeleting] = useState<SavingsGoal | null>(null);
  const progress = data.goals.map((g) => goalProgress(data, g, today));
  const totalSaved = progress.reduce((s, p) => s + p.saved, 0);
  const totalTarget = progress.reduce((s, p) => s + p.goal.target, 0);
  const planned = progress.reduce((s, p) => s + (p.status === 'done' ? 0 : p.goal.monthlyContribution), 0);
  const required = progress.reduce((s, p) => s + p.requiredMonthly, 0);
  const thisMonth = progress.reduce((s, p) => s + p.thisMonth, 0);

  return (
    <>
      <PageHeader title="Savings goals" sub="Pay yourself first, and watch each goal fill up.">
        <button className="btn primary" onClick={() => setEditing('new')}><Plus /> New goal</button>
      </PageHeader>
      {data.goals.length === 0 ? (
        <Card><Empty icon={<PiggyBank />} title="No savings goals yet" action={<button className="btn primary" onClick={() => setEditing('new')}><Plus /> Create a goal</button>}>Start with an emergency fund — three months of essential expenses is a solid target.</Empty></Card>
      ) : (
        <>
          <div className="grid g-4">
            <div className="card stat"><div className="label">Total saved</div><div className="value">{money(totalSaved, { cents: false })}</div><div className="hint">of {money(totalTarget, { cents: false })} across goals</div></div>
            <div className="card stat"><div className="label">Saved this month</div><div className="value good">{money(thisMonth, { cents: false })}</div></div>
            <div className="card stat"><div className="label">Planned each month</div><div className="value">{money(planned, { cents: false })}</div></div>
            <div className="card stat"><div className="label">Needed each month</div><div className={`value ${required > planned + 0.5 ? 'warn' : ''}`}>{money(required, { cents: false })}</div><div className="hint">to hit every target date</div></div>
          </div>
          {required > planned + 0.5 && <div className="mt-16"><Banner tone="warn">To reach every goal on time you need {money(required - planned, { cents: false })} more a month than you've planned. Increase contributions or move a target date out.</Banner></div>}
          <div className="grid g-2 mt-16">
            {progress.map((p) => {
              const contributions = data.transactions.filter((t) => t.goalId === p.goal.id).sort((a, b) => b.date.localeCompare(a.date));
              const statusChip = { done: <span className="chip good">Goal reached 🎉</span>, 'on-track': <span className="chip good">On track</span>, behind: <span className="chip warn">Behind</span>, overdue: <span className="chip danger">Past target date</span> }[p.status];
              return (
                <Card key={p.goal.id}>
                  <div className="row" style={{ alignItems: 'flex-start', gap: 18 }}>
                    <Ring pct={p.pct} size={96} stroke={9} color={p.goal.color}><span>{Math.round(p.pct)}%</span></Ring>
                    <div className="grow">
                      <div className="row between" style={{ alignItems: 'flex-start' }}><h2>{p.goal.name}</h2>{statusChip}</div>
                      <div className="display mt-8" style={{ fontSize: 26 }}>{money(p.saved, { cents: false })} <span className="muted" style={{ fontSize: 15, fontFamily: 'var(--font)' }}>of {money(p.goal.target, { cents: false })}</span></div>
                      <div className="muted small">Target date {fmtDate(p.goal.targetDate)} · {p.monthsLeft} month{p.monthsLeft === 1 ? '' : 's'} left</div>
                    </div>
                  </div>
                  <div className="grid g-2 mt-16" style={{ gap: 10 }}>
                    <div className="card flat" style={{ padding: 12, background: 'var(--surface-2)' }}><div className="muted xs">Need per month</div><b className="num">{money(p.requiredMonthly)}</b></div>
                    <div className="card flat" style={{ padding: 12, background: 'var(--surface-2)' }}><div className="muted xs">You plan per month</div><b className="num">{money(p.goal.monthlyContribution)}</b></div>
                  </div>
                  <p className="small text-2 mt-12">
                    {p.status === 'done' ? 'Done! Consider rolling the contribution into your next goal.' : p.projectedDate ? <>At {money(p.goal.monthlyContribution, { cents: false })} a month you'll get there around <b>{fmtDate(p.projectedDate)}</b>{p.status === 'behind' ? ` — ${money(p.requiredMonthly - p.goal.monthlyContribution, { cents: false })}/month more would make the target date.` : '.'}</> : 'Set a monthly contribution to see when you will reach this goal.'}
                  </p>
                  <div className="row wrap mt-12">
                    <button className="btn primary sm" onClick={() => setMoving({ goal: p.goal, dir: 1 })}><Plus /> Add money</button>
                    <button className="btn sm" onClick={() => setMoving({ goal: p.goal, dir: -1 })}><Minus /> Withdraw</button>
                    <button className="btn ghost icon sm" onClick={() => setEditing(p.goal)} aria-label="Edit goal"><Pencil /></button>
                    <button className="btn ghost icon sm" onClick={() => setDeleting(p.goal)} aria-label="Delete goal"><Trash2 /></button>
                  </div>
                  {contributions.length > 0 && (
                    <details className="mt-12"><summary className="small" style={{ cursor: 'pointer', fontWeight: 600 }}>{contributions.length} transfer{contributions.length === 1 ? '' : 's'}</summary>
                      {contributions.slice(0, 12).map((t) => <div key={t.id} className="row between xs" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}><span>{fmtDate(t.date)} · {t.description}</span><b className={t.amount < 0 ? 'danger' : 'good'}>{money(t.amount, { sign: true })}</b></div>)}
                    </details>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
      {editing && <GoalForm initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {moving && <MoveMoney goal={moving.goal} dir={moving.dir} onClose={() => setMoving(null)} />}
      {deleting && <Confirm title={`Delete “${deleting.name}”?`} message="The goal is removed. Transfers you made stay in your transactions as savings." onConfirm={() => useStore.getState().deleteGoal(deleting.id)} onClose={() => setDeleting(null)} />}
    </>
  );
}

function GoalForm({ initial, onClose }: { initial?: SavingsGoal; onClose: () => void }) {
  const data = useData();
  const today = getToday();
  const { saveGoal, toast } = useStore.getState();
  const savingsCats = data.categories.filter((c) => c.group === 'savings');
  const [name, setName] = useState(initial?.name || '');
  const [target, setTarget] = useState<number | ''>(initial?.target ?? '');
  const [opening, setOpening] = useState<number | ''>(initial?.openingBalance ?? 0);
  const [targetDate, setTargetDate] = useState<string | undefined>(initial?.targetDate || addDays(today, 365));
  const [monthly, setMonthly] = useState<number | ''>(initial?.monthlyContribution ?? '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId || savingsCats.find((c) => c.id === 'sav-other')?.id || savingsCats[0]?.id || '');
  const [touched, setTouched] = useState(false);
  const alreadyIn = initial ? data.transactions.filter((t) => t.goalId === initial.id).reduce((s, t) => s + t.amount, 0) : 0;
  const months = targetDate ? monthsUntil(today, targetDate) : 0;
  const need = Number(target) > 0 && months > 0 ? Math.max(0, (Number(target) - (Number(opening) || 0) - alreadyIn) / months) : 0;
  const ok = name.trim() && Number(target) > 0 && targetDate;
  const save = () => {
    setTouched(true);
    if (!ok) return;
    saveGoal({ id: initial?.id, name: name.trim(), target: Number(target), openingBalance: Number(opening) || 0, targetDate: targetDate!, monthlyContribution: Number(monthly) || 0, categoryId: categoryId || undefined, color: initial?.color });
    toast(initial ? 'Goal updated' : 'Goal created');
    onClose();
  };
  return (
    <Modal title={initial ? 'Edit goal' : 'New savings goal'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}>Save goal</button></>}>
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Goal name" className="full" error={touched && !name.trim() ? 'Required' : ''}><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Emergency fund" /></Field>
        <Field label="Target amount" error={touched && !(Number(target) > 0) ? 'Enter a target' : ''}><MoneyInput value={target} onChange={setTarget} ariaLabel="Target amount" /></Field>
        <Field label="Target date"><DateInput value={targetDate} onChange={setTargetDate} required /></Field>
        <Field label="Already saved before" help="Money set aside before using RandWise"><MoneyInput value={opening} onChange={setOpening} ariaLabel="Opening balance" /></Field>
        <Field label="Monthly contribution" help={need > 0 ? `You need ${money(need)} a month to make the date` : undefined}>
          <MoneyInput value={monthly} onChange={setMonthly} ariaLabel="Monthly contribution" />
        </Field>
        {need > 0 && <div className="full"><button type="button" className="btn sm" onClick={() => setMonthly(Math.ceil(need))}>Use {money(Math.ceil(need), { cents: false })} a month</button></div>}
        <Field label="Budget category" className="full" help="Transfers to this goal count as savings in this category">
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>{savingsCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function MoveMoney({ goal, dir, onClose }: { goal: SavingsGoal; dir: 1 | -1; onClose: () => void }) {
  const contribute = useStore((s) => s.contribute);
  const toast = useStore((s) => s.toast);
  const [amount, setAmount] = useState<number | ''>(dir === 1 ? goal.monthlyContribution || '' : '');
  const [date, setDate] = useState<string | undefined>(getToday());
  const [note, setNote] = useState('');
  return (
    <Modal title={dir === 1 ? `Add to ${goal.name}` : `Withdraw from ${goal.name}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!(Number(amount) > 0) || !date} onClick={() => { contribute(goal.id, dir * Number(amount), date!, note || undefined); toast(dir === 1 ? 'Savings recorded' : 'Withdrawal recorded'); onClose(); }}>{dir === 1 ? 'Add' : 'Withdraw'}</button></>}>
      <div className="form-grid">
        <Field label="Amount"><MoneyInput value={amount} onChange={setAmount} ariaLabel="Amount" autoFocus /></Field>
        <Field label="Date"><DateInput value={date} onChange={setDate} required /></Field>
        <Field label="Note (optional)" className="full"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
      <p className="muted xs mt-12">This is recorded as a transaction in your savings category, so the budget and dashboard update too.</p>
    </Modal>
  );
}
