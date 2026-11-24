import { useState } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import { Modal } from './ui';
import { TransactionForm } from './TransactionForm';
import { IncomeCard } from './IncomeCard';
import { getToday, useData, useStore } from '../data/store';
import { go } from '../lib/ui-state';
import { groceryCategory } from '../domain/budget';
import { defaultPeriod } from '../lib/ui-state';
import { countOn, isDue } from '../domain/habits';
import { logsOn, plannedFor } from '../domain/workouts';
import { LogForm } from '../pages/Workouts';
import { HabitForm } from '../pages/Habits';
import { PantryForm } from '../pages/Pantry';
import { ReceiptScan } from './ReceiptScan';

type View = 'menu' | 'expense' | 'grocery' | 'income' | 'habits' | 'new-habit' | 'activity' | 'pantry' | 'slip';

/** The + button: pick what to add, then go straight to that form. */
export function QuickAdd({ onClose }: { onClose: () => void }) {
  const data = useData();
  const today = getToday();
  const [view, setView] = useState<View>('menu');
  const { saveWorkoutLog, setHabitCount, toast } = useStore.getState();
  const routine = plannedFor(data, today);
  const workoutDone = logsOn(data, today).length > 0;
  const habits = data.habits.filter((h) => isDue(h, today));
  const period = defaultPeriod(today, data.settings.periodStartDay, data.budgets);

  if (view === 'expense') return <TransactionForm onClose={onClose} />;
  if (view === 'grocery') return <TransactionForm onClose={onClose} defaults={{ categoryId: groceryCategory(data)?.id }} />;
  if (view === 'activity') return <LogForm date={today} onClose={onClose} />;
  if (view === 'new-habit') return <HabitForm onClose={onClose} />;
  if (view === 'pantry') return <PantryForm onClose={onClose} />;
  if (view === 'slip') return <ReceiptScan onClose={onClose} />;
  if (view === 'income')
    return <Modal title="Income received" onClose={onClose} footer={<button className="btn primary" onClick={onClose}>Done</button>}><div className="quick-income"><IncomeCard period={period} /></div></Modal>;
  if (view === 'habits')
    return (
      <Modal title="Today's habits" onClose={onClose} footer={<><button className="btn" onClick={() => setView('new-habit')}><Plus /> New habit</button><button className="btn primary" onClick={onClose}>Done</button></>}>
        {habits.length === 0 ? <p className="muted small">No habits for today yet.</p> : habits.map((h) => {
          const c = countOn(data, h.id, today);
          const done = c >= h.target;
          return (
            <div key={h.id} className="check-row" style={{ borderColor: 'var(--border)' }}>
              <span className={`avatar bg-${h.color}`} style={{ borderRadius: 14, fontSize: 18 }}>{h.emoji}</span>
              <div className="grow"><b>{h.name}</b>{h.target > 1 && <div className="xs muted">{c} of {h.target} {h.unit || ''}</div>}</div>
              {h.target > 1 && (
                <>
                  <button className="btn icon sm ghost" aria-label={`One less ${h.name}`} disabled={c === 0} onClick={() => setHabitCount(today, h.id, c - 1)}><Minus /></button>
                  <button className="btn icon sm" aria-label={`One more ${h.name}`} onClick={() => setHabitCount(today, h.id, Math.min(h.target * 3, c + 1))}><Plus /></button>
                </>
              )}
              <button className={`round-check ${done ? 'on' : ''}`} aria-pressed={done} aria-label={`${done ? 'Undo' : 'Complete'} ${h.name}`} onClick={() => setHabitCount(today, h.id, done ? 0 : h.target)}>{done && <Check />}</button>
            </div>
          );
        })}
      </Modal>
    );

  const tiles: { label: string; sub?: string; emoji: string; color: string; onClick: () => void }[] = [
    { label: 'Expense', emoji: '🧾', color: 'lavender', onClick: () => setView('expense') },
    { label: 'Grocery shop', emoji: '🛒', color: 'mint', onClick: () => setView('grocery') },
    { label: 'Scan till slip', sub: 'Updates your prices', emoji: '📸', color: 'sky', onClick: () => setView('slip') },
    { label: 'Income in', sub: 'Tick salary, commission…', emoji: '💰', color: 'butter', onClick: () => setView('income') },
    { label: 'Log activity', sub: 'Walk, class, sport…', emoji: '👟', color: 'periwinkle', onClick: () => setView('activity') },
    { label: 'Tick habits', sub: habits.length ? `${habits.filter((h) => countOn(data, h.id, today) >= h.target).length} of ${habits.length} done` : 'Add your first', emoji: '✅', color: 'pink', onClick: () => setView(habits.length ? 'habits' : 'new-habit') },
    { label: 'Pantry item', emoji: '🥫', color: 'butter', onClick: () => setView('pantry') },
    { label: 'Plan a meal', emoji: '🍳', color: 'periwinkle', onClick: () => { onClose(); go('meals'); } },
    { label: 'Save money', sub: 'Goals & yearly costs', emoji: '🐷', color: 'mint', onClick: () => { onClose(); go('savings'); } },
  ];
  if (routine && !workoutDone) tiles.splice(3, 0, { label: 'Workout done', sub: routine.name, emoji: routine.emoji, color: 'coral', onClick: () => { saveWorkoutLog({ date: today, routineId: routine.id, name: routine.name, kind: routine.kind, minutes: routine.minutes, done: routine.exercises.map((_, i) => i), effort: 2 }); toast(`${routine.name} done 💪`); onClose(); } });
  // Keep the grid even so no tile sits alone on the last row.
  if (tiles.length % 2) tiles.push({ label: 'Shopping list', sub: 'This week', emoji: '📝', color: 'butter', onClick: () => { onClose(); go('shopping'); } });

  return (
    <Modal title="Add" onClose={onClose}>
      <div className="quick-grid">
        {tiles.map((t) => (
          <button key={t.label} className={`quick-tile pastel bg-${t.color}`} onClick={t.onClick}>
            <span className="quick-emoji" aria-hidden>{t.emoji}</span>
            <b>{t.label}</b>
            {t.sub && <span className="xs" style={{ opacity: 0.7 }}>{t.sub}</span>}
          </button>
        ))}
      </div>
    </Modal>
  );
}
