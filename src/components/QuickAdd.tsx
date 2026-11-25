import { useState } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import { Modal } from './ui';
import { TransactionForm } from './TransactionForm';
import { getToday, useData, useStore } from '../data/store';
import { go } from '../lib/ui-state';
import { countOn, isDue, isCounter, amountLabel, bump } from '../domain/habits';
import { HabitForm } from '../pages/Habits';
import { ReceiptScan } from './ReceiptScan';

type View = 'menu' | 'expense' | 'habits' | 'new-habit' | 'slip';

/** The + button: pick what to add, then go straight to that form. */
export function QuickAdd({ onClose }: { onClose: () => void }) {
  const data = useData();
  const today = getToday();
  const [view, setView] = useState<View>('menu');
  const { setHabitCount, toast } = useStore.getState();
  const habits = data.habits.filter((h) => isDue(h, today));

  if (view === 'expense') return <TransactionForm onClose={onClose} />;
  if (view === 'new-habit') return <HabitForm onClose={onClose} />;
  if (view === 'slip') return <ReceiptScan onClose={onClose} />;
  if (view === 'habits')
    return (
      <Modal title="Today's habits" onClose={onClose} footer={<><button className="btn" onClick={() => setView('new-habit')}><Plus /> New habit</button><button className="btn primary" onClick={onClose}>Done</button></>}>
        {habits.length === 0 ? <p className="muted small">No habits for today yet.</p> : habits.map((h) => {
          const c = countOn(data, h.id, today);
          const done = c >= h.target;
          return (
            <div key={h.id} className="check-row" style={{ borderColor: 'var(--border)' }}>
              <span className={`avatar bg-${h.color}`} style={{ borderRadius: 14, fontSize: 18 }}>{h.emoji}</span>
              <div className="grow"><b>{h.name}</b>{isCounter(h) && <div className="xs muted">{amountLabel(h, c)}</div>}</div>
              {isCounter(h) && (
                <>
                  <button className="btn icon sm ghost" aria-label={`Less ${h.name}`} disabled={c === 0} onClick={() => setHabitCount(today, h.id, bump(h, c, -1))}><Minus /></button>
                  <button className="btn icon sm" aria-label={`More ${h.name}`} onClick={() => setHabitCount(today, h.id, bump(h, c, 1))}><Plus /></button>
                </>
              )}
              <button className={`round-check ${done ? 'on' : ''}`} aria-pressed={done} aria-label={`${done ? 'Undo' : 'Complete'} ${h.name}`} onClick={() => setHabitCount(today, h.id, done ? 0 : h.target)}>{done && <Check />}</button>
            </div>
          );
        })}
      </Modal>
    );

  // The four things added most. Everything else lives on its own tab.
  const water = data.habits.find((h) => h.unit === 'L' || /water/i.test(h.name));
  const litres = water ? countOn(data, water.id, today) : 0;
  const tiles: { label: string; sub?: string; emoji: string; color: string; onClick: () => void }[] = [
    { label: 'Expense', emoji: '🧾', color: 'lavender', onClick: () => setView('expense') },
    { label: 'Till slip', sub: 'Snap it, done', emoji: '📸', color: 'sky', onClick: () => setView('slip') },
    water
      ? { label: 'Water', sub: amountLabel(water, litres), emoji: '💧', color: 'mint', onClick: () => { const n = bump(water, litres, 1); setHabitCount(today, water.id, n); toast(`💧 ${amountLabel(water, n)}`); onClose(); } }
      : { label: 'Tick habits', emoji: '✅', color: 'mint', onClick: () => setView(habits.length ? 'habits' : 'new-habit') },
    { label: "Today's meals", emoji: '🍳', color: 'butter', onClick: () => { onClose(); go('meals'); } },
  ];

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
