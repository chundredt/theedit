import type { AppData, FoodEntry, ISODate, MealType, MyFood, Product } from './types';
import { parseIngredientText } from './ingredients';

/**
 * Food log: type what you ate ("2 eggs, toast, coffee with milk") and get calories and protein.
 * Lookup order for each item: foods you've logged before → common South African portions →
 * the ingredient database (per 100 g). Anything unknown is flagged so you can type it once.
 */

export interface FoodLine {
  /** What shows in the log, e.g. "2 eggs". */
  name: string;
  /** The food without the amount, used to remember it ("eggs"). */
  base: string;
  qty: number;
  kcal: number;
  protein: number;
  known: boolean;
}

// [name, match words (any one of these phrases), kcal, protein g] — per usual portion.
type Common = [string, string[], number, number];
export const COMMON_FOODS: Common[] = [
  ['Egg', ['egg', 'boiled egg', 'fried egg', 'scrambled egg'], 78, 6.3],
  ['Omelette (2 eggs)', ['omelette', 'omelet'], 190, 13],
  ['Toast (slice)', ['toast', 'slice bread', 'slices bread', 'bread'], 80, 3],
  ['Brown bread (slice)', ['brown bread', 'brown toast', 'wholewheat bread', 'seed loaf'], 75, 3.5],
  ['Butter (tsp)', ['butter', 'margarine', 'marge'], 34, 0],
  ['Peanut butter (tbsp)', ['peanut butter'], 95, 4],
  ['Jam (tbsp)', ['jam', 'honey', 'syrup'], 50, 0],
  ['Avocado (half)', ['avo', 'avocado'], 120, 1.5],
  ['Coffee with milk', ['coffee with milk', 'coffee', 'americano with milk'], 30, 1.5],
  ['Black coffee', ['black coffee', 'espresso', 'americano'], 3, 0.3],
  ['Cappuccino', ['cappuccino', 'flat white'], 110, 6],
  ['Latte', ['latte'], 150, 8],
  ['Tea with milk', ['tea with milk', 'tea'], 20, 1],
  ['Rooibos', ['rooibos', 'herbal tea', 'green tea'], 2, 0],
  ['Sugar (tsp)', ['sugar'], 16, 0],
  ['Milk (glass)', ['milk', 'glass of milk'], 160, 8],
  ['Oats with milk (bowl)', ['oats with milk', 'oatmeal with milk', 'porridge with milk'], 260, 11],
  ['Oats (bowl)', ['oats', 'oatmeal', 'porridge', 'jungle oats'], 150, 5],
  ['Weet-Bix (biscuit)', ['weetbix', 'weet bix', 'weet-bix'], 68, 2.4],
  ['Cereal with milk (bowl)', ['cereal', 'cornflakes', 'muesli', 'granola', 'pronutro'], 260, 9],
  ['Yoghurt (tub)', ['yoghurt', 'yogurt'], 150, 6],
  ['Greek yoghurt (150 g)', ['greek yoghurt', 'greek yogurt', 'double cream yoghurt'], 145, 13],
  ['Banana', ['banana'], 105, 1.3],
  ['Apple', ['apple'], 95, 0.5],
  ['Orange', ['orange', 'naartjie'], 62, 1.2],
  ['Pear', ['pear'], 100, 0.6],
  ['Grapes (cup)', ['grapes'], 104, 1],
  ['Berries (cup)', ['berries', 'strawberries', 'blueberries'], 60, 1],
  ['Fruit salad (bowl)', ['fruit salad', 'fruit'], 120, 1.5],
  ['Rice (cup cooked)', ['rice'], 205, 4],
  ['Pap (cup)', ['pap', 'mieliepap', 'mielie pap', 'phutu', 'stywe pap'], 190, 4],
  ['Pasta (cup cooked)', ['pasta', 'spaghetti', 'macaroni', 'penne', 'noodles'], 220, 8],
  ['Potato (medium)', ['potato', 'baked potato', 'mash', 'mashed potato'], 160, 4],
  ['Sweet potato', ['sweet potato'], 115, 2],
  ['Chips / fries (medium)', ['chips', 'fries', 'slap chips'], 365, 4],
  ['Crisps (packet)', ['crisps', 'packet of chips', 'simba', 'lays', 'nik naks'], 190, 2],
  ['Chicken breast (150 g)', ['chicken breast', 'grilled chicken', 'chicken fillet', 'chicken'], 250, 46],
  ['Chicken piece', ['drumstick', 'chicken thigh', 'chicken wing', 'chicken piece'], 190, 20],
  ['Rotisserie chicken (quarter)', ['rotisserie', 'roast chicken'], 330, 35],
  ['Mince (100 g cooked)', ['mince', 'beef mince'], 250, 26],
  ['Steak (200 g)', ['steak', 'rump', 'sirloin'], 500, 50],
  ['Boerewors (100 g)', ['boerewors', 'wors', 'sausage'], 290, 14],
  ['Lamb chop', ['lamb chop', 'chop', 'chops'], 230, 18],
  ['Fish (150 g)', ['fish', 'hake', 'snoek', 'kingklip'], 135, 27],
  ['Salmon (150 g)', ['salmon'], 310, 30],
  ['Tuna (tin)', ['tuna'], 140, 30],
  ['Pilchards (half tin)', ['pilchards', 'sardines'], 200, 20],
  ['Biltong (50 g)', ['biltong'], 125, 27],
  ['Droëwors (50 g)', ['droewors', 'droëwors', 'dry wors'], 230, 15],
  ['Beans (cup)', ['beans', 'baked beans', 'chickpeas', 'lentils'], 230, 14],
  ['Cheese (slice)', ['cheese', 'cheddar', 'gouda'], 70, 5],
  ['Cottage cheese (half cup)', ['cottage cheese'], 110, 13],
  ['Salad (side)', ['salad', 'side salad', 'green salad'], 50, 2],
  ['Veg (cup)', ['veg', 'vegetables', 'veggies', 'broccoli', 'spinach', 'carrots', 'butternut', 'pumpkin', 'green beans'], 50, 2],
  ['Chicken salad', ['chicken salad'], 350, 30],
  ['Cheese sandwich', ['cheese sandwich', 'toastie', 'cheese toastie'], 320, 14],
  ['Chicken mayo sandwich', ['chicken mayo', 'chicken sandwich', 'sandwich'], 400, 20],
  ['Wrap (chicken)', ['wrap', 'chicken wrap'], 450, 28],
  ['Burger', ['burger', 'cheeseburger'], 550, 28],
  ['Pizza (slice)', ['pizza'], 285, 12],
  ['Chicken curry (cup)', ['chicken curry', 'curry'], 300, 25],
  ['Lentil curry (cup)', ['lentil curry', 'dhal', 'dal'], 230, 12],
  ['Stew (cup)', ['stew', 'potjie', 'bredie'], 300, 22],
  ['Spaghetti bolognese (plate)', ['bolognese', 'spag bol'], 550, 28],
  ['Mac and cheese (cup)', ['mac and cheese', 'macaroni cheese'], 400, 16],
  ['Stir-fry (plate)', ['stir fry', 'stir-fry'], 400, 25],
  ['Soup (bowl)', ['soup'], 200, 8],
  ['Bunny chow (quarter)', ['bunny chow', 'bunny'], 700, 25],
  ['Vetkoek', ['vetkoek'], 250, 5],
  ['Samoosa', ['samoosa', 'samosa'], 150, 4],
  ['Sushi (piece)', ['sushi'], 45, 2],
  ['Protein shake', ['protein shake', 'whey', 'shake'], 120, 24],
  ['Protein bar', ['protein bar'], 200, 20],
  ['Rusk', ['rusk', 'ouma rusk'], 120, 2],
  ['Biscuit', ['biscuit', 'cookie', 'marie biscuit'], 70, 1],
  ['Muffin', ['muffin'], 400, 6],
  ['Croissant', ['croissant'], 230, 5],
  ['Chocolate (bar)', ['chocolate', 'chocolate bar', 'bar one', 'kitkat'], 230, 3],
  ['Sweets (handful)', ['sweets', 'jelly tots', 'wine gums'], 150, 1],
  ['Popcorn (bowl)', ['popcorn'], 150, 4],
  ['Nuts (handful)', ['nuts', 'almonds', 'cashews', 'peanuts', 'trail mix'], 180, 6],
  ['Hummus (2 tbsp)', ['hummus'], 70, 2],
  ['Smoothie', ['smoothie'], 250, 6],
  ['Soft drink (can)', ['coke', 'cola', 'fanta', 'sprite', 'soft drink', 'cooldrink', 'soda'], 140, 0],
  ['Juice (glass)', ['juice', 'orange juice'], 110, 1],
  ['Wine (glass)', ['wine'], 125, 0],
  ['Beer', ['beer', 'lager', 'cider'], 150, 1.5],
  ['Water', ['water', 'sparkling water'], 0, 0],
];

const WORD_NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, half: 0.5, 'a half': 0.5 };
const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3 };
const PORTION_WORDS = /\b(slices?|cups?|bowls?|glass(?:es)?|plates?|pieces?|handfuls?|tubs?|cans?|tins?|packets?|scoops?|mugs?|tbsp|tablespoons?|tsp|teaspoons?|portions?|servings?|of)\b/gi;

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9ëé\s-]/g, ' ').replace(/\s+/g, ' ').trim();
const singular = (w: string) => (w.length > 3 && w.endsWith('es') && /(ch|sh|ss|x|o)es$/.test(w) ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
const words = (s: string) => norm(s).split(' ').filter(Boolean).map(singular);

/** Split "2 eggs, toast and coffee" into items, keeping dishes like "mac and cheese" whole. */
export function splitItems(text: string): string[] {
  let t = text;
  for (const c of COMMON_FOODS) for (const ph of c[1]) if (ph.includes(' and ')) t = t.replace(new RegExp(ph.replace(/ and /g, '\\s+and\\s+'), 'gi'), (m) => m.replace(/\s+and\s+/i, '_and_'));
  return t
    .split(/\r?\n|,|;|\+|\band\b|&/i)
    .map((s) => s.replace(/_and_/g, ' and ').trim())
    .filter((s) => /[a-z]/i.test(s));
}

/** Leading amount: "2 eggs" → 2, "half a sandwich" → 0.5, "150g chicken" → grams 150. */
export function readAmount(item: string): { qty: number; grams?: number; rest: string } {
  let t = item.trim();
  const g = t.match(/^(\d+(?:[.,]\d+)?)\s*(g|gr|grams?|ml)\b\s*(?:of\s+)?/i);
  if (g) return { qty: 1, grams: Number(g[1].replace(',', '.')), rest: t.slice(g[0].length) };
  const n = t.match(/^(\d+(?:[.,]\d+)?|[½¼¾⅓])\s*(?:x\s*)?/i);
  let qty = 1;
  if (n) {
    qty = FRACTIONS[n[1]] ?? Number(n[1].replace(',', '.'));
    t = t.slice(n[0].length);
  } else {
    const w = t.match(/^(a half|half|an|a|one|two|three|four|five|six)\b\s*/i);
    if (w) {
      qty = WORD_NUM[w[1].toLowerCase()];
      t = t.slice(w[0].length);
      if (qty === 0.5) t = t.replace(/^(a|an)\s+/i, '');
    }
  }
  return { qty: qty > 0 ? qty : 1, rest: t };
}

function phraseIn(hay: string[], phrase: string): boolean {
  const p = words(phrase);
  if (!p.length) return false;
  for (let i = 0; i + p.length <= hay.length; i++) if (p.every((w, j) => hay[i + j] === w)) return true;
  return false;
}

/** Best common food for some words: the longest matching phrase wins ("chicken curry" over "chicken"). */
export function matchCommon(text: string): Common | undefined {
  const hay = words(text.replace(PORTION_WORDS, ' '));
  let best: { c: Common; len: number } | undefined;
  for (const c of COMMON_FOODS) for (const ph of c[1]) {
    const len = words(ph).length;
    if (phraseIn(hay, ph) && (!best || len > best.len)) best = { c, len };
  }
  return best?.c;
}

function matchMine(base: string, mine: MyFood[]): MyFood | undefined {
  const b = norm(base);
  return mine.find((m) => norm(m.name) === b) || mine.find((m) => norm(m.name) === words(base).join(' '));
}

const round = (n: number) => Math.round(n);
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Read one typed item into calories and protein. */
export function readItem(item: string, mine: MyFood[], products: Product[]): FoodLine {
  const { qty, grams, rest } = readAmount(item);
  const base = rest.replace(PORTION_WORDS, ' ').replace(/\s+/g, ' ').trim() || rest.trim();
  const name = item.trim().charAt(0).toUpperCase() + item.trim().slice(1);
  const known = matchMine(base, mine);
  if (known) {
    const k = grams && known.grams ? grams / known.grams : qty;
    return { name, base, qty: k, kcal: round(known.kcal * k), protein: round1(known.protein * k), known: true };
  }
  // A weight given ("150g chicken") is best answered per 100 g from the ingredient list.
  if (grams) {
    const p = parseIngredientText(`${grams}g ${base}`, products)[0];
    const prod = p?.productId ? products.find((x) => x.id === p.productId) : undefined;
    if (prod?.nutrition) return { name, base, qty: 1, kcal: round((prod.nutrition.kcal * grams) / 100), protein: round1((prod.nutrition.protein * grams) / 100), known: true };
  }
  const c = matchCommon(rest);
  if (c) return { name, base, qty, kcal: round(c[2] * qty), protein: round1(c[3] * qty), known: true };
  const p = parseIngredientText(item, products)[0];
  const prod = p?.productId ? products.find((x) => x.id === p.productId) : undefined;
  if (prod?.nutrition && p.grams > 0) return { name, base, qty, kcal: round((prod.nutrition.kcal * p.grams) / 100), protein: round1((prod.nutrition.protein * p.grams) / 100), known: true };
  return { name, base, qty, kcal: 0, protein: 0, known: false };
}

export function readFoodText(text: string, mine: MyFood[], products: Product[]): FoodLine[] {
  return splitItems(text).map((i) => readItem(i, mine, products));
}

/** Remember a food per single portion so the next "2 x" scales from it. */
export function rememberFoods(mine: MyFood[], lines: { base: string; qty: number; kcal: number; protein: number }[], date: ISODate): MyFood[] {
  const out = [...mine];
  for (const l of lines) {
    if (!l.base) continue;
    const q = l.qty > 0 ? l.qty : 1;
    const i = out.findIndex((m) => norm(m.name) === norm(l.base));
    const rec = { name: l.base, kcal: Math.round(l.kcal / q), protein: round1(l.protein / q), lastUsed: date };
    if (i >= 0) out[i] = { ...out[i], ...rec, uses: (out[i].uses || 0) + 1 };
    else out.push({ id: `mf-${norm(l.base).replace(/\s/g, '-')}`, uses: 1, ...rec });
  }
  return out;
}

export interface DayTotals { kcal: number; protein: number; plannedKcal: number; plannedProtein: number; count: number }

export function dayTotals(log: FoodEntry[], date: ISODate): DayTotals {
  const t: DayTotals = { kcal: 0, protein: 0, plannedKcal: 0, plannedProtein: 0, count: 0 };
  for (const e of log) {
    if (e.date !== date) continue;
    t.count++;
    if (e.eaten) { t.kcal += e.kcal; t.protein += e.protein; }
    else { t.plannedKcal += e.kcal; t.plannedProtein += e.protein; }
  }
  t.protein = round1(t.protein);
  t.plannedProtein = round1(t.plannedProtein);
  return t;
}

export const entriesFor = (log: FoodEntry[], date: ISODate, meal?: MealType) => log.filter((e) => e.date === date && (!meal || e.meal === meal));

/** Average eaten calories and protein over the days in a list that have anything logged. */
export function averageOver(log: FoodEntry[], dates: ISODate[]): { kcal: number; protein: number; days: number } {
  const totals = dates.map((d) => dayTotals(log, d)).filter((t) => t.kcal > 0);
  if (!totals.length) return { kcal: 0, protein: 0, days: 0 };
  return {
    kcal: Math.round(totals.reduce((a, t) => a + t.kcal, 0) / totals.length),
    protein: Math.round(totals.reduce((a, t) => a + t.protein, 0) / totals.length),
    days: totals.length,
  };
}

/** One-tap choices: favourites first, then foods used most recently. */
export function quickPicks(data: Pick<AppData, 'foodLog' | 'myFoods'>, limit = 12): { name: string; kcal: number; protein: number; favourite: boolean }[] {
  const seen = new Set<string>();
  const out: { name: string; kcal: number; protein: number; favourite: boolean }[] = [];
  const add = (name: string, kcal: number, protein: number, favourite: boolean) => {
    const k = norm(name);
    if (seen.has(k) || out.length >= limit) return;
    seen.add(k);
    out.push({ name, kcal, protein, favourite });
  };
  for (const m of data.myFoods || []) if (m.favourite) add(m.name, m.kcal, m.protein, true);
  // Latest day first; within a day, the most recently added first.
  const order = data.foodLog.map((e, i) => ({ e, i })).sort((a, b) => b.e.date.localeCompare(a.e.date) || b.i - a.i);
  for (const { e } of order) add(e.name, e.kcal, e.protein, false);
  return out;
}
