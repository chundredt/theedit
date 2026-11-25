import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react';
import { Banner, Card, PageHeader, Progress } from '../components/ui';
import { BillList } from '../components/BudgetBits';
import { getToday, useData, useStore } from '../data/store';
import { go, useUI } from '../lib/ui-state';
import { summarize, groceryCategory } from '../domain/budget';
import { periodDays, periodKeyFor } from '../domain/period';
import { countOn, isDue } from '../domain/habits';
import { yearlyCosts } from '../domain/yearly';
import { averageOver } from '../domain/food';
import { repeatLastWeek } from '../data/food-actions';
import { groceryOverview } from '../domain/grocery';
import { addDays, daysBetween, fmtDate, money, mondayOf, toDate } from '../lib/format';

const STEPS = ['Look back', 'Money check', 'Yearly costs', 'Food & shopping', 'Move & focus'];
const FOCUS_IDEAS = ['Pack lunch 4 days', 'No takeaways this week', 'Walk after dinner', 'In bed by 22:30', 'One no-spend day', 'Hit my protein every day'];

/** The Monday of the week being planned: next week on Fri–Sun, otherwise this week. */
export function resetWeek(today: string): string {
  const dow = (toDate(today).getDay() + 6) % 7; // Mon = 0
  return dow >= 4 ? addDays(mondayOf(today), 7) : mondayOf(today);
}

export function ResetPage() {
  const data = useData();
  const today = getToday();
  const [step, setStep] = useState(0);
  const week = resetWeek(today);
  const existing = data.resets[week];
  const [focus, setFocus] = useState(existing?.focus || '');
  const [done, setDone] = useState(false);
  const { saveReset, setSchedule, contribute, toast } = useStore.getState();
  const setUIWeek = useUI((s) => s.setWeek);
  const sd = data.settings.periodStartDay;
  const key = periodKeyFor(today, sd);
  const s = useMemo(() => summarize(data, key, today), [data, key, today]);
  const g = useMemo(() => groceryOverview(data, key, today), [data, key, today]);

  // ---- Look back: the 7 days before the planned week (up to today)
  const lbStart = addDays(week, -7);
  const lbEnd = addDays(week, -1) < today ? addDays(week, -1) : today;
  const catMap = new Map(data.categories.map((c) => [c.id, c]));
  const lbTx = data.transactions.filter((t) => t.date >= lbStart && t.date <= lbEnd && catMap.get(t.categoryId)?.group !== 'savings');
  const lbSpent = lbTx.reduce((a, t) => a + t.amount, 0);
  const byCat = [...lbTx.reduce((m, t) => m.set(t.categoryId, (m.get(t.categoryId) || 0) + t.amount), new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const weeklyVariable = (s.planned.variable * 7) / periodDays(key, sd);
  const lbVariable = lbTx.filter((t) => catMap.get(t.categoryId)?.group === 'variable' && !t.fundedBy).reduce((a, t) => a + t.amount, 0);
  const gc = groceryCategory(data);
  const lbGrocery = lbTx.filter((t) => t.categoryId === gc?.id).reduce((a, t) => a + t.amount, 0);
  let due = 0, hit = 0;
  for (let d = lbStart; d <= lbEnd; d = addDays(d, 1)) for (const h of data.habits) if (isDue(h, d)) { due++; if (countOn(data, h.id, d) >= h.target) hit++; }
  const lbWorkouts = data.workoutLogs.filter((l) => l.date >= lbStart && l.date <= lbEnd).length;
  const plannedWorkouts = Object.values(data.workoutSchedule).filter(Boolean).length;

  // ---- Money check
  const weekEnd = addDays(week, 6);
  const billsThisWeek = s.bills.filter((b) => b.status !== 'paid' && b.dueDate <= weekEnd);
  const incomeOpen = s.incomeLines.filter((i) => !i.received && i.payDate && i.payDate <= weekEnd);

  // ---- Yearly
  const yearly = yearlyCosts(data, today).filter((y) => y.remaining > 0);
  const ym = today.slice(0, 7);

  // ---- Food
  const lastFood = averageOver(data.foodLog, Array.from({ length: 7 }, (_, i) => addDays(week, i - 7)));
  const daysPlanned = Array.from({ length: 7 }, (_, i) => addDays(week, i)).filter((d) => data.foodLog.some((e) => e.date === d)).length;
  const toBuy = data.shoppingList.filter((x) => !x.checked).length;

  const finish = () => {
    saveReset({ week, completedOn: today, focus: focus.trim() || undefined });
    setDone(true);
  };

  if (done) {
    return (
      <div className="stack" style={{ maxWidth: 640, margin: '0 auto', gap: 16 }}>
        <section className="card hero" style={{ padding: 28 }}>
          <div className="label small" style={{ fontWeight: 700 }}>Weekly reset done</div>
          <div className="hero-amount" style={{ fontSize: 34 }}>You're set for the week of {fmtDate(week).slice(0, 5)} ✨</div>
          {focus.trim() && <p className="mt-12" style={{ fontWeight: 700 }}>Focus: {focus.trim()}</p>}
          <div className="row wrap mt-16" style={{ gap: 8 }}>
            <button className="btn primary sm" onClick={() => go('today')}>Back to Today</button>
            <button className="btn sm" onClick={() => { setUIWeek(week); go('shopping'); }}>Open shopping list</button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <PageHeader title="Weekly reset" sub={`About 5 minutes · planning ${fmtDate(week)} – ${fmtDate(weekEnd)}`} />
      {existing && <div style={{ marginBottom: 12 }}><Banner tone="good">You already did this week's reset on {fmtDate(existing.completedOn)}. Running it again updates it.</Banner></div>}
      <div className="row" style={{ gap: 6, marginBottom: 18 }} aria-label="Steps">
        {STEPS.map((label, i) => (
          <button key={label} onClick={() => setStep(i)} className="grow" style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }} aria-current={i === step ? 'step' : undefined}>
            <div style={{ height: 6, borderRadius: 99, background: i <= step ? 'var(--ink)' : 'var(--surface-3)' }} />
            <div className="xs mt-8 hide-sm" style={{ fontWeight: i === step ? 800 : 500, color: i === step ? 'var(--text)' : 'var(--muted)' }}>{label}</div>
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className="stack" style={{ gap: 12 }}>
          <h2 style={{ fontSize: 24 }}>How last week went</h2>
          <p className="muted small" style={{ marginTop: -6 }}>{fmtDate(lbStart)} – {fmtDate(lbEnd)}</p>
          <div className="grid g-2" style={{ gap: 12 }}>
            <div className={`tile pastel ${lbVariable <= weeklyVariable ? 'bg-mint' : 'bg-coral'}`}>
              <div className="eyebrow">Day-to-day spending</div>
              <div className="big mt-8">{money(lbVariable, { cents: false })}</div>
              <div className="small" style={{ opacity: 0.75 }}>{weeklyVariable > 0 ? (lbVariable <= weeklyVariable ? `${money(weeklyVariable - lbVariable, { cents: false })} under your weekly share` : `${money(lbVariable - weeklyVariable, { cents: false })} over your weekly share`) : 'Set variable budgets to compare'}</div>
            </div>
            <div className="tile pastel bg-butter">
              <div className="eyebrow">Groceries</div>
              <div className="big mt-8">{money(lbGrocery, { cents: false })}</div>
              <div className="small" style={{ opacity: 0.75 }}>vs {money(g.weekly, { cents: false })} weekly allocation</div>
            </div>
            <div className="tile pastel bg-lavender">
              <div className="eyebrow">Habits</div>
              <div className="big mt-8">{due ? `${Math.round((hit / due) * 100)}%` : '—'}</div>
              <div className="small" style={{ opacity: 0.75 }}>{due ? `${hit} of ${due} ticked off` : 'No habits yet'}</div>
            </div>
            <div className="tile pastel bg-pink">
              <div className="eyebrow">Workouts</div>
              <div className="big mt-8">{lbWorkouts} / {plannedWorkouts}</div>
              <div className="small" style={{ opacity: 0.75 }}>{lbWorkouts >= plannedWorkouts && plannedWorkouts ? 'Every session done 💪' : lbWorkouts >= 2 ? 'Solid week' : 'A fresh start this week'}</div>
            </div>
          </div>
          {byCat.length > 0 && (
            <Card title="Where the money went">
              {byCat.map(([id, v]) => <div key={id} className="row between small" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}><span>{catMap.get(id)?.name || 'Other'}</span><b>{money(v, { cents: false })}</b></div>)}
              <div className="row between small mt-8"><span className="muted">Total spending (incl. bills)</span><b>{money(lbSpent, { cents: false })}</b></div>
            </Card>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="stack" style={{ gap: 12 }}>
          <h2 style={{ fontSize: 24 }}>Money check</h2>
          <section className="card hero">
            <div className="label small" style={{ fontWeight: 700 }}>Free to spend per day</div>
            <div className="hero-amount" style={{ fontSize: 40 }}>{money(s.perDay, { cents: false })}</div>
            <div className="muted small">{money(s.safeToSpend, { cents: false })} for the {s.daysLeft} days left in this budget month</div>
          </section>
          <Card title="Bills due by Sunday">{billsThisWeek.length ? <BillList bills={billsThisWeek} /> : <p className="muted small">Nothing due this week ✓</p>}</Card>
          {incomeOpen.length > 0 && (
            <Card title="Income not marked as received">
              {incomeOpen.map((i) => <div key={i.line.id} className="row between small" style={{ padding: '6px 0' }}><span>{i.line.name} · {fmtDate(i.payDate)}</span><b>{money(i.line.amount, { cents: false })}</b></div>)}
              <a className="small" href="#budget" style={{ fontWeight: 700 }}>Mark received in Budget</a>
            </Card>
          )}
          {s.overspent.length > 0 ? (
            <Card title="Over budget">
              {s.overspent.map((r) => <div key={r.category.id} className="row between small" style={{ padding: '6px 0' }}><span>{r.category.name}</span><b className="danger">{money(-r.remaining, { cents: false })} over</b></div>)}
              <p className="muted xs mt-8">Move money from a category with room, or go lighter on these this week.</p>
            </Card>
          ) : <Banner tone="good">No categories over budget.</Banner>}
        </div>
      )}

      {step === 2 && (
        <div className="stack" style={{ gap: 12 }}>
          <h2 style={{ fontSize: 24 }}>Yearly costs</h2>
          {yearly.length === 0 ? (
            <Card><p className="muted small">{data.goals.some((x) => x.kind === 'yearly') ? 'Everything is fully saved ✓' : 'No yearly costs set up yet.'} <a href="#savings" style={{ fontWeight: 700 }}>Manage yearly costs</a></p></Card>
          ) : yearly.map((y) => {
            const thisMonth = data.transactions.filter((t) => t.goalId === y.goal.id && t.date.startsWith(ym) && t.amount > 0).reduce((a, t) => a + t.amount, 0);
            const topUp = Math.max(0, Math.ceil(y.requiredMonthly - thisMonth));
            return (
              <div key={y.goal.id} className="card row" style={{ gap: 12 }}>
                <span className="avatar bg-butter" style={{ borderRadius: 14, fontSize: 20 }}>{y.goal.emoji || '🗓️'}</span>
                <div className="grow">
                  <b>{y.goal.name}</b>
                  <div className="muted xs">{money(y.saved, { cents: false })} of {money(y.goal.target, { cents: false })} · due {fmtDate(y.goal.targetDate)}{y.atRisk ? ' · due soon' : ''}</div>
                  <Progress value={y.saved} max={y.goal.target} size="thin" />
                </div>
                {topUp > 0 ? <button className="btn sm primary" onClick={() => { contribute(y.goal.id, topUp, today); toast(`${money(topUp, { cents: false })} set aside for ${y.goal.name}`); }}>Set aside {money(topUp, { cents: false })}</button>
                  : <span className="chip good">This month ✓</span>}
              </div>
            );
          })}
        </div>
      )}

      {step === 3 && (
        <div className="stack" style={{ gap: 12 }}>
          <h2 style={{ fontSize: 24 }}>Food & shopping</h2>
          <div className="grid g-2" style={{ gap: 12 }}>
            <div className="tile pastel bg-pink">
              <div className="eyebrow">Last week's eating</div>
              <div className="big mt-8">{lastFood.days ? `${lastFood.kcal.toLocaleString('en-ZA')} kcal` : '—'}</div>
              <div className="small" style={{ opacity: 0.75 }}>{lastFood.days ? `a day on average · ${lastFood.protein} g protein` : 'Nothing logged'}</div>
            </div>
            <div className="tile pastel bg-mint">
              <div className="eyebrow">This week</div>
              <div className="big mt-8">{daysPlanned} / 7</div>
              <div className="small" style={{ opacity: 0.75 }}>days with food planned · {toBuy} on the shopping list</div>
            </div>
          </div>
          <div className="row wrap" style={{ gap: 8 }}>
            <button className="btn primary" onClick={() => { const n = repeatLastWeek(week, today); toast(n ? `Planned ${n} foods from last week` : 'Nothing to copy into empty days'); }}><Sparkles /> Repeat last week's food</button>
            <button className="btn" onClick={() => go('meals')}>Open food log</button>
            <button className="btn" onClick={() => go('shopping')}>Open shopping list</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="stack" style={{ gap: 12 }}>
          <h2 style={{ fontSize: 24 }}>Move & focus</h2>
          <Card title="Workouts this week">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((w, i) => (
              <div key={w} className="row between" style={{ padding: '5px 0' }}>
                <b className="small" style={{ width: 60 }}>{w} {toDate(addDays(week, i)).getDate()}</b>
                <select className="input sm" style={{ maxWidth: 240 }} value={data.workoutSchedule[i] || ''} onChange={(e) => setSchedule(i, e.target.value || undefined)} aria-label={`${w} workout`}>
                  <option value="">Rest</option>
                  {data.routines.map((r) => <option key={r.id} value={r.id}>{r.emoji} {r.name}</option>)}
                </select>
              </div>
            ))}
          </Card>
          <Card title="One focus for the week">
            <input className="input" value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="What would make this week a win?" aria-label="Weekly focus" />
            <div className="row wrap mt-8" style={{ gap: 6 }}>{FOCUS_IDEAS.map((f) => <button key={f} className={`chip clickable ${focus === f ? 'on' : ''}`} onClick={() => setFocus(f)}>{f}</button>)}</div>
            <p className="muted xs mt-8">It shows on your Today screen all week.</p>
          </Card>
        </div>
      )}

      <div className="row between mt-24">
        <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}><ArrowLeft /> Back</button>
        {step < STEPS.length - 1
          ? <button className="btn primary" onClick={() => setStep(step + 1)}>Next <ArrowRight /></button>
          : <button className="btn primary" onClick={finish}><Check /> Finish reset</button>}
      </div>
      <p className="muted xs mt-12" style={{ textAlign: 'center' }}>{daysBetween(today, week) > 0 ? `Your week starts on ${fmtDate(week)}.` : 'Planning the week you’re in.'}</p>
    </div>
  );
}
