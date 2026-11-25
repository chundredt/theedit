import { useMemo, useState } from 'react';
import { Check, ChevronRight, Minus, Plus } from 'lucide-react';
import { DailyChallenge } from '../components/DailyChallenge';
import { resetWeek } from './Reset';
import { getToday, useData, useStore } from '../data/store';
import { useUI } from '../lib/ui-state';
import { summarize } from '../domain/budget';
import { periodKeyFor, periodLabel, shiftPeriod, daysLeft } from '../domain/period';
import { dayTotals, entriesFor } from '../domain/food';
import { LogFood, MEAL_LABEL } from '../components/LogFood';
import { Progress } from '../components/ui';
import { countOn, isDone, isDue, streak, weekdayIndex, isCounter, amountLabel, bump } from '../domain/habits';
import { logsOn, plannedFor } from '../domain/workouts';
import { daysBetween, mondayOf, money, monthName, toDate } from '../lib/format';
import { exportBackup } from '../lib/exports';
import { MEAL_TYPES, type MealType } from '../domain/types';


export function TodayPage() {
  const data = useData();
  const today = getToday();
  const setAddOpen = useUI((s) => s.setAddOpen);
  const { setHabitCount, saveWorkoutLog } = useStore.getState();
  const sd = data.settings.periodStartDay;
  const key = periodKeyFor(today, sd);
  const s = useMemo(() => summarize(data, key, today), [data, key, today]);
  const food = dayTotals(data.foodLog, today);
  const kcalTarget = data.settings.kcalTarget || 2000;
  const [logging, setLogging] = useState<MealType | null>(null);
  const habits = data.habits.filter((h) => isDue(h, today));
  const routine = plannedFor(data, today);
  const logs = logsOn(data, today);
  const workoutDone = logs.length > 0;
  const paydayIn = daysLeft(key, sd, today);
  const d = toDate(today);
  const todo = habits.filter((h) => !isDone(data, h, today)).length + (routine && !workoutDone ? 1 : 0);
  const total = habits.length + (routine ? 1 : 0);

  // At most one nudge at a time, most useful first.
  const dow = weekdayIndex(today);
  const focus = data.resets[mondayOf(today)]?.focus;
  const needsReset = !data.resets[resetWeek(today)] && (dow >= 4 || dow === 0);
  const needsBackup = data.transactions.length >= 5 && (!data.settings.lastBackupOn || daysBetween(data.settings.lastBackupOn, today) > 30);
  const dueIncome = s.incomeLines.filter((i) => !i.received && i.payDate && i.payDate <= today && (i.line.amount || 0) > 0);
  const nudge = dueIncome.length
    ? { emoji: '💰', text: `${dueIncome[0].line.name} in? Tick it off`, href: '#budget', id: 'income-nudge' }
    : sd > 1 && paydayIn <= 5
    ? { emoji: '💰', text: paydayIn <= 1 ? `Payday tomorrow — plan ${periodLabel(shiftPeriod(key, 1))}` : `Payday in ${paydayIn} days — plan ${periodLabel(shiftPeriod(key, 1))}`, href: '#budget', id: 'payday' }
    : needsReset ? { emoji: '🔁', text: dow === 0 ? 'Do your weekly reset' : 'Plan next week (5 min)', href: '#reset', id: 'reset-prompt' }
    : needsBackup ? { emoji: '💾', text: 'Back up your data', onClick: () => exportBackup(data), id: 'backup-nudge' }
    : null;

  return (
    <div className="stack today" style={{ gap: 16, maxWidth: 640 }}>
      <div>
        <h1>Hey{data.settings.name ? `, ${data.settings.name}` : ''}</h1>
        <p className="muted">{d.getDate()} {monthName(d.getMonth())}{focus ? <> · <span data-testid="week-focus">🎯 {focus}</span></> : null}</p>
      </div>

      {nudge && (nudge.href
        ? <a className="nudge" href={nudge.href} data-testid={nudge.id}><span aria-hidden>{nudge.emoji}</span><b className="grow">{nudge.text}</b><ChevronRight /></a>
        : <button className="nudge" onClick={nudge.onClick} data-testid={nudge.id}><span aria-hidden>{nudge.emoji}</span><b className="grow">{nudge.text}</b><ChevronRight /></button>)}

      {/* 1. How much can I spend today? */}
      <section className="card hero money-today" data-testid="today-money">
        <div className="label">Free to spend today</div>
        <div className="hero-amount num">{money(s.perDay, { cents: false })}</div>
        <div className="hero-line">{money(s.safeToSpend, { cents: false })} left · {s.daysLeft} day{s.daysLeft === 1 ? '' : 's'} to payday</div>
        <button className="btn primary mt-16" onClick={() => setAddOpen(true)}><Plus /> Add expense</button>
      </section>

      {/* 2. What am I eating? */}
      <section className="card" data-testid="today-meals">
        <a className="card-link" href="#meals"><h2>Food</h2><ChevronRight /></a>
        <p className="food-big"><b>{Math.round(food.kcal).toLocaleString('en-ZA')}</b> <span className="muted">of {kcalTarget.toLocaleString('en-ZA')} kcal · {Math.round(food.protein)} g protein</span></p>
        <Progress value={food.kcal} max={kcalTarget} size="thin" status={food.kcal > kcalTarget * 1.05 ? 'over' : undefined} />
        <div className="simple-list mt-8">
          {MEAL_TYPES.map((m) => {
            const items = entriesFor(data.foodLog, today, m);
            const planned = items.length > 0 && items.every((e) => !e.eaten);
            return (
              <button key={m} className="simple-row" onClick={() => setLogging(m)} aria-label={`Log ${MEAL_LABEL[m].toLowerCase()}`}>
                <span className="when">{MEAL_LABEL[m]}</span>
                {items.length ? <span className={`what ${planned ? 'muted' : ''}`}>{items.map((e) => e.name).join(', ')}</span> : <span className="what muted">+ Add</span>}
                {items.length > 0 && <span className="muted small nowrap" style={{ marginLeft: 'auto' }}>{planned ? 'planned' : `${items.filter((e) => e.eaten).reduce((a, e) => a + e.kcal, 0)} kcal`}</span>}
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. What's left to tick off? */}
      <section className="card" data-testid="today-habits">
        <div className="row between" style={{ marginBottom: 4 }}>
          <h2>To do</h2>
          <span className="count">{total ? (todo ? `${todo} left` : 'All done ✓') : ''}</span>
        </div>
        {routine && (
          <div className="check-row" data-testid="today-workout">
            <span className={`avatar bg-${routine.color}`} style={{ borderRadius: 14, fontSize: 18 }}>{routine.emoji}</span>
            <a className="grow" href="#workouts" style={{ color: 'inherit', textDecoration: 'none' }}>
              <div style={{ fontWeight: 700, textDecoration: workoutDone ? 'line-through' : undefined, opacity: workoutDone ? 0.6 : 1 }}>{routine.name}</div>
              <div className="xs muted">{workoutDone ? `Done · ${logs.reduce((a, l) => a + l.minutes, 0)} minutes` : `${routine.minutes} min workout`}</div>
            </a>
            {!workoutDone
              ? <button className="round-check" aria-label="Mark done" onClick={() => saveWorkoutLog({ date: today, routineId: routine.id, name: routine.name, kind: routine.kind, minutes: routine.minutes, done: routine.exercises.map((_, i) => i), effort: 2 })} />
              : <span className="round-check on" aria-hidden><Check /></span>}
          </div>
        )}
        {habits.map((h) => {
          const c = countOn(data, h.id, today);
          const done = c >= h.target;
          const st = streak(data, h, today);
          return (
            <div key={h.id} className="check-row">
              <span className={`avatar bg-${h.color}`} style={{ borderRadius: 14, fontSize: 18 }}>{h.emoji}</span>
              <div className="grow">
                <div style={{ fontWeight: 700, textDecoration: done ? 'line-through' : undefined, opacity: done ? 0.6 : 1 }}>{h.name}</div>
                {(isCounter(h) || st > 1) && <div className="xs muted">{isCounter(h) ? amountLabel(h, c) : `🔥 ${st} days`}</div>}
              </div>
              {isCounter(h) && !done && <button className="btn icon sm" aria-label={`More ${h.name}`} onClick={() => setHabitCount(today, h.id, bump(h, c, 1))}><Plus /></button>}
              {isCounter(h) && done && <button className="btn icon sm ghost" aria-label={`Less ${h.name}`} onClick={() => setHabitCount(today, h.id, bump(h, c, -1))}><Minus /></button>}
              <button className={`round-check ${done ? 'on' : ''}`} aria-label={`${done ? 'Undo' : 'Complete'} ${h.name}`} aria-pressed={done}
                onClick={() => setHabitCount(today, h.id, done ? 0 : h.target)}>{done && <Check />}</button>
            </div>
          );
        })}
        {total === 0 && <p className="muted small">Nothing to tick off. <a href="#habits" style={{ fontWeight: 700 }}>Add a habit</a></p>}
      </section>

      <DailyChallenge />
      {logging && <LogFood meal={logging} onClose={() => setLogging(null)} />}
    </div>
  );
}
