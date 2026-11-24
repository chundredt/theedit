import { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import { DayStrip } from '../components/DayStrip';
import { DailyChallenge } from '../components/DailyChallenge';
import { resetWeek } from './Reset';
import { Progress, Ring } from '../components/ui';
import { getToday, useData, useStore } from '../data/store';
import { go, useUI } from '../lib/ui-state';
import { summarize, transactionsIn } from '../domain/budget';
import { groceryOverview } from '../domain/grocery';
import { periodKeyFor, periodLabel, shiftPeriod, daysLeft } from '../domain/period';
import { planTotals } from '../domain/shopping';
import { recipeStats } from '../domain/recipes';
import { countOn, dayScore, isDone, isDue, streak, weekdayIndex, isCounter, amountLabel, bump } from '../domain/habits';
import { logsOn, plannedFor } from '../domain/workouts';
import { addDays, daysBetween, fmtDate, mondayOf, money, monthName, toDate } from '../lib/format';
import { exportBackup } from '../lib/exports';
import { MEAL_TYPES, type MealType } from '../domain/types';

const MEAL_LABEL: Record<MealType, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' };

function mealNow(): MealType {
  const h = new Date().getHours();
  return h < 10 ? 'breakfast' : h < 15 ? 'lunch' : h < 20 ? 'dinner' : 'snack';
}

export function TodayPage() {
  const data = useData();
  const today = getToday();
  const [day, setDay] = useState(today);
  const [meal, setMeal] = useState<MealType | null>(null);
  const setAddOpen = useUI((s) => s.setAddOpen);
  const { setHabitCount, saveWorkoutLog } = useStore.getState();
  const sd = data.settings.periodStartDay;
  const key = periodKeyFor(today, sd);
  const s = useMemo(() => summarize(data, key, today), [data, key, today]);
  const g = useMemo(() => groceryOverview(data, key, today), [data, key, today]);
  const spentToday = transactionsIn(data, key).filter((t) => t.date === today && data.categories.find((c) => c.id === t.categoryId)?.group !== 'savings').reduce((a, t) => a + t.amount, 0);
  const week = mondayOf(day);
  const plan = data.mealPlans[week];
  const totals = useMemo(() => planTotals(data, plan, today), [data, plan, today]);
  const dayIdx = weekdayIndex(day);
  const dayTotals = totals.days[dayIdx];
  // Open on the current meal, or the first one that's planned if that slot is empty.
  const now = mealNow();
  const shownMeal: MealType = meal ?? (plan?.days[dayIdx]?.[now] ? now : MEAL_TYPES.find((m) => plan?.days[dayIdx]?.[m]) || now);
  const slot = plan?.days[dayIdx]?.[shownMeal];
  const recipe = slot && data.recipes.find((r) => r.id === slot.recipeId);
  const stats = recipe ? recipeStats(recipe, data, today) : null;
  const habits = data.habits.filter((h) => isDue(h, day));
  const habitsDone = habits.filter((h) => isDone(data, h, day)).length;
  const routine = plannedFor(data, day);
  const logs = logsOn(data, day);
  const nextBill = s.bills.find((b) => b.status !== 'paid');
  const paydayIn = daysLeft(key, sd, today);
  const d = toDate(day);
  const isFuture = day > today;

  return (
    <div className="stack" style={{ gap: 18, maxWidth: 1100 }}>
      <div className="row between">
        <div className="row" style={{ gap: 12 }}>
          <span className="avatar" style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--butter)', color: '#111', fontSize: 18 }}>{(data.settings.name || 'You').slice(0, 1).toUpperCase()}</span>
          <div>
            <h1 style={{ fontSize: 26 }}>Hey{data.settings.name ? `, ${data.settings.name}` : ''}</h1>
            <p className="muted small">{day === today ? 'Today' : fmtDate(day)}, {d.getDate()} {monthName(d.getMonth())}</p>
          </div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn icon ghost" aria-label="Previous week" onClick={() => setDay(addDays(day, -7))}><ChevronLeft /></button>
          {day !== today && <button className="btn sm" onClick={() => setDay(today)}>Today</button>}
          <button className="btn icon ghost" aria-label="Next week" onClick={() => setDay(addDays(day, 7))}><ChevronRight /></button>
        </div>
      </div>

      <DailyChallenge />
      {data.transactions.length >= 5 && (!data.settings.lastBackupOn || daysBetween(data.settings.lastBackupOn, today) > 30) && (
        <button className="tile row" style={{ gap: 12, padding: '12px 16px', border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', textAlign: 'left', color: 'var(--text)' }}
          onClick={() => exportBackup(data)} data-testid="backup-nudge">
          <span style={{ fontSize: 20 }}>💾</span>
          <span className="grow"><b>Back up your data</b><span className="xs muted" style={{ display: 'block' }}>{data.settings.lastBackupOn ? `Last backup ${fmtDate(data.settings.lastBackupOn)}` : 'Save a copy to Files or iCloud Drive — takes a second'}</span></span>
        </button>
      )}

      {(() => {
        const dow = weekdayIndex(today);
        const current = data.resets[mondayOf(today)];
        const upcoming = resetWeek(today);
        const needsReset = !data.resets[upcoming] && (dow >= 4 || dow === 0);
        return (
          <>
            {current?.focus && (
              <div className="tile pastel bg-butter row" style={{ gap: 12, padding: '14px 18px' }} data-testid="week-focus">
                <span style={{ fontSize: 22 }}>🎯</span><div className="grow"><div className="eyebrow">This week's focus</div><b>{current.focus}</b></div>
              </div>
            )}
            {needsReset && (
              <a className="tile pastel bg-coral row" href="#reset" style={{ gap: 12, padding: '14px 18px', textDecoration: 'none' }} data-testid="reset-prompt">
                <span style={{ fontSize: 22 }}>🔁</span><div className="grow"><div className="eyebrow">5 minutes</div><b>{dow === 0 ? 'Do your weekly reset' : 'Plan next week'}</b></div><span className="btn sm">Start</span>
              </a>
            )}
          </>
        );
      })()}

      <DayStrip value={day} onChange={setDay} today={today} mark={(x) => (dayScore(data, x) ?? 0) >= 1} />

      <div className="grid g-main" style={{ alignItems: 'start' }}>
        <div className="stack" style={{ gap: 16 }}>
          {/* Money */}
          <section className="card hero money-today" data-testid="today-money">
            <div className="label small" style={{ fontWeight: 700 }}>You can spend today</div>
            <div className="hero-amount num" style={{ fontSize: 46 }}>{money(s.perDay, { cents: false })}</div>
            <div className="muted small">{money(s.safeToSpend, { cents: false })} safe to spend over {s.daysLeft} day{s.daysLeft === 1 ? '' : 's'} · {money(spentToday, { cents: false })} spent today</div>
            <div className="mt-12"><Progress value={s.spent + s.saved} max={s.income || 1} size="thin" /></div>
            <div className="row wrap mt-16" style={{ gap: 8 }}>
              <button className="btn primary sm" onClick={() => setAddOpen(true)}><Plus /> Add expense</button>
              <button className="btn sm" onClick={() => go('dashboard')}>Money overview</button>
            </div>
            {sd > 1 && paydayIn <= 5 && <p className="small mt-12" style={{ fontWeight: 700 }}>Payday {paydayIn <= 1 ? 'is tomorrow' : `in ${paydayIn} days`} — <a href="#budget" style={{ color: '#111' }}>plan {periodLabel(shiftPeriod(key, 1))}</a></p>}
          </section>

          {/* Meals */}
          <section className="card">
            <div className="row between" style={{ marginBottom: 12 }}>
              <h2>Meals</h2>
              <a className="small" href="#meals" style={{ fontWeight: 700 }}>Planner</a>
            </div>
            <div className="tile bg-pink pastel" style={{ display: 'flex', alignItems: 'center', gap: 18, padding: 16 }}>
              {[['Protein', dayTotals?.protein], ['Carbs', dayTotals?.carbs], ['Fat', dayTotals?.fat]].map(([l, v]) => (
                <div key={l as string}><div style={{ fontSize: 22, fontWeight: 800 }}>{Math.round((v as number) || 0)}</div><div className="small" style={{ opacity: 0.7 }}>{l} g</div></div>
              ))}
              <div style={{ marginLeft: 'auto' }}>
                <Ring pct={((dayTotals?.kcal || 0) / data.settings.kcalTarget) * 100} size={78} stroke={7} color="var(--sage-strong)">
                  <span style={{ fontSize: 14, color: '#111' }}>{Math.round(dayTotals?.kcal || 0)}<br /><span style={{ fontSize: 10, fontWeight: 600 }}>kcal</span></span>
                </Ring>
              </div>
            </div>
            <div className="meal-tabs mt-12" role="tablist">
              {MEAL_TYPES.map((m) => <button key={m} role="tab" aria-selected={shownMeal === m} className={shownMeal === m ? 'on' : ''} onClick={() => setMeal(m)}>{MEAL_LABEL[m]}</button>)}
            </div>
            {recipe && stats ? (
              <div className="row mt-12" style={{ gap: 14, padding: 14, border: '1px solid var(--border)', borderRadius: 20 }}>
                <span style={{ fontSize: 34 }}>{recipe.emoji}</span>
                <div className="grow">
                  <b>{recipe.name}</b>
                  <div className="muted small">🔥 {stats.kcal} kcal · {money(stats.costPerServing)} · {recipe.prepMinutes} min</div>
                  <div className="row mt-8" style={{ gap: 16 }}>
                    {[['Protein', stats.protein, 'var(--sage-strong)'], ['Fat', stats.fat, 'var(--butter)'], ['Carbs', stats.carbs, 'var(--pink)']].map(([l, v, c]) => (
                      <div key={l as string} style={{ borderLeft: `3px solid ${c}`, paddingLeft: 8 }}><b className="small">{Math.round(v as number)} g</b><div className="xs muted">{l}</div></div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-12 muted small" style={{ padding: 14, border: '1px dashed var(--border-strong)', borderRadius: 20 }}>
                Nothing planned for {MEAL_LABEL[shownMeal].toLowerCase()}. <a href="#meals" style={{ fontWeight: 700 }}>Plan it</a>
              </div>
            )}
          </section>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          {/* Workout */}
          <section className={`tile pastel bg-${routine?.color || 'coral'}`} data-testid="today-workout">
            <div className="eyebrow">{routine ? `${routine.kind[0].toUpperCase()}${routine.kind.slice(1)} · ${routine.minutes} min` : 'Workout'}</div>
            <h3 className="mt-8" style={{ fontSize: 22 }}>{logs.length ? logs.map((l) => l.name).join(' + ') : routine ? routine.name : 'Rest day'}</h3>
            <p className="small mt-8" style={{ opacity: 0.75 }}>
              {logs.length ? `Done · ${logs.reduce((a, l) => a + l.minutes, 0)} minutes` : routine ? `${routine.exercises.length} exercise${routine.exercises.length === 1 ? '' : 's'}: ${routine.exercises.slice(0, 3).map((e) => e.name).join(', ')}${routine.exercises.length > 3 ? '…' : ''}` : 'Recovery counts. A walk or a stretch is a bonus.'}
            </p>
            <div className="row wrap mt-16" style={{ gap: 8 }}>
              {!logs.length && routine && !isFuture && (
                <button className="btn primary sm" onClick={() => saveWorkoutLog({ date: day, routineId: routine.id, name: routine.name, kind: routine.kind, minutes: routine.minutes, done: routine.exercises.map((_, i) => i), effort: 2 })}><Check /> Mark done</button>
              )}
              <button className="btn sm" onClick={() => go('workouts')}>{logs.length ? 'View' : 'Open workout'}</button>
            </div>
          </section>

          {/* Habits */}
          <section className="card" data-testid="today-habits">
            <div className="row between" style={{ marginBottom: 6 }}>
              <h2>Habits</h2>
              <span className="chip">{habitsDone}/{habits.length}</span>
            </div>
            {habits.length === 0 ? (
              <p className="muted small">No habits for this day yet. <a href="#habits" style={{ fontWeight: 700 }}>Add a habit</a></p>
            ) : habits.map((h) => {
              const c = countOn(data, h.id, day);
              const done = c >= h.target;
              const st = streak(data, h, today);
              return (
                <div key={h.id} className="check-row" style={{ borderColor: 'var(--border)' }}>
                  <span className={`avatar bg-${h.color}`} style={{ borderRadius: 14, fontSize: 18 }}>{h.emoji}</span>
                  <div className="grow">
                    <div style={{ fontWeight: 700, textDecoration: done ? 'line-through' : undefined, opacity: done ? 0.6 : 1 }}>{h.name}</div>
                    <div className="xs muted">{isCounter(h) ? amountLabel(h, c) : st > 1 ? `🔥 ${st}-day streak` : ' '}</div>
                  </div>
                  {isCounter(h) && (
                    <>
                      <button className="btn icon sm ghost" aria-label={`Less ${h.name}`} disabled={c === 0 || isFuture} onClick={() => setHabitCount(day, h.id, bump(h, c, -1))}><Minus /></button>
                      <button className="btn icon sm" aria-label={`More ${h.name}`} disabled={isFuture} onClick={() => setHabitCount(day, h.id, bump(h, c, 1))}><Plus /></button>
                    </>
                  )}
                  <button className={`round-check ${done ? 'on' : ''}`} aria-label={`${done ? 'Undo' : 'Complete'} ${h.name}`} aria-pressed={done} disabled={isFuture}
                    onClick={() => setHabitCount(day, h.id, done ? 0 : h.target)}>{done && <Check />}</button>
                </div>
              );
            })}
          </section>

          <div className="grid g-2" style={{ gap: 12 }}>
            <a className="tile pastel bg-mint" href="#groceries" style={{ textDecoration: 'none' }}>
              <div className="eyebrow">Groceries this week</div>
              <div className="big mt-8">{money(Math.max(0, g.thisWeekAllowance - g.thisWeekSpent), { cents: false })}</div>
              <div className="small" style={{ opacity: 0.7 }}>left of {money(g.thisWeekAllowance, { cents: false })}</div>
            </a>
            <a className="tile pastel bg-periwinkle" href="#budget" style={{ textDecoration: 'none' }}>
              <div className="eyebrow">Next payment</div>
              {nextBill ? (
                <>
                  <div className="big mt-8">{money(nextBill.outstanding, { cents: false })}</div>
                  <div className="small" style={{ opacity: 0.7 }}>{nextBill.category.name} · {fmtDate(nextBill.dueDate).slice(0, 5)}</div>
                </>
              ) : <div className="small mt-8" style={{ fontWeight: 700 }}>All bills paid ✓</div>}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
