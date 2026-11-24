import type { AppData, DietTag, ID, ISODate, MealType, Nutrition, PantryItem, Product, Recipe, Settings } from './types';
import { costPerGram } from './prices';
import { round2 } from '../lib/format';

export interface RecipeStats extends Nutrition {
  costPerServing: number;
  /** Ingredients without any known price (cost is understated). */
  unpriced: ID[];
  proteinPerR10: number;
}

/** Nutrition and cost per serving, calculated from ingredient data. */
export function recipeStats(recipe: Recipe, data: AppData, today: ISODate, prodMap?: Map<ID, Product>): RecipeStats {
  const products = prodMap || new Map(data.products.map((p) => [p.id, p]));
  const n: Nutrition = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  let cost = 0;
  const unpriced: ID[] = [];
  for (const ing of recipe.ingredients) {
    const p = products.get(ing.productId);
    if (!p) continue;
    if (p.nutrition) {
      const f = ing.grams / 100;
      n.kcal += p.nutrition.kcal * f;
      n.protein += p.nutrition.protein * f;
      n.carbs += p.nutrition.carbs * f;
      n.fat += p.nutrition.fat * f;
    }
    const cpg = costPerGram(data, ing.productId, today);
    if (cpg === undefined) unpriced.push(ing.productId);
    else cost += cpg * ing.grams;
  }
  const s = Math.max(1, recipe.servings);
  const per = {
    kcal: Math.round(n.kcal / s),
    protein: Math.round((n.protein / s) * 10) / 10,
    carbs: Math.round((n.carbs / s) * 10) / 10,
    fat: Math.round((n.fat / s) * 10) / 10,
  };
  const costPerServing = round2(cost / s);
  return { ...per, costPerServing, unpriced, proteinPerR10: costPerServing > 0 ? (per.protein / costPerServing) * 10 : 0 };
}

export function blockedTags(settings: Settings): DietTag[] {
  const tags: DietTag[] = [];
  if (settings.diet === 'vegetarian') tags.push('meat', 'pork', 'fish');
  if (settings.diet === 'pescatarian') tags.push('meat', 'pork');
  if (settings.diet === 'no-pork') tags.push('pork');
  if (settings.dairyFree) tags.push('dairy');
  if (settings.glutenFree) tags.push('gluten');
  return tags;
}

/** Why a recipe doesn't fit the user's preferences (empty = it fits). */
export function dietConflicts(recipe: Recipe, settings: Settings, products: Map<ID, Product>): string[] {
  const blocked = blockedTags(settings);
  const out: string[] = [];
  for (const ing of recipe.ingredients) {
    const p = products.get(ing.productId);
    if (!p) continue;
    if (settings.excludedProducts.includes(p.id)) out.push(`contains ${p.name}`);
    const hit = p.tags.find((t) => blocked.includes(t));
    if (hit) out.push(`${p.name} (${hit})`);
  }
  return [...new Set(out)];
}

export function usableQuantity(pantry: PantryItem[], productId: ID, today: ISODate): number {
  return pantry.filter((i) => i.productId === productId && (!i.expiry || i.expiry >= today)).reduce((s, i) => s + i.quantity, 0);
}

export interface Suggestion {
  recipe: Recipe;
  stats: RecipeStats;
  score: number;
  pantryHits: string[];
  expiringHits: string[];
  sharedWithPlan: number;
  reasons: string[];
}

/**
 * Rank recipes for a meal slot. Favours: protein per rand, low cost, pantry ingredients
 * (especially ones expiring soon), and ingredients already in this week's plan (less waste).
 */
export function suggestRecipes(
  data: AppData,
  today: ISODate,
  opts: { mealType?: MealType; planProductIds?: Set<ID>; usedCount?: Map<ID, number> } = {},
): Suggestion[] {
  const products = new Map(data.products.map((p) => [p.id, p]));
  const soon = new Date(today + 'T00:00:00');
  soon.setDate(soon.getDate() + 4);
  const soonISO = soon.toISOString().slice(0, 10);
  const out: Suggestion[] = [];
  for (const recipe of data.recipes) {
    if (opts.mealType && !recipe.mealTypes.includes(opts.mealType)) continue;
    if (dietConflicts(recipe, data.settings, products).length) continue;
    const stats = recipeStats(recipe, data, today, products);
    const pantryHits: string[] = [];
    const expiringHits: string[] = [];
    let shared = 0;
    for (const ing of recipe.ingredients) {
      const p = products.get(ing.productId);
      if (!p) continue;
      const items = data.pantry.filter((i) => i.productId === ing.productId && (!i.expiry || i.expiry >= today));
      if (items.length) {
        pantryHits.push(p.name);
        if (items.some((i) => i.expiry && i.expiry <= soonISO)) expiringHits.push(p.name);
      }
      if (opts.planProductIds?.has(ing.productId) && p.category !== 'Spices & sauces') shared++;
    }
    const used = opts.usedCount?.get(recipe.id) || 0;
    const score =
      Math.min(stats.protein, 50) * 1.2 +
      Math.min(stats.proteinPerR10, 40) * 0.8 -
      stats.costPerServing * 0.6 +
      pantryHits.length * 4 +
      expiringHits.length * 8 +
      shared * 3 -
      used * 18 -
      (recipe.prepMinutes > 40 ? 4 : 0);
    const reasons: string[] = [];
    if (expiringHits.length) reasons.push(`Uses ${expiringHits[0]} before it expires`);
    if (stats.protein >= 30) reasons.push(`${Math.round(stats.protein)} g protein`);
    if (pantryHits.length >= 2) reasons.push(`${pantryHits.length} ingredients in your pantry`);
    if (shared >= 2) reasons.push(`Shares ${shared} ingredients with your plan`);
    if (stats.costPerServing > 0 && stats.costPerServing <= 25) reasons.push(`Only R${stats.costPerServing.toFixed(0)} a serving`);
    out.push({ recipe, stats, score, pantryHits, expiringHits, sharedWithPlan: shared, reasons });
  }
  return out.sort((a, b) => b.score - a.score);
}
