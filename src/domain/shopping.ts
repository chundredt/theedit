import type { AppData, ID, ISODate, MealPlanWeek, MealType, Product, Recipe, Store, WeekKey } from './types';
import { MEAL_TYPES } from './types';
import { storePrices, type StorePrice } from './prices';
import { recipeStats, suggestRecipes, usableQuantity } from './recipes';
import { addDays, round2 } from '../lib/format';

export function emptyWeek(week: WeekKey): MealPlanWeek {
  return { week, days: Array.from({ length: 7 }, () => ({})) };
}

export interface Need {
  product: Product;
  required: number; // grams for the week's meals
  inPantry: number; // usable grams at home
  toBuy: number; // grams still needed
  usedBy: string[]; // recipe names
}

/** Combine every planned meal's ingredients into total quantities per product. */
export function weeklyNeeds(data: AppData, plan: MealPlanWeek | undefined, today: ISODate): Need[] {
  if (!plan) return [];
  const recipes = new Map(data.recipes.map((r) => [r.id, r]));
  const products = new Map(data.products.map((p) => [p.id, p]));
  const totals = new Map<ID, { grams: number; usedBy: Set<string> }>();
  for (const day of plan.days) {
    for (const mt of MEAL_TYPES) {
      const slot = day[mt];
      const r = slot && recipes.get(slot.recipeId);
      if (!slot || !r) continue;
      const scale = slot.servings / Math.max(1, r.servings);
      for (const ing of r.ingredients) {
        const t = totals.get(ing.productId) || { grams: 0, usedBy: new Set<string>() };
        t.grams += ing.grams * scale;
        t.usedBy.add(r.name);
        totals.set(ing.productId, t);
      }
    }
  }
  const out: Need[] = [];
  for (const [pid, t] of totals) {
    const product = products.get(pid);
    if (!product) continue;
    const required = Math.round(t.grams);
    const inPantry = Math.round(usableQuantity(data.pantry, pid, today));
    out.push({ product, required, inPantry, toBuy: Math.max(0, required - inPantry), usedBy: [...t.usedBy] });
  }
  return out.sort((a, b) => a.product.category.localeCompare(b.product.category) || a.product.name.localeCompare(b.product.name));
}

export interface ListItem extends Need {
  options: (StorePrice & { packs: number; cost: number })[];
  chosen?: StorePrice & { packs: number; cost: number };
  recommended?: Store;
  leftover: number; // grams left over after buying whole packs
}

export interface ShoppingSummary {
  items: ListItem[];
  total: number;
  byStore: { store: Store; total: number; count: number }[];
  specialsSaving: number;
  unpriced: number;
  fromPantry: Need[];
}

/** Whole packs have to be bought, so cost = packs × pack price at each store. */
export function buildShoppingList(data: AppData, plan: MealPlanWeek | undefined, today: ISODate, overrides: Record<ID, ID> = {}): ShoppingSummary {
  const needs = weeklyNeeds(data, plan, today);
  const items: ListItem[] = [];
  let total = 0;
  let saving = 0;
  let unpriced = 0;
  const byStore = new Map<ID, { store: Store; total: number; count: number }>();
  for (const n of needs.filter((x) => x.toBuy > 0)) {
    const options = storePrices(data, n.product.id, today)
      .map((sp) => {
        const packs = Math.max(1, Math.ceil(n.toBuy / sp.record.packSize - 1e-9));
        return { ...sp, packs, cost: round2(packs * sp.record.price) };
      })
      .sort((a, b) => a.cost - b.cost || a.perKg - b.perKg);
    const recommended = options[0]?.store;
    const chosen = options.find((o) => o.store.id === overrides[n.product.id]) || options[0];
    if (chosen) {
      total += chosen.cost;
      const s = byStore.get(chosen.store.id) || { store: chosen.store, total: 0, count: 0 };
      s.total += chosen.cost;
      s.count++;
      byStore.set(chosen.store.id, s);
      if (chosen.isSpecial && chosen.regular) {
        const reg = (chosen.regular.price / chosen.regular.packSize) * chosen.record.packSize * chosen.packs;
        if (reg > chosen.cost) saving += reg - chosen.cost;
      } else if (chosen.isSpecial && chosen.record.wasPrice) {
        saving += (chosen.record.wasPrice - chosen.record.price) * chosen.packs;
      }
    } else unpriced++;
    const leftover = chosen ? Math.round(chosen.packs * chosen.record.packSize - n.toBuy) : 0;
    items.push({ ...n, options, chosen, recommended, leftover });
  }
  return {
    items,
    total: round2(total),
    byStore: [...byStore.values()].map((s) => ({ ...s, total: round2(s.total) })).sort((a, b) => b.total - a.total),
    specialsSaving: round2(saving),
    unpriced,
    fromPantry: needs.filter((n) => n.inPantry > 0),
  };
}

export interface DayTotals {
  date: ISODate;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  cost: number;
  meals: number;
}

/** Nutrition per person per day (servings beyond one are other household members). */
export function planTotals(data: AppData, plan: MealPlanWeek | undefined, today: ISODate): { days: DayTotals[]; weekCost: number } {
  const recipes = new Map(data.recipes.map((r) => [r.id, r]));
  const products = new Map(data.products.map((p) => [p.id, p]));
  const cache = new Map<ID, ReturnType<typeof recipeStats>>();
  const days: DayTotals[] = [];
  let weekCost = 0;
  const week = plan?.week || '';
  for (let i = 0; i < 7; i++) {
    const t: DayTotals = { date: week ? addDays(week, i) : '', kcal: 0, protein: 0, carbs: 0, fat: 0, cost: 0, meals: 0 };
    const day = plan?.days[i] || {};
    for (const mt of MEAL_TYPES) {
      const slot = day[mt];
      const r = slot && recipes.get(slot.recipeId);
      if (!slot || !r) continue;
      let s = cache.get(r.id);
      if (!s) {
        s = recipeStats(r, data, today, products);
        cache.set(r.id, s);
      }
      t.kcal += s.kcal;
      t.protein += s.protein;
      t.carbs += s.carbs;
      t.fat += s.fat;
      t.cost += s.costPerServing * slot.servings;
      t.meals++;
    }
    t.cost = round2(t.cost);
    weekCost += t.cost;
    days.push(t);
  }
  return { days, weekCost: round2(weekCost) };
}

/**
 * Fill empty slots greedily with the best-scoring recipe, re-scoring after each pick so later
 * choices reuse ingredients already bought (less waste) and avoid repeating a dish too often.
 */
export function autoFillWeek(data: AppData, plan: MealPlanWeek, today: ISODate, servings: number, mealTypes: MealType[] = MEAL_TYPES): MealPlanWeek {
  const next: MealPlanWeek = { week: plan.week, days: plan.days.map((d) => ({ ...d })) };
  const recipes = new Map<ID, Recipe>(data.recipes.map((r) => [r.id, r]));
  const planProducts = new Set<ID>();
  const used = new Map<ID, number>();
  for (const d of next.days)
    for (const mt of MEAL_TYPES) {
      const s = d[mt];
      if (!s) continue;
      used.set(s.recipeId, (used.get(s.recipeId) || 0) + 1);
      recipes.get(s.recipeId)?.ingredients.forEach((i) => planProducts.add(i.productId));
    }
  for (let i = 0; i < 7; i++) {
    for (const mt of mealTypes) {
      if (next.days[i][mt]) continue;
      const yesterday = i > 0 ? next.days[i - 1][mt]?.recipeId : undefined;
      const options = suggestRecipes(data, today, { mealType: mt, planProductIds: planProducts, usedCount: used }).filter(
        (s) => s.recipe.id !== yesterday && (used.get(s.recipe.id) || 0) < 3,
      );
      const pick = options[0];
      if (!pick) continue;
      next.days[i][mt] = { recipeId: pick.recipe.id, servings };
      used.set(pick.recipe.id, (used.get(pick.recipe.id) || 0) + 1);
      pick.recipe.ingredients.forEach((ing) => planProducts.add(ing.productId));
    }
  }
  return next;
}
