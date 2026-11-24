import { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Card, Field, Modal, PageHeader, Seg } from '../components/ui';
import { DayStrip } from '../components/DayStrip';
import { getToday, useData, useStore } from '../data/store';
import { intensityFor, logsOn, plannedFor, weekStreak, weekSummary } from '../domain/workouts';
import { weekdayIndex } from '../domain/habits';
import { PASTELS, type Exercise, type PastelColor, type Routine, type WorkoutKind, type WorkoutLog } from '../domain/types';
import { dayName, fmtDate, monthName, toISO } from '../lib/format';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const KIND_LABEL: Record<WorkoutKind, string> = { strength: 'Strength', cardio: 'Cardio', mobility: 'Mobility', class: 'Class' };

function exerciseLine(e: Exercise) {
  return [e.sets && e.reps ? `${e.sets} × ${e.reps}` : e.reps, e.weight ? `${e.weight} kg` : '', e.minutes ? `${e.minutes} min` : ''].filter(Boolean).join(' · ');
}

export function WorkoutsPage() {
  const data = useData();
  const today = getToday();
  const [day, setDay] = useState(today);
  const [editing, setEditing] = useState<Routine | 'new' | null>(null);
  const [logging, setLogging] = useState(false);
  const { saveWorkoutLog, deleteWorkoutLog, setSchedule } = useStore.getState();
  const routine = plannedFor(data, day);
  const logs = logsOn(data, day);
  const planLog = routine ? logs.find((l) => l.routineId === routine.id) : undefined;
  const week = weekSummary(data, today);
  const wStreak = weekStreak(data, today);
  const future = day > today;

  const toggle = (i: number) => {
    if (!routine || future) return;
    const done = planLog ? (planLog.done.includes(i) ? planLog.done.filter((x) => x !== i) : [...planLog.done, i]) : [i];
    if (planLog && done.length === 0) return deleteWorkoutLog(planLog.id);
    saveWorkoutLog({ id: planLog?.id, date: day, routineId: routine.id, name: routine.name, kind: routine.kind, minutes: routine.minutes, done, effort: planLog?.effort || 2 });
  };

  return (
    <>
      <PageHeader title="Workouts" sub="Show up most weeks. Progress follows.">
        <button className="btn" onClick={() => setLogging(true)}><Plus /> Log other activity</button>
        <button className="btn primary" onClick={() => setEditing('new')}><Plus /> New routine</button>
      </PageHeader>

      <div className="grid g-3" style={{ marginBottom: 16 }}>
        <div className="tile pastel bg-lavender"><div className="eyebrow">This week</div><div className="big mt-8">{week.sessions}<span style={{ fontSize: 16 }}> / {week.planned} sessions</span></div></div>
        <div className="tile pastel bg-mint"><div className="eyebrow">Active minutes</div><div className="big mt-8">{week.minutes}</div></div>
        <div className="tile pastel bg-butter"><div className="eyebrow">Week streak (2+ sessions)</div><div className="big mt-8">{wStreak} {wStreak === 1 ? 'week' : 'weeks'}</div></div>
      </div>

      <DayStrip value={day} onChange={setDay} today={today} mark={(d) => logsOn(data, d).length > 0} />

      <div className="grid g-main mt-16" style={{ alignItems: 'start' }}>
        <div className="stack" style={{ gap: 16 }}>
          {routine ? (
            <section className={`tile pastel bg-${routine.color}`} data-testid="workout-today">
              <div className="row between">
                <div className="eyebrow">{dayName(day, false)} · {KIND_LABEL[routine.kind]} · {routine.minutes} min</div>
                {planLog && <span className="chip" style={{ background: '#111', color: '#fff' }}><Check /> {planLog.done.length === routine.exercises.length ? 'Done' : 'In progress'}</span>}
              </div>
              <h3 className="mt-8" style={{ fontSize: 24 }}>{routine.emoji} {routine.name}</h3>
              <div className="mt-12">
                {routine.exercises.map((e, i) => {
                  const done = !!planLog?.done.includes(i);
                  return (
                    <div className="check-row" key={i}>
                      <div className="grow"><b style={{ textDecoration: done ? 'line-through' : undefined }}>{e.name}</b><div className="small" style={{ opacity: 0.7 }}>{exerciseLine(e)}</div></div>
                      <button className={`round-check ${done ? 'on' : ''}`} style={done ? { background: '#111', borderColor: '#111', color: '#fff' } : undefined} aria-label={`${done ? 'Undo' : 'Done'}: ${e.name}`} aria-pressed={done} disabled={future} onClick={() => toggle(i)}>{done && <Check />}</button>
                    </div>
                  );
                })}
              </div>
              {!future && (
                <div className="row wrap mt-16" style={{ gap: 8 }}>
                  {(!planLog || planLog.done.length < routine.exercises.length) && <button className="btn primary sm" onClick={() => saveWorkoutLog({ id: planLog?.id, date: day, routineId: routine.id, name: routine.name, kind: routine.kind, minutes: routine.minutes, done: routine.exercises.map((_, i) => i), effort: planLog?.effort || 2 })}><Check /> Mark all done</button>}
                  {planLog && (
                    <span className="row small" style={{ gap: 6 }}>How did it feel?
                      <Seg value={String(planLog.effort || 2) as '1' | '2' | '3'} onChange={(v) => saveWorkoutLog({ ...planLog, effort: Number(v) as 1 | 2 | 3 })} options={[{ value: '1', label: 'Easy' }, { value: '2', label: 'Good' }, { value: '3', label: 'Hard' }]} />
                    </span>
                  )}
                  <button className="btn sm" onClick={() => setEditing(routine)}><Pencil /> Edit routine</button>
                </div>
              )}
            </section>
          ) : (
            <Card><h2>Rest day</h2><p className="muted small mt-8">Nothing planned for {dayName(day, false)}. Rest is part of the plan — or log a walk if you did one.</p></Card>
          )}
          {logs.filter((l) => l !== planLog).map((l) => (
            <Card key={l.id}>
              <div className="row between"><div><b>{l.name}</b><div className="muted small">{KIND_LABEL[l.kind]} · {l.minutes} min{l.notes ? ` · ${l.notes}` : ''}</div></div>
                <button className="btn ghost icon sm" aria-label="Remove activity" onClick={() => deleteWorkoutLog(l.id)}><X /></button></div>
            </Card>
          ))}
          <ActivityCalendar />
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <Card title="Weekly plan">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className="row between" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <b className="small" style={{ width: 90, color: i === weekdayIndex(today) ? 'var(--coral)' : undefined }}>{w}</b>
                <select className="input sm" style={{ maxWidth: 220 }} value={data.workoutSchedule[i] || ''} onChange={(e) => setSchedule(i, e.target.value || undefined)} aria-label={`${w} workout`}>
                  <option value="">Rest</option>
                  {data.routines.map((r) => <option key={r.id} value={r.id}>{r.emoji} {r.name}</option>)}
                </select>
              </div>
            ))}
          </Card>
          <Card title="Routines">
            {data.routines.map((r) => (
              <button key={r.id} className="list-item" style={{ width: '100%', background: 'none', border: 0, borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }} onClick={() => setEditing(r)}>
                <span className={`avatar bg-${r.color}`} style={{ borderRadius: 12, fontSize: 18 }}>{r.emoji}</span>
                <div className="grow"><div className="title">{r.name}</div><div className="meta">{KIND_LABEL[r.kind]} · {r.minutes} min · {r.exercises.length} exercises</div></div>
                <Pencil size={15} className="muted" />
              </button>
            ))}
          </Card>
        </div>
      </div>
      {editing && <RoutineForm initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {logging && <LogForm date={day > today ? today : day} onClose={() => setLogging(false)} />}
    </>
  );
}

function ActivityCalendar() {
  const data = useData();
  const today = getToday();
  const [month, setMonth] = useState(() => { const d = new Date(today + 'T00:00:00'); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const first = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => toISO(new Date(month.getFullYear(), month.getMonth(), i + 1)))];
  return (
    <Card title="Activity" action={
      <span className="row" style={{ gap: 4 }}>
        <button className="btn ghost icon sm" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft /></button>
        <b className="small" style={{ minWidth: 92, textAlign: 'center' }}>{monthName(month.getMonth())}</b>
        <button className="btn ghost icon sm" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight /></button>
      </span>}>
      <div className="cal">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((w) => <div key={w} className="h">{w}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="c empty" />;
          const logs = logsOn(data, d);
          const lvl = logs.length ? intensityFor(logs.reduce((a, l) => a + l.minutes, 0), Math.max(...logs.map((l) => l.effort || 2))) : '';
          const cls = lvl === 'very-high' ? 'l3' : lvl === 'high' ? 'l2' : lvl ? 'l1' : '';
          return <div key={d} className={`c ${cls} ${d === today ? 'today' : ''}`} title={logs.map((l) => `${l.name} (${l.minutes} min)`).join(', ')}>{Number(d.slice(8))}</div>;
        })}
      </div>
      <div className="legend mt-12"><span><i className="stat-dot bg-pink" />Very high</span><span><i className="stat-dot bg-mint" />High</span><span><i className="stat-dot bg-sky" />Light–moderate</span></div>
    </Card>
  );
}

function RoutineForm({ initial, onClose }: { initial?: Routine; onClose: () => void }) {
  const { saveRoutine, deleteRoutine } = useStore.getState();
  const [name, setName] = useState(initial?.name || '');
  const [emoji, setEmoji] = useState(initial?.emoji || '🏃');
  const [color, setColor] = useState<PastelColor>(initial?.color || 'coral');
  const [kind, setKind] = useState<WorkoutKind>(initial?.kind || 'strength');
  const [minutes, setMinutes] = useState(initial?.minutes || 30);
  const [exs, setExs] = useState<Exercise[]>(initial?.exercises || [{ name: '', sets: 3, reps: '10' }]);
  const upd = (i: number, p: Partial<Exercise>) => setExs(exs.map((e, j) => (j === i ? { ...e, ...p } : e)));
  const valid = name.trim() && exs.some((e) => e.name.trim());
  const save = () => {
    if (!valid) return;
    saveRoutine({ id: initial?.id, name: name.trim(), emoji, color, kind, minutes, exercises: exs.filter((e) => e.name.trim()) });
    onClose();
  };
  return (
    <Modal wide title={initial ? 'Edit routine' : 'New routine'} onClose={onClose} footer={<>
      {initial && <button className="btn danger left" onClick={() => { deleteRoutine(initial.id); onClose(); }}><Trash2 /> Delete</button>}
      <button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!valid} onClick={save}>Save routine</button>
    </>}>
      <div className="form-grid">
        <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Upper body" /></Field>
        <Field label="Type"><select className="input" value={kind} onChange={(e) => setKind(e.target.value as WorkoutKind)}>{Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Minutes"><input className="input" type="number" min={5} max={240} value={minutes} onChange={(e) => setMinutes(Number(e.target.value) || 30)} /></Field>
        <Field label="Icon"><input className="input" value={emoji} onChange={(e) => setEmoji(e.target.value.slice(0, 4))} /></Field>
        <div className="field full"><span className="label-text">Colour</span>
          <div className="row wrap" style={{ gap: 8 }}>{PASTELS.map((c) => <button type="button" key={c} aria-label={c} className={`bg-${c}`} onClick={() => setColor(c)} style={{ width: 34, height: 34, borderRadius: '50%', border: color === c ? '3px solid var(--text)' : '3px solid transparent', cursor: 'pointer' }} />)}</div>
        </div>
        <div className="field full"><span className="label-text">Exercises</span>
          {exs.map((e, i) => (
            <div key={i} className="row wrap" style={{ gap: 6 }}>
              <input className="input sm" style={{ flex: '2 1 180px' }} placeholder="Exercise" value={e.name} onChange={(ev) => upd(i, { name: ev.target.value })} aria-label="Exercise name" />
              <input className="input sm" style={{ flex: '1 1 72px' }} type="number" min={0} placeholder="Sets" value={e.sets ?? ''} onChange={(ev) => upd(i, { sets: ev.target.value ? Number(ev.target.value) : undefined })} aria-label="Sets" />
              <input className="input sm" style={{ flex: '1 1 90px' }} placeholder="Reps" value={e.reps ?? ''} onChange={(ev) => upd(i, { reps: ev.target.value || undefined })} aria-label="Reps" />
              <input className="input sm" style={{ flex: '1 1 72px' }} type="number" min={0} placeholder="kg" value={e.weight ?? ''} onChange={(ev) => upd(i, { weight: ev.target.value ? Number(ev.target.value) : undefined })} aria-label="Weight in kg" />
              <input className="input sm" style={{ flex: '1 1 72px' }} type="number" min={0} placeholder="min" value={e.minutes ?? ''} onChange={(ev) => upd(i, { minutes: ev.target.value ? Number(ev.target.value) : undefined })} aria-label="Minutes" />
              <button type="button" className="btn ghost icon sm" aria-label="Remove exercise" onClick={() => setExs(exs.filter((_, j) => j !== i))}><X /></button>
            </div>
          ))}
          <div><button type="button" className="btn sm" onClick={() => setExs([...exs, { name: '', sets: 3, reps: '10' }])}><Plus /> Exercise</button></div>
        </div>
      </div>
    </Modal>
  );
}

function LogForm({ date, onClose }: { date: string; onClose: () => void }) {
  const save = useStore((s) => s.saveWorkoutLog);
  const [name, setName] = useState('Walk');
  const [kind, setKind] = useState<WorkoutKind>('cardio');
  const [minutes, setMinutes] = useState(30);
  const [notes, setNotes] = useState('');
  return (
    <Modal title={`Log activity · ${fmtDate(date)}`} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" disabled={!name.trim()} onClick={() => { save({ date, name: name.trim(), kind, minutes, done: [], effort: 2, notes: notes.trim() || undefined } as Omit<WorkoutLog, 'id'>); onClose(); }}>Save</button></>}>
      <div className="form-grid">
        <Field label="What did you do?" className="full"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Walk, padel, spin class…" /></Field>
        <Field label="Type"><select className="input" value={kind} onChange={(e) => setKind(e.target.value as WorkoutKind)}>{Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Minutes"><input className="input" type="number" min={1} value={minutes} onChange={(e) => setMinutes(Number(e.target.value) || 1)} /></Field>
        <Field label="Notes (optional)" className="full"><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
