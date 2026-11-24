import { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import { Card, Field, Modal, PageHeader } from '../components/ui';
import { DayStrip } from '../components/DayStrip';
import { getToday, useData, useStore } from '../data/store';
import { bestStreak, completionRate, countOn, dayScore, isDone, isDue, streak } from '../domain/habits';
import { HABIT_IDEAS } from '../data/seed-wellness';
import { PASTELS, type Habit, type PastelColor } from '../domain/types';
import { monthName, toISO } from '../lib/format';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function HabitsPage() {
  const data = useData();
  const today = getToday();
  const [day, setDay] = useState(today);
  const [editing, setEditing] = useState<Habit | 'new' | null>(null);
  const { setHabitCount, saveHabit } = useStore.getState();
  const due = data.habits.filter((h) => isDue(h, day));
  const other = data.habits.filter((h) => !h.archived && !isDue(h, day));
  const ideas = HABIT_IDEAS.filter((i) => !data.habits.some((h) => h.name === i.name));
  const future = day > today;

  return (
    <>
      <PageHeader title="Habits" sub="Small things, done most days.">
        <button className="btn primary" onClick={() => setEditing('new')}><Plus /> New habit</button>
      </PageHeader>
      <DayStrip value={day} onChange={setDay} today={today} mark={(x) => (dayScore(data, x) ?? 0) >= 1} />

      <div className="grid g-main mt-16" style={{ alignItems: 'start' }}>
        <div className="stack" style={{ gap: 10 }}>
          {due.length === 0 && <Card><p className="muted small">{data.habits.length ? 'Nothing scheduled for this day.' : 'Add your first habit — or pick one of the ideas.'}</p></Card>}
          {due.map((h) => {
            const c = countOn(data, h.id, day);
            const done = isDone(data, h, day);
            const st = streak(data, h, today);
            return (
              <div key={h.id} className={`tile pastel bg-${h.color}`} style={{ padding: '14px 16px' }}>
                <div className="row" style={{ gap: 12 }}>
                  <span style={{ fontSize: 26 }}>{h.emoji}</span>
                  <div className="grow">
                    <b style={{ fontSize: 16 }}>{h.name}</b>
                    <div className="small" style={{ opacity: 0.7 }}>{h.target > 1 ? `${c} of ${h.target} ${h.unit || ''}` : done ? 'Done' : 'Not yet'}{st > 0 ? ` · 🔥 ${st} day${st === 1 ? '' : 's'}` : ''}</div>
                  </div>
                  {h.target > 1 && (
                    <>
                      <button className="btn icon sm" aria-label={`One less ${h.name}`} disabled={c === 0 || future} onClick={() => setHabitCount(day, h.id, c - 1)}><Minus /></button>
                      <button className="btn icon sm" aria-label={`One more ${h.name}`} disabled={future} onClick={() => setHabitCount(day, h.id, Math.min(h.target * 3, c + 1))}><Plus /></button>
                    </>
                  )}
                  <button className={`round-check ${done ? 'on' : ''}`} style={done ? { background: '#111', borderColor: '#111', color: '#fff' } : undefined} aria-label={`${done ? 'Undo' : 'Complete'} ${h.name}`} aria-pressed={done} disabled={future}
                    onClick={() => setHabitCount(day, h.id, done ? 0 : h.target)}>{done && <Check />}</button>
                </div>
                {h.target > 1 && <div className="bar thin mt-12"><span style={{ width: `${Math.min(100, (c / h.target) * 100)}%` }} /></div>}
              </div>
            );
          })}
          {other.length > 0 && <p className="muted xs">Not scheduled today: {other.map((h) => h.name).join(', ')}</p>}
          {ideas.length > 0 && (
            <Card title="Ideas">
              <div className="row wrap" style={{ gap: 6 }}>
                {ideas.map((i) => <button key={i.name} className="chip clickable" onClick={() => saveHabit(i)}>{i.emoji} {i.name}</button>)}
              </div>
              <p className="muted xs mt-8">Tap to add. You can change the days and target afterwards.</p>
            </Card>
          )}
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <HabitCalendar />
          <Card title="Your habits">
            {data.habits.length === 0 ? <p className="muted small">None yet.</p> : data.habits.map((h) => (
              <div key={h.id} className="list-item">
                <span className={`avatar bg-${h.color}`} style={{ borderRadius: 12, fontSize: 18 }}>{h.emoji}</span>
                <div className="grow">
                  <div className="title">{h.name}</div>
                  <div className="meta">{h.days.length ? h.days.map((d) => WEEKDAYS[d]).join(', ') : 'Every day'} · {Math.round(completionRate(data, h, today) * 100)}% last 30 days · best {bestStreak(data, h, today)}</div>
                </div>
                <button className="btn ghost icon sm" aria-label={`Edit ${h.name}`} onClick={() => setEditing(h)}><Pencil /></button>
              </div>
            ))}
          </Card>
        </div>
      </div>
      {editing && <HabitForm initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function HabitCalendar() {
  const data = useData();
  const today = getToday();
  const [month, setMonth] = useState(() => { const d = new Date(today + 'T00:00:00'); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const first = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => toISO(new Date(month.getFullYear(), month.getMonth(), i + 1)))];
  return (
    <Card title="Consistency" action={
      <span className="row" style={{ gap: 4 }}>
        <button className="btn ghost icon sm" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft /></button>
        <b className="small" style={{ minWidth: 92, textAlign: 'center' }}>{monthName(month.getMonth())}</b>
        <button className="btn ghost icon sm" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight /></button>
      </span>}>
      <div className="cal">
        {WEEKDAYS.map((w) => <div key={w} className="h">{w}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="c empty" />;
          const s = d <= today ? dayScore(data, d) : null;
          const lvl = s === null ? '' : s >= 1 ? 'l3' : s >= 0.6 ? 'l2' : s > 0 ? 'l1' : '';
          return <div key={d} className={`c ${lvl} ${d === today ? 'today' : ''}`} title={s === null ? '' : `${Math.round(s * 100)}% done`}>{Number(d.slice(8))}</div>;
        })}
      </div>
      <div className="legend mt-12">
        <span><i className="stat-dot bg-pink" />All done</span><span><i className="stat-dot bg-mint" />Most</span><span><i className="stat-dot bg-sky" />Some</span><span><i className="stat-dot" style={{ background: 'var(--surface-3)' }} />None</span>
      </div>
    </Card>
  );
}

const EMOJIS = ['💧', '👟', '📖', '🧘', '🌙', '🍳', '🧾', '🚫', '🥗', '🧴', '💊', '✍️', '🎸', '🙏', '📵', '🤸'];

function HabitForm({ initial, onClose }: { initial?: Habit; onClose: () => void }) {
  const { saveHabit, deleteHabit } = useStore.getState();
  const [name, setName] = useState(initial?.name || '');
  const [emoji, setEmoji] = useState(initial?.emoji || '✨');
  const [color, setColor] = useState<PastelColor>(initial?.color || 'lavender');
  const [days, setDays] = useState<number[]>(initial?.days || []);
  const [target, setTarget] = useState(initial?.target || 1);
  const [unit, setUnit] = useState(initial?.unit || '');
  const save = () => {
    if (!name.trim()) return;
    saveHabit({ id: initial?.id, createdAt: initial?.createdAt, name: name.trim(), emoji, color, days: days.length === 7 ? [] : [...days].sort(), target: Math.max(1, target), unit: target > 1 ? unit.trim() || undefined : undefined });
    onClose();
  };
  return (
    <Modal title={initial ? 'Edit habit' : 'New habit'} onClose={onClose} footer={<>
      {initial && <button className="btn danger left" onClick={() => { deleteHabit(initial.id); onClose(); }}><Trash2 /> Delete</button>}
      <button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!name.trim()} onClick={save}>Save</button>
    </>}>
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Habit" className="full"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Walk after dinner" /></Field>
        <div className="field full"><span className="label-text">Icon</span>
          <div className="row wrap" style={{ gap: 4 }}>{EMOJIS.map((e) => <button type="button" key={e} className={`chip clickable ${emoji === e ? 'on' : ''}`} style={{ fontSize: 18 }} onClick={() => setEmoji(e)}>{e}</button>)}</div>
        </div>
        <div className="field full"><span className="label-text">Colour</span>
          <div className="row wrap" style={{ gap: 8 }}>{PASTELS.map((c) => <button type="button" key={c} aria-label={c} className={`bg-${c}`} onClick={() => setColor(c)} style={{ width: 34, height: 34, borderRadius: '50%', border: color === c ? '3px solid var(--text)' : '3px solid transparent', cursor: 'pointer' }} />)}</div>
        </div>
        <div className="field full"><span className="label-text">Days</span>
          <div className="row wrap" style={{ gap: 6 }}>
            <button type="button" className={`chip clickable ${days.length === 0 ? 'on' : ''}`} onClick={() => setDays([])}>Every day</button>
            {WEEKDAYS.map((w, i) => <button type="button" key={w} className={`chip clickable ${days.includes(i) ? 'on' : ''}`} onClick={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i])}>{w}</button>)}
          </div>
        </div>
        <Field label="Times per day" help="More than 1 makes it a counter"><input className="input" type="number" min={1} max={50} value={target} onChange={(e) => setTarget(Number(e.target.value) || 1)} /></Field>
        <Field label="Unit (optional)"><input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="glasses" disabled={target <= 1} /></Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
