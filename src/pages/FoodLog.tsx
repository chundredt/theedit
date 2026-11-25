import { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy, ListPlus, Plus, Repeat, Star, Trash2 } from 'lucide-react';
import { Modal, NumberInput, PageHeader, Progress } from '../components/ui';
import { DayStrip } from '../components/DayStrip';
import { LogFood, MEAL_LABEL } from '../components/LogFood';
import { getToday, useData, useStore } from '../data/store';
import { addShopping, clearDay, copyDay, deleteFood, markEaten, repeatLastWeek, toggleFavourite, updateFood } from '../data/food-actions';
import { averageOver, dayTotals, entriesFor, norm, readAmount, splitItems } from '../domain/food';
import { addDays, dayName, fmtDate, mondayOf, toDate } from '../lib/format';
import { MEAL_TYPES, type FoodEntry, type ISODate, type MealType } from '../domain/types';

export function FoodLogPage() {
  const data = useData();
  const today = getToday();
  const toast = useStore((s) => s.toast);
  const [day, setDay] = useState(today);
  const [adding, setAdding] = useState<MealType | null>(null);
  const [editing, setEditing] = useState<FoodEntry | null>(null);
  const [copying, setCopying] = useState(false);
  const [listing, setListing] = useState(false);
  const monday = mondayOf(day);
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const t = dayTotals(data.foodLog, day);
  const avg = useMemo(() => averageOver(data.foodLog, week.filter((d) => d <= today)), [data.foodLog, monday, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const target = data.settings.kcalTarget || 2000;
  const proteinTarget = data.settings.proteinTarget || 100;
  const future = day > today;
  const plannedHere = data.foodLog.some((e) => e.date === day && !e.eaten);
  const hasFood = t.count > 0;

  return (
    <>
      <PageHeader title="Food log" sub={avg.days ? `This week: about ${avg.kcal.toLocaleString('en-ZA')} kcal and ${avg.protein} g protein a day` : 'Log what you eat, plan what’s coming.'} />

      <div className="stack" style={{ gap: 16, maxWidth: 720 }}>
        <div className="row food-week" style={{ gap: 4 }}>
          <button className="btn icon ghost" aria-label="Previous week" onClick={() => setDay(addDays(day, -7))}><ChevronLeft /></button>
          <div className="grow" style={{ minWidth: 0 }}><DayStrip value={day} onChange={setDay} today={today} mark={(d) => dayTotals(data.foodLog, d).count > 0} /></div>
          <button className="btn icon ghost" aria-label="Next week" onClick={() => setDay(addDays(day, 7))}><ChevronRight /></button>
        </div>

        <section className="card food-total" data-testid="food-total">
          <div className="row between" style={{ alignItems: 'baseline' }}>
            <h2>{day === today ? 'Today' : `${dayName(day, false)} ${toDate(day).getDate()}`}</h2>
            {day !== today && <button className="link" onClick={() => setDay(today)}>Back to today</button>}
          </div>
          {future ? (
            <p className="food-big mt-8"><b>{Math.round(t.plannedKcal).toLocaleString('en-ZA')}</b> kcal planned <span className="muted">· {Math.round(t.plannedProtein)} g protein</span></p>
          ) : (
            <>
              <p className="food-big mt-8"><b data-testid="kcal-today">{Math.round(t.kcal).toLocaleString('en-ZA')}</b> <span className="muted">of {target.toLocaleString('en-ZA')} kcal</span></p>
              <Progress value={t.kcal} max={target} status={t.kcal > target * 1.05 ? 'over' : undefined} />
              <p className="mt-12"><b>{Math.round(t.protein)} g</b> <span className="muted">of {proteinTarget} g protein</span></p>
              <Progress value={t.protein} max={proteinTarget} size="thin" />
              {t.plannedKcal > 0 && <p className="xs muted mt-8">Plus {Math.round(t.plannedKcal)} kcal planned, not ticked yet.</p>}
            </>
          )}
        </section>

        {MEAL_TYPES.map((m) => {
          const items = entriesFor(data.foodLog, day, m);
          const kcal = items.reduce((a, e) => a + e.kcal, 0);
          const waiting = !future && items.some((e) => !e.eaten);
          return (
            <section className="card meal-card" key={m} data-testid={`meal-${m}`}>
              <div className="row between">
                <h2>{MEAL_LABEL[m]} {kcal > 0 && <span className="muted" style={{ fontWeight: 600, fontSize: 15 }}>· {kcal} kcal</span>}</h2>
                <div className="row" style={{ gap: 6 }}>
                  {waiting && <button className="btn sm" onClick={() => markEaten(day, m)}><Check /> Ate it</button>}
                  <button className="btn icon sm" aria-label={`Add to ${MEAL_LABEL[m].toLowerCase()}`} onClick={() => setAdding(m)}><Plus /></button>
                </div>
              </div>
              {items.length > 0 && (
                <div className="simple-list mt-8">
                  {items.map((e) => (
                    <button key={e.id} className={`food-row ${e.eaten ? '' : 'planned'}`} onClick={() => setEditing(e)}>
                      <span className="grow">{e.name}</span>
                      <span className="nowrap">{e.kcal} kcal</span>
                      <span className="muted nowrap small">{Math.round(e.protein)} g</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          );
        })}

        <div className="row wrap" style={{ gap: 8 }}>
          {!future && plannedHere && <button className="btn" onClick={() => { markEaten(day); toast('All ticked as eaten'); }}><Check /> Ate everything planned</button>}
          {hasFood && <button className="btn" onClick={() => setCopying(true)}><Copy /> Copy this day</button>}
          <button className="btn" onClick={() => {
            const n = repeatLastWeek(monday, today);
            toast(n ? `Planned ${n} foods from last week` : 'Nothing to copy — empty days only, and last week had none');
          }}><Repeat /> Repeat last week</button>
          <button className="btn" onClick={() => setListing(true)}><ListPlus /> Add to shopping list</button>
          {hasFood && <button className="btn ghost" onClick={() => clearDay(day)}><Trash2 /> Clear day</button>}
        </div>
      </div>

      {adding && <LogFood date={day} meal={adding} onClose={() => setAdding(null)} />}
      {editing && <EditFood entry={editing} onClose={() => setEditing(null)} />}
      {copying && <CopyDay from={day} onClose={() => setCopying(false)} />}
      {listing && <WeekToList week={week} today={today} onClose={() => setListing(false)} />}
    </>
  );
}

function EditFood({ entry, onClose }: { entry: FoodEntry; onClose: () => void }) {
  const data = useData();
  const today = getToday();
  const [name, setName] = useState(entry.name);
  const [kcal, setKcal] = useState(entry.kcal);
  const [protein, setProtein] = useState(entry.protein);
  const [meal, setMeal] = useState(entry.meal);
  const fav = data.myFoods.some((m) => m.favourite && norm(m.name) === norm(entry.name));
  return (
    <Modal title="Food" onClose={onClose}
      footer={<><button className="btn danger left" onClick={() => { deleteFood(entry.id); onClose(); }}><Trash2 /> Remove</button><button className="btn primary" onClick={() => { updateFood(entry.id, { name: name.trim() || entry.name, kcal, protein, meal }); onClose(); }}>Save</button></>}>
      <div className="form-grid">
        <label className="field full"><span className="label">Name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="field"><span className="label">Calories</span><NumberInput value={kcal} min={0} onChange={setKcal} ariaLabel="Calories" /></label>
        <label className="field"><span className="label">Protein (g)</span><NumberInput value={protein} min={0} onChange={setProtein} ariaLabel="Protein" /></label>
        <label className="field full"><span className="label">Meal</span>
          <select className="input" value={meal} onChange={(e) => setMeal(e.target.value as MealType)}>{MEAL_TYPES.map((m) => <option key={m} value={m}>{MEAL_LABEL[m]}</option>)}</select>
        </label>
      </div>
      <div className="row wrap mt-16" style={{ gap: 8 }}>
        {!entry.eaten && entry.date <= today && <button className="btn" onClick={() => { updateFood(entry.id, { eaten: true, name: name.trim() || entry.name, kcal, protein, meal }); onClose(); }}><Check /> Ate it</button>}
        <button className={`btn ${fav ? 'primary' : ''}`} onClick={() => toggleFavourite(entry.name, entry.kcal, entry.protein, today)}><Star /> {fav ? 'Favourite' : 'Add to favourites'}</button>
      </div>
    </Modal>
  );
}

function CopyDay({ from, onClose }: { from: ISODate; onClose: () => void }) {
  const today = getToday();
  const toast = useStore((s) => s.toast);
  const monday = mondayOf(from);
  const days = [...Array.from({ length: 7 }, (_, i) => addDays(monday, i)), ...Array.from({ length: 7 }, (_, i) => addDays(monday, 7 + i))].filter((d) => d !== from && d >= today);
  const [chosen, setChosen] = useState<ISODate[]>([]);
  return (
    <Modal title={`Copy ${dayName(from, false)}`} sub="Choose the days to plan the same food" onClose={onClose}
      footer={<button className="btn primary" disabled={!chosen.length} onClick={() => { copyDay(from, chosen, today); toast(`Copied to ${chosen.length} day${chosen.length === 1 ? '' : 's'}`); onClose(); }}>Copy</button>}>
      <div className="copy-days">
        {days.map((d) => (
          <button key={d} className={`chip clickable ${chosen.includes(d) ? 'on' : ''}`} aria-pressed={chosen.includes(d)} onClick={() => setChosen(chosen.includes(d) ? chosen.filter((x) => x !== d) : [...chosen, d])}>
            {dayName(d)} {fmtDate(d).slice(0, 5)}
          </button>
        ))}
      </div>
    </Modal>
  );
}

/** Planned foods for the rest of the week, split into simple items for the shopping list. */
function WeekToList({ week, today, onClose }: { week: ISODate[]; today: ISODate; onClose: () => void }) {
  const data = useData();
  const toast = useStore((s) => s.toast);
  const items = useMemo(() => {
    const seen = new Map<string, string>();
    const onList = new Set(data.shoppingList.filter((x) => !x.checked).map((x) => norm(x.name)));
    for (const e of data.foodLog) {
      if (!week.includes(e.date) || e.date < today) continue;
      for (const part of splitItems(e.name)) {
        const n = readAmount(part).rest.replace(/^(of|some)\s+/i, '').trim();
        const k = norm(n);
        if (k && !seen.has(k) && !onList.has(k)) seen.set(k, n.charAt(0).toUpperCase() + n.slice(1));
      }
    }
    return [...seen.values()];
  }, [data.foodLog, data.shoppingList, week, today]);
  const [chosen, setChosen] = useState<string[]>(items);
  return (
    <Modal title="Add to shopping list" sub="From what's planned for the rest of this week" onClose={onClose}
      footer={<button className="btn primary" disabled={!chosen.length} onClick={() => { const n = addShopping(chosen); toast(`Added ${n} to your list`); onClose(); }}>Add {chosen.length || ''}</button>}>
      {items.length === 0 ? <p className="muted">Nothing planned for the rest of the week yet. Add food to coming days first.</p> : (
        <div className="list">
          {items.map((n) => (
            <label key={n} className="check-row" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={chosen.includes(n)} onChange={() => setChosen(chosen.includes(n) ? chosen.filter((x) => x !== n) : [...chosen, n])} />
              <span className="grow">{n}</span>
            </label>
          ))}
        </div>
      )}
    </Modal>
  );
}
