import { useState } from 'react';
import { Minus, Pencil, PiggyBank, Plus, Trash2 } from 'lucide-react';
import { Banner, Card, Confirm, Empty, Field, Modal, MoneyInput, PageHeader, Ring } from '../components/ui';
import { DateInput } from '../components/DateInput';
import { getToday, useData, useStore } from '../data/store';
import { goalProgress, monthsUntil } from '../domain/savings';
import { isYearly, YEARLY_IDEAS, yearlyCosts, yearlyMonthlyNeed } from '../domain/yearly';
import { resolveBudget } from '../domain/budget';
import { periodKeyFor } from '../domain/period';
import { CategorySelect } from '../components/TransactionForm';
import { addDays, fmtDate, money, toISO } from '../lib/format';
import type { SavingsGoal } from '../domain/types';

export function SavingsPage() {
  const data = useData();
  const today = getToday();
  const [editing, setEditing] = useState<SavingsGoal | 'new' | null>(null);
  const [moving, setMoving] = useState<{ goal: SavingsGoal; dir: 1 | -1 } | null>(null);
  const [deleting, setDeleting] = useState<SavingsGoal | null>(null);
  const goals = data.goals.filter((g) => !isYearly(g));
  const progress = goals.map((g) => goalProgress(data, g, today));
  const totalSaved = progress.reduce((s, p) => s + p.saved, 0);
  const totalTarget = progress.reduce((s, p) => s + p.goal.target, 0);
  const planned = progress.reduce((s, p) => s + (p.status === 'done' ? 0 : p.goal.monthlyContribution), 0);
  const required = progress.reduce((s, p) => s + p.requiredMonthly, 0);
  const thisMonth = progress.reduce((s, p) => s + p.thisMonth, 0);

  return (
    <>
      <PageHeader title="Savings" sub="Yearly costs first, then the goals you're working towards.">
        <button className="btn primary" onClick={() => setEditing('new')}><Plus /> New goal</button>
      </PageHeader>
      <YearlyCosts onMove={(goal, dir) => setMoving({ goal, dir })} />
      <h2 style={{ margin: '28px 0 12px', fontSize: 22 }}>Goals</h2>
      {goals.length === 0 ? (
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

function nextDateForMonth(today: string, month0: number): string {
  const t = new Date(today + 'T00:00:00');
  const y = t.getMonth() > month0 || (t.getMonth() === month0 && t.getDate() > 15) ? t.getFullYear() + 1 : t.getFullYear();
  return toISO(new Date(y, month0, 15));
}

/** Once-a-year costs: what each needs per month, what's saved, and paying them from the pot. */
export function YearlyCosts({ onMove }: { onMove: (g: SavingsGoal, dir: 1 | -1) => void }) {
  const data = useData();
  const today = getToday();
  const { setAllocation, saveGoal } = useStore.getState();
  const items = yearlyCosts(data, today);
  const need = yearlyMonthlyNeed(data, today);
  const key = periodKeyFor(today, data.settings.periodStartDay);
  const fundCat = data.categories.find((c) => c.id === 'sav-yearly');
  const planned = fundCat ? resolveBudget(data, key).allocations[fundCat.id] || 0 : 0;
  const [editing, setEditing] = useState<SavingsGoal | 'new' | null>(null);
  const [paying, setPaying] = useState<SavingsGoal | null>(null);
  const ideas = YEARLY_IDEAS.filter((i) => !data.goals.some((g) => g.name === i.name));
  const addIdea = (i: (typeof YEARLY_IDEAS)[number]) => {
    const due = i.month >= 0 ? nextDateForMonth(today, i.month) : addDays(today, 180);
    const months = Math.max(1, monthsUntil(today, due));
    saveGoal({ name: i.name, emoji: i.emoji, kind: 'yearly', repeats: true, target: i.amount, openingBalance: 0, targetDate: due, monthlyContribution: Math.ceil(i.amount / months), categoryId: fundCat?.id });
  };

  return (
    <section data-testid="yearly-costs">
      <div className="row between wrap" style={{ marginBottom: 12, gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 22 }}>Yearly costs</h2>
          <p className="muted small">Save a little each month so once-a-year bills never wreck a month.</p>
        </div>
        <button className="btn" onClick={() => setEditing('new')}><Plus /> Add yearly cost</button>
      </div>
      {items.length > 0 && (
        <div className="tile pastel bg-periwinkle" style={{ marginBottom: 12 }}>
          <div className="row between wrap" style={{ gap: 12 }}>
            <div>
              <div className="eyebrow">Set aside each month</div>
              <div className="big" data-testid="yearly-need">{money(need, { cents: false })}</div>
              <div className="small" style={{ opacity: 0.7 }}>{planned >= need - 0.5 ? `Your budget has ${money(planned, { cents: false })} for this ✓` : `Your budget has ${money(planned, { cents: false })} for this — ${money(need - planned, { cents: false })} short`}</div>
            </div>
            {fundCat && planned < need - 0.5 && <button className="btn primary sm" onClick={() => setAllocation(key, fundCat.id, Math.ceil(need))}>Budget {money(Math.ceil(need), { cents: false })} a month</button>}
          </div>
        </div>
      )}
      <div className="grid g-3">
        {items.map((y) => (
          <div key={y.goal.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="row" style={{ gap: 10 }}>
              <span className="avatar bg-butter" style={{ borderRadius: 14, fontSize: 20 }}>{y.goal.emoji || '🗓️'}</span>
              <div className="grow"><b>{y.goal.name}</b><div className="muted xs">{fmtDate(y.goal.targetDate)} · {y.daysUntil < 0 ? `${-y.daysUntil} days ago` : y.daysUntil === 0 ? 'today' : `in ${y.daysUntil} days`}{y.goal.repeats ? ' · every year' : ''}</div></div>
              <button className="btn ghost icon sm" aria-label={`Edit ${y.goal.name}`} onClick={() => setEditing(y.goal)}><Pencil /></button>
            </div>
            <div className="row between"><span className="display" style={{ fontSize: 22 }}>{money(y.saved, { cents: false })}</span><span className="muted small">of {money(y.goal.target, { cents: false })}</span></div>
            <div className={`bar ${y.atRisk ? 'near' : ''}`}><span style={{ width: `${y.pct}%` }} /></div>
            <div className="small">{y.remaining <= 0 ? <span className="good">Fully saved ✓</span> : <>Put away <b>{money(y.requiredMonthly, { cents: false })}</b> a month{y.atRisk && <span className="warn"> · due soon</span>}</>}</div>
            <div className="row wrap" style={{ gap: 6, marginTop: 'auto' }}>
              <button className="btn sm primary" onClick={() => onMove(y.goal, 1)}><Plus /> Set aside</button>
              <button className="btn sm" onClick={() => setPaying(y.goal)}>It's paid</button>
            </div>
          </div>
        ))}
      </div>
      {ideas.length > 0 && (
        <div className="row wrap mt-12" style={{ gap: 6 }}>
          <span className="muted small">Quick add:</span>
          {ideas.map((i) => <button key={i.name} className="chip clickable" onClick={() => addIdea(i)}>{i.emoji} {i.name}</button>)}
        </div>
      )}
      {editing && <YearlyForm initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {paying && <PayYearly goal={paying} onClose={() => setPaying(null)} />}
    </section>
  );
}

function YearlyForm({ initial, onClose }: { initial?: SavingsGoal; onClose: () => void }) {
  const data = useData();
  const today = getToday();
  const { saveGoal, deleteGoal } = useStore.getState();
  const [name, setName] = useState(initial?.name || '');
  const [emoji, setEmoji] = useState(initial?.emoji || '🗓️');
  const [amount, setAmount] = useState<number | ''>(initial?.target ?? '');
  const [due, setDue] = useState<string | undefined>(initial?.targetDate || addDays(today, 180));
  const [opening, setOpening] = useState<number | ''>(initial?.openingBalance ?? 0);
  const [repeats, setRepeats] = useState(initial?.repeats ?? true);
  const ok = name.trim() && Number(amount) > 0 && due;
  const months = due ? Math.max(1, monthsUntil(today, due)) : 1;
  const save = () => {
    if (!ok) return;
    saveGoal({ id: initial?.id, name: name.trim(), emoji, kind: 'yearly', repeats, target: Number(amount), openingBalance: Number(opening) || 0, targetDate: due!, monthlyContribution: Math.ceil(Math.max(0, Number(amount) - (Number(opening) || 0)) / months), categoryId: initial?.categoryId || data.categories.find((c) => c.id === 'sav-yearly')?.id, color: initial?.color });
    onClose();
  };
  return (
    <Modal title={initial ? 'Edit yearly cost' : 'New yearly cost'} onClose={onClose} footer={<>
      {initial && <button className="btn danger left" onClick={() => { deleteGoal(initial.id); onClose(); }}><Trash2 /> Delete</button>}
      <button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!ok} onClick={save}>Save</button>
    </>}>
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="What is it?" className="full"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Car licence disc" /></Field>
        <Field label="Amount"><MoneyInput value={amount} onChange={setAmount} ariaLabel="Yearly amount" /></Field>
        <Field label="Next due"><DateInput value={due} onChange={setDue} required /></Field>
        <Field label="Already put aside"><MoneyInput value={opening} onChange={setOpening} ariaLabel="Already saved" /></Field>
        <Field label="Icon"><input className="input" value={emoji} onChange={(e) => setEmoji(e.target.value.slice(0, 4))} /></Field>
        <label className="check full"><input type="checkbox" checked={repeats} onChange={(e) => setRepeats(e.target.checked)} /> Comes back every year</label>
        {Number(amount) > 0 && <p className="full small text-2">That's about <b>{money(Math.max(0, Number(amount) - (Number(opening) || 0)) / months)}</b> a month for {months} month{months === 1 ? '' : 's'}.</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function PayYearly({ goal, onClose }: { goal: SavingsGoal; onClose: () => void }) {
  const data = useData();
  const today = getToday();
  const payYearly = useStore((s) => s.payYearly);
  const saved = goalProgress(data, goal, today).saved;
  const guess = data.categories.find((c) => c.group !== 'savings' && goal.name.toLowerCase().split(' ').some((w) => w.length > 3 && c.name.toLowerCase().includes(w)));
  const [amount, setAmount] = useState<number | ''>(goal.target);
  const [date, setDate] = useState<string | undefined>(today);
  const [categoryId, setCategoryId] = useState(guess?.id || 'misc');
  const fromPot = Math.min(saved, Number(amount) || 0);
  return (
    <Modal title={`Pay ${goal.name}`} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" disabled={!(Number(amount) > 0) || !date} onClick={() => { payYearly(goal.id, Number(amount), date!, categoryId); onClose(); }}>Mark as paid</button></>}>
      <div className="form-grid">
        <Field label="Amount paid"><MoneyInput value={amount} onChange={setAmount} ariaLabel="Amount paid" /></Field>
        <Field label="Date"><DateInput value={date} onChange={setDate} required /></Field>
        <Field label="Show it under" className="full" help="For your transaction list and reports"><CategorySelect value={categoryId} onChange={setCategoryId} /></Field>
      </div>
      <div className="mt-12"><Banner tone={fromPot >= (Number(amount) || 0) ? 'good' : 'warn'}>
        {money(fromPot)} comes from the {money(saved)} you saved, so it won't count against this month's budget.
        {(Number(amount) || 0) > fromPot && <> The other {money((Number(amount) || 0) - fromPot)} counts as normal spending.</>}
        {goal.repeats && <> It then starts saving again for {fmtDate(nextYear(goal.targetDate))}.</>}
      </Banner></div>
    </Modal>
  );
}

function nextYear(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  d.setFullYear(d.getFullYear() + 1);
  return toISO(d);
}
