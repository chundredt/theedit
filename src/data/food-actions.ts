import { useStore } from './store';
import { rememberFoods, norm } from '../domain/food';
import { addDays } from '../lib/format';
import { uid } from '../lib/id';
import type { FoodEntry, ISODate, MealType } from '../domain/types';

const mutate = (fn: Parameters<ReturnType<typeof useStore.getState>['mutate']>[0], undo?: string) => useStore.getState().mutate(fn, undo);

/** Add foods to a day. Today and earlier count as eaten; later days are a plan. */
export function logFoods(date: ISODate, meal: MealType, lines: { name: string; base?: string; qty?: number; kcal: number; protein: number }[], today: ISODate) {
  mutate((d) => {
    for (const l of lines) d.foodLog.push({ id: uid(), date, meal, name: l.name, kcal: Math.round(l.kcal), protein: Math.round(l.protein * 10) / 10, eaten: date <= today });
    d.myFoods = rememberFoods(d.myFoods, lines.filter((l) => l.base).map((l) => ({ base: l.base!, qty: l.qty ?? 1, kcal: l.kcal, protein: l.protein })), today);
  });
}

export function updateFood(id: string, p: Partial<FoodEntry>) {
  mutate((d) => {
    const e = d.foodLog.find((x) => x.id === id);
    if (e) Object.assign(e, p);
  });
}

export function deleteFood(id: string) {
  mutate((d) => {
    d.foodLog = d.foodLog.filter((x) => x.id !== id);
  }, 'Removed');
}

/** Tick everything planned for a meal (or a whole day) as eaten. */
export function markEaten(date: ISODate, meal?: MealType) {
  mutate((d) => {
    for (const e of d.foodLog) if (e.date === date && (!meal || e.meal === meal)) e.eaten = true;
  });
}

/** Copy one day's foods onto other days (as a plan unless the day has passed). */
export function copyDay(from: ISODate, to: ISODate[], today: ISODate) {
  mutate((d) => {
    const src = d.foodLog.filter((e) => e.date === from);
    for (const date of to) for (const e of src) d.foodLog.push({ ...e, id: uid(), date, eaten: date < today ? true : false });
  });
}

/** Plan this week the same as last week, skipping days that already have food. */
export function repeatLastWeek(monday: ISODate, today: ISODate): number {
  let added = 0;
  mutate((d) => {
    for (let i = 0; i < 7; i++) {
      const date = addDays(monday, i);
      if (date < today || d.foodLog.some((e) => e.date === date)) continue;
      for (const e of d.foodLog.filter((x) => x.date === addDays(date, -7))) {
        d.foodLog.push({ ...e, id: uid(), date, eaten: false });
        added++;
      }
    }
  });
  return added;
}

export function clearDay(date: ISODate) {
  mutate((d) => {
    d.foodLog = d.foodLog.filter((e) => e.date !== date);
  }, 'Day cleared');
}

export function toggleFavourite(name: string, kcal: number, protein: number, today: ISODate) {
  mutate((d) => {
    const m = d.myFoods.find((x) => norm(x.name) === norm(name));
    if (m) m.favourite = !m.favourite;
    else d.myFoods.push({ id: uid(), name, kcal, protein, favourite: true, uses: 1, lastUsed: today });
  });
}

/* ---------- Shopping list ---------- */

export function addShopping(names: string[]): number {
  let added = 0;
  mutate((d) => {
    for (const raw of names) {
      const name = raw.trim();
      if (!name) continue;
      const existing = d.shoppingList.find((x) => norm(x.name) === norm(name));
      if (existing) { existing.checked = false; continue; }
      d.shoppingList.push({ id: uid(), name: name.charAt(0).toUpperCase() + name.slice(1), checked: false });
      added++;
    }
  });
  return added;
}

export function toggleShoppingItem(id: string) {
  mutate((d) => {
    const i = d.shoppingList.find((x) => x.id === id);
    if (i) i.checked = !i.checked;
  });
}

export function removeShoppingItem(id: string) {
  mutate((d) => {
    d.shoppingList = d.shoppingList.filter((x) => x.id !== id);
  });
}

export function clearBought() {
  mutate((d) => {
    d.shoppingList = d.shoppingList.filter((x) => !x.checked);
  }, 'Cleared');
}
