import { useEffect } from 'react';
import { Check, RefreshCw } from 'lucide-react';
import { getToday, useData, useStore } from '../data/store';
import { challengeStreak, describeChallenge, pickChallenge } from '../domain/challenges';

const AREA_LABEL = { money: 'Money', food: 'Food', body: 'Move', mind: 'Mind' };

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
        <div className="row" style={{ gap: 6 }}>
          <span className="chip" style={{ background: 'rgba(255,255,255,0.6)', color: '#111' }}>{AREA_LABEL[text.area]}</span>
          {streak > 0 && <span className="chip" style={{ background: 'rgba(255,255,255,0.6)', color: '#111' }}>🔥 {streak} day{streak === 1 ? '' : 's'}</span>}
        </div>
        <h2 className="challenge-title">Daily<br />Challenge</h2>
        <p style={{ fontWeight: 700, fontSize: 16, marginTop: 6, textDecoration: done ? 'line-through' : undefined }}>{text.title}</p>
        <p className="small" style={{ opacity: 0.72, marginTop: 2 }}>{text.detail}</p>
        <div className="row wrap mt-12" style={{ gap: 8 }}>
          <button className={`btn sm ${done ? '' : 'primary'}`} aria-pressed={done} onClick={() => setChallenge(today, { id, swaps: entry?.swaps ?? 0, done: !done })}>
            <Check /> {done ? 'Done — nice!' : 'Done'}
          </button>
          {!done && (
            <button className="btn sm" onClick={() => {
              const swaps = (entry?.swaps ?? 0) + 1;
              setChallenge(today, { id: pickChallenge(data, today, swaps).challenge.id, swaps, done: false });
            }}><RefreshCw /> Another one</button>
          )}
        </div>
      </div>
    </section>
  );
}
