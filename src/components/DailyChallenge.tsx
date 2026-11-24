import { useEffect } from 'react';
import { Check, RefreshCw } from 'lucide-react';
import { getToday, useData, useStore } from '../data/store';
import { challengeStreak, describeChallenge, pickChallenge } from '../domain/challenges';

/** One small challenge a day, chosen to fit what's going on in your budget, kitchen and plan. */
export function DailyChallenge() {
  const data = useData();
  const today = getToday();
  const setChallenge = useStore((s) => s.setChallenge);
  const entry = data.challenges[today];

  // Pick today's challenge once and keep it for the day.
  useEffect(() => {
    if (!entry) setChallenge(today, { id: pickChallenge(data, today, 0).challenge.id, swaps: 0, done: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry, today]);

  const id = entry?.id ?? pickChallenge(data, today, 0).challenge.id;
  const text = describeChallenge(data, today, id);
  if (!text) return null;
  const done = !!entry?.done;
  const streak = challengeStreak(data, today);

  return (
    <section className="tile pastel bg-lavender challenge-card" data-testid="daily-challenge">
      <div className="challenge-text">
        <div className="challenge-eyebrow">Daily challenge{streak > 0 ? ` · 🔥 ${streak}` : ''}</div>
        <p className="challenge-main" style={{ textDecoration: done ? 'line-through' : undefined }}>{text.title}</p>
        <p className="small" style={{ opacity: 0.7, marginTop: 4 }}>{text.detail}</p>
        <div className="row mt-12" style={{ gap: 10 }}>
          <button className={`challenge-btn ${done ? 'done' : 'primary'}`} aria-pressed={done} aria-label={done ? 'Undo challenge done' : 'Mark challenge done'} title={done ? 'Undo' : 'Done'}
            onClick={() => setChallenge(today, { id, swaps: entry?.swaps ?? 0, done: !done })}>
            <Check />
          </button>
          {!done && (
            <button className="challenge-btn" aria-label="Another challenge" title="Another challenge" onClick={() => {
              const swaps = (entry?.swaps ?? 0) + 1;
              setChallenge(today, { id: pickChallenge(data, today, swaps).challenge.id, swaps, done: false });
            }}><RefreshCw /></button>
          )}
        </div>
      </div>
    </section>
  );
}
