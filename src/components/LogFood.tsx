import { useMemo, useState } from 'react';
import { Copy, Star, X } from 'lucide-react';
import { Modal, NumberInput, Seg } from './ui';
import { getToday, useData, useStore } from '../data/store';
import { logFoods, toggleFavourite } from '../data/food-actions';
import { entriesFor, norm, quickPicks, readFoodText, type FoodLine } from '../domain/food';
import { addDays, fmtDate } from '../lib/format';
import { MEAL_TYPES, type ISODate, type MealType } from '../domain/types';

export const MEAL_LABEL: Record<MealType, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' };

export function mealNow(): MealType {
  const h = new Date().getHours();
  return h < 10 ? 'breakfast' : h < 15 ? 'lunch' : h < 20 ? 'dinner' : 'snack';
}

type Picked = { name: string; kcal: number; protein: number };

/**
 * Type what you ate the way you'd say it. Calories and protein fill in as you type;
 * tap a number to change it. Recent foods and favourites are one tap away.
 */
export function LogFood({ date: d0, meal: m0, onClose }: { date?: ISODate; meal?: MealType; onClose: () => void }) {
  const data = useData();
  const today = getToday();
  const toast = useStore((s) => s.toast);
  const date = d0 || today;
  const [meal, setMeal] = useState<MealType>(m0 || mealNow());
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<Picked[]>([]);
  const [edits, setEdits] = useState<Record<string, { kcal?: number; protein?: number }>>({});
  const parsed = useMemo(() => readFoodText(text, data.myFoods, data.products), [text, data.myFoods, data.products]);
  const lines: (FoodLine & { key: string })[] = parsed.map((l, i) => {
    const key = `${i}:${norm(l.name)}`;
    return { ...l, key, kcal: edits[key]?.kcal ?? l.kcal, protein: edits[key]?.protein ?? l.protein };
  });
  const all = [...picked.map((p) => ({ ...p, base: undefined as string | undefined, qty: 1 })), ...lines];
  const total = all.reduce((a, l) => ({ kcal: a.kcal + l.kcal, protein: a.protein + l.protein }), { kcal: 0, protein: 0 });
  const picks = quickPicks(data, 14);
  const favs = new Set(data.myFoods.filter((m) => m.favourite).map((m) => norm(m.name)));
  const yesterday = entriesFor(data.foodLog, addDays(date, -1), meal);
  const planning = date > today;

  const save = () => {
    if (!all.length) return;
    logFoods(date, meal, all.map((l) => ({ name: l.name, base: l.base, qty: l.qty, kcal: l.kcal, protein: l.protein })), today);
    toast(`${planning ? 'Planned' : 'Logged'} ${Math.round(total.kcal)} kcal`);
    onClose();
  };

  return (
    <Modal title={planning ? 'Plan food' : 'Log food'} sub={date === today ? undefined : fmtDate(date)} onClose={onClose}
      footer={<><span className="grow muted" style={{ textAlign: 'left' }}>{all.length ? <><b style={{ color: 'var(--text)' }}>{Math.round(total.kcal)} kcal</b> · {Math.round(total.protein)} g protein</> : ''}</span><button className="btn primary" onClick={save} disabled={!all.length}>{planning ? 'Plan it' : 'Save'}</button></>}>
      <div className="stack" style={{ gap: 14 }}>
        <Seg options={MEAL_TYPES.map((m) => ({ value: m, label: MEAL_LABEL[m] }))} value={meal} onChange={setMeal} />

        <div>
          <textarea className="input food-input" rows={2} value={text} onChange={(e) => setText(e.target.value)} aria-label="What did you eat?"
            placeholder="e.g. 2 eggs, toast, coffee with milk" />
          <p className="xs muted mt-8">Separate foods with commas. Amounts help: “2 eggs”, “150g chicken”, “half a sandwich”.</p>
        </div>

        {all.length > 0 && (
          <div className="food-lines">
            {picked.map((p, i) => (
              <div key={`p${i}`} className="food-line">
                <span className="grow">{p.name}</span>
                <span className="muted small nowrap">{p.kcal} kcal · {Math.round(p.protein)} g</span>
                <button className="btn ghost icon sm" aria-label={`Remove ${p.name}`} onClick={() => setPicked(picked.filter((_, j) => j !== i))}><X /></button>
              </div>
            ))}
            {lines.map((l) => (
              <div key={l.key} className={`food-line ${l.known ? '' : 'unknown'}`}>
                <span className="grow">{l.name}{!l.known && <span className="xs" style={{ display: 'block' }}>Not sure of this one — type the calories</span>}</span>
                <label className="food-num"><NumberInput value={l.kcal} min={0} ariaLabel={`Calories in ${l.name}`} className="input sm" onChange={(v) => setEdits({ ...edits, [l.key]: { ...edits[l.key], kcal: v } })} /><span>kcal</span></label>
                <label className="food-num"><NumberInput value={l.protein} min={0} ariaLabel={`Protein in ${l.name}`} className="input sm" onChange={(v) => setEdits({ ...edits, [l.key]: { ...edits[l.key], protein: v } })} /><span>g</span></label>
              </div>
            ))}
          </div>
        )}

        {yesterday.length > 0 && (
          <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setPicked([...picked, ...yesterday.map((e) => ({ name: e.name, kcal: e.kcal, protein: e.protein }))])}>
            <Copy /> Same as yesterday ({yesterday.reduce((a, e) => a + e.kcal, 0)} kcal)
          </button>
        )}

        {picks.length > 0 && (
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Tap to add</div>
            <div className="pick-chips">
              {picks.map((p) => (
                <span key={p.name} className="pick-chip">
                  <button className="pick-add" onClick={() => setPicked([...picked, { name: p.name, kcal: p.kcal, protein: p.protein }])} aria-label={`Add ${p.name}`}>
                    {p.name} <span className="muted">{p.kcal}</span>
                  </button>
                  <button className={`pick-star ${favs.has(norm(p.name)) ? 'on' : ''}`} aria-label={`${favs.has(norm(p.name)) ? 'Unfavourite' : 'Favourite'} ${p.name}`} onClick={() => toggleFavourite(p.name, p.kcal, p.protein, today)}><Star /></button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
