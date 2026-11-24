import type { DietTag, Nutrition, Product, ProductCategory } from './types';
import { matchProduct, tokens } from './flyer';

/**
 * Turn a typed or pasted ingredient list into grams per product.
 * Understands "500g chicken breast", "2 onions", "1 tin chopped tomatoes", "1 cup rice",
 * "2 tbsp oil", "½ tsp salt", "1.5 kg potatoes", and "salt to taste".
 */
export interface ParsedIngredient {
  line: string;
  name: string;
  grams: number;
  productId?: string;
  /** True when grams were estimated from a cup/piece rather than given. */
  estimated: boolean;
}

const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };
const UNIT = '(kg|kilograms?|g|grams?|gr|ml|millilitres?|l|litres?|liters?|cups?|c|tbsp|tablespoons?|tbs|T|tsp|teaspoons?|t|tins?|cans?|packs?|packets?|punnets?|bunch(?:es)?|cloves?|slices?|x)';
const LINE_RE = new RegExp(`^\\s*(\\d+(?:[.,]\\d+)?(?:\\s*\\/\\s*\\d+)?|[½¼¾⅓⅔]|\\d+\\s*[½¼¾])?\\s*${UNIT}?\\b\\.?\\s*(?:of\\s+)?(.+)$`, 'i');

function num(s?: string): number | undefined {
  if (!s) return undefined;
  const t = s.replace(/\s+/g, '');
  const mixed = t.match(/^(\d+)([½¼¾])$/);
  if (mixed) return Number(mixed[1]) + FRACTIONS[mixed[2]];
  if (FRACTIONS[t] !== undefined) return FRACTIONS[t];
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

/** Grams in one cup for common foods (a cup of rice weighs far less than a cup of milk). */
function cupGrams(p?: Product): number {
  const n = (p?.name || '').toLowerCase();
  if (/oat|muesli|cereal/.test(n)) return 90;
  if (/flour|maize|meal/.test(n)) return 125;
  if (/rice|lentil|quinoa|samp|bean|chickpea|pea/.test(n)) return 190;
  if (/sugar/.test(n)) return 200;
  if (/milk|yoghurt|cream|stock|water|oil|sauce|juice/.test(n)) return 240;
  if (/cheese|cheddar|mozzarella|feta/.test(n)) return 110;
  if (/spinach|lettuce|cabbage/.test(n)) return 40;
  return 150;
}

export function parseIngredientText(text: string, products: Product[]): ParsedIngredient[] {
  const parts = text
    .split(/\r?\n|,(?![^(]*\))|;/)
    .map((l) => l.replace(/^[-•*·\d.)\s]*(?=\d|[a-z½¼¾])/i, (m) => (/^\d/.test(m.trim()) && /\d+[.)]\s/.test(m) ? '' : m)).trim())
    .filter((l) => /[a-z]/i.test(l));
  const out: ParsedIngredient[] = [];
  for (const line of parts) {
    const toTaste = /to taste|pinch|dash|a little|optional/i.test(line);
    const m = line.match(LINE_RE);
    const qty = num(m?.[1]);
    const unit = (m?.[2] || '').toLowerCase();
    let name = (m?.[3] || line)
      .replace(/\(.*?\)/g, ' ')
      .replace(/\b(to taste|pinch of|dash of|a little|optional|chopped|diced|sliced|grated|minced|crushed|fresh|large|medium|small|drained|rinsed|peeled|cooked|raw|finely|roughly)\b/gi, ' ')
      .replace(/\s{2,}/g, ' ')
      .replace(/^[\s,-]+|[\s,-]+$/g, '');
    if (!name) continue;
    // Match on the full wording ("chopped tomatoes"), display without the prep words.
    const matchName = (m?.[3] || line).replace(/\(.*?\)/g, ' ').replace(/\b(to taste|pinch of|dash of|a little|optional)\b/gi, ' ').trim() || name;
    // "1 tin chopped tomatoes" should find the tinned product, not fresh tomatoes.
    const tinned = /^(tins?|cans?)$/.test(unit) ? matchProduct(matchName, products.filter((p) => p.category === 'Tins & jars')) : undefined;
    const match = tinned && tinned.confidence >= 0.45 ? tinned : matchProduct(matchName, products);
    const product = match.confidence >= 0.45 ? products.find((p) => p.id === match.id) : undefined;
    let grams = 0;
    let estimated = true;
    const q = qty ?? 1;
    if (/^(kg|kilograms?)$/.test(unit)) { grams = q * 1000; estimated = false; }
    else if (/^(g|grams?|gr)$/.test(unit)) { grams = q; estimated = false; }
    else if (/^(l|litres?|liters?)$/.test(unit)) { grams = q * 1000; estimated = false; }
    else if (/^(ml|millilitres?)$/.test(unit)) { grams = q; estimated = false; }
    else if (/^(cups?|c)$/.test(unit)) grams = q * cupGrams(product);
    else if (/^(tbsp|tablespoons?|tbs)$/.test(unit) || m?.[2] === 'T') grams = q * 15;
    else if (/^(tsp|teaspoons?|t)$/.test(unit)) grams = q * 5;
    else if (/^(tins?|cans?|packs?|packets?|punnets?)$/.test(unit)) grams = q * (product?.packSize ?? 400);
    else if (/^bunch/.test(unit)) grams = q * (product?.packSize ?? 200);
    else if (/^cloves?$/.test(unit)) grams = q * 5;
    else if (/^slices?$/.test(unit)) grams = q * (product?.pieceGrams ?? 30);
    else if (toTaste && qty === undefined) grams = 2;
    else grams = q * (product?.pieceGrams ?? (qty !== undefined && qty >= 20 ? 1 : 100));
    if (qty !== undefined && qty >= 20 && !unit) estimated = false; // "500 chicken" — assume grams
    out.push({ line, name: product ? product.name : name.charAt(0).toUpperCase() + name.slice(1), grams: Math.round(grams), productId: product?.id, estimated });
  }
  return out;
}

/** Best guess at aisle and diet tags for a new ingredient from its name. */
export function guessProduct(name: string): { category: ProductCategory; tags: DietTag[]; packSize: number } {
  const n = name.toLowerCase();
  const tags: DietTag[] = [];
  if (/bacon|pork|ham|gammon|salami|chorizo|boerewors|sausage/.test(n)) tags.push('meat', 'pork');
  else if (/chicken|beef|lamb|mince|steak|biltong|wors|turkey|liver|oxtail/.test(n)) tags.push('meat');
  if (/fish|hake|tuna|salmon|pilchard|sardine|prawn|shrimp|snoek|calamari/.test(n)) tags.push('fish');
  if (/milk|cheese|yoghurt|yogurt|cream|butter|feta|mozzarella|parmesan|amasi/.test(n)) tags.push('dairy');
  if (/\begg/.test(n)) tags.push('egg');
  if (/bread|flour|pasta|noodle|wrap|roll|couscous|biscuit|cracker|soy sauce/.test(n)) tags.push('gluten');
  const category: ProductCategory = tags.includes('meat') || tags.includes('fish') ? 'Meat & fish'
    : tags.includes('dairy') || tags.includes('egg') ? 'Dairy & eggs'
    : /sauce|spice|powder|salt|pepper|paprika|cumin|masala|herb|seasoning|vinegar|mustard|chutney|stock/.test(n) ? 'Spices & sauces'
    : /tin|can|canned|beans|jar/.test(n) ? 'Tins & jars'
    : /frozen/.test(n) ? 'Frozen'
    : /bread|roll|wrap|bun/.test(n) ? 'Bakery'
    : /rice|pasta|flour|oats|lentil|sugar|oil|honey|maize|quinoa|nuts?\b|seeds?/.test(n) ? 'Pantry staples'
    : /apple|banana|orange|lemon|lime|berry|grape|mango|pear|tomato|onion|garlic|potato|carrot|spinach|lettuce|pepper|cabbage|broccoli|mushroom|avocado|herb|ginger|chilli|coriander|parsley|basil|cucumber|marrow|pumpkin|butternut/.test(n) ? 'Fruit & veg'
    : 'Other';
  const packSize = category === 'Spices & sauces' ? 200 : category === 'Meat & fish' ? 500 : 500;
  return { category, tags, packSize };
}

/** Quick estimate from the closest ingredient you already have (used while the online lookup runs, or offline). */
export function nutritionFromSimilar(name: string, products: Product[]): Nutrition | undefined {
  const words = new Set(tokens(name));
  let best: { p: Product; score: number } | undefined;
  for (const p of products) {
    if (!p.nutrition || (p.nutrition.kcal === 0 && p.nutrition.protein === 0)) continue;
    const t = tokens(p.name);
    const hit = t.filter((x) => words.has(x)).length;
    const score = hit / Math.max(t.length, 1);
    if (hit && (!best || score > best.score)) best = { p, score };
  }
  return best && best.score >= 0.5 ? { ...best.p.nutrition! } : undefined;
}

/** Pick sensible per-100 g values from Open Food Facts search results: the median of products with full data. */
export function pickNutrition(products: { nutriments?: Record<string, number | string>; countries_tags?: string[] }[]): Nutrition | undefined {
  const rows = products
    .map((p) => {
      const n = p.nutriments || {};
      const v = (k: string) => Number(n[k]);
      const kcal = v('energy-kcal_100g') || (v('energy_100g') ? v('energy_100g') / 4.184 : NaN);
      return { sa: !!p.countries_tags?.includes('en:south-africa'), kcal, protein: v('proteins_100g'), carbs: v('carbohydrates_100g'), fat: v('fat_100g') };
    })
    .filter((r) => [r.kcal, r.protein, r.carbs, r.fat].every((x) => Number.isFinite(x) && x >= 0) && r.kcal <= 900);
  if (!rows.length) return undefined;
  const pool = rows.filter((r) => r.sa).length >= 2 ? rows.filter((r) => r.sa) : rows;
  const med = (k: 'kcal' | 'protein' | 'carbs' | 'fat') => {
    const xs = pool.map((r) => r[k]).sort((a, b) => a - b);
    const m = xs[Math.floor(xs.length / 2)];
    return Math.round(m * 10) / 10;
  };
  return { kcal: Math.round(med('kcal')), protein: med('protein'), carbs: med('carbs'), fat: med('fat') };
}

/** Look up nutrition per 100 g in Open Food Facts (free, open food database). Resolves undefined if offline or nothing found. */
export async function lookupNutrition(name: string, timeoutMs = 9000): Promise<Nutrition | undefined> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(name)}&search_simple=1&action=process&json=1&page_size=12&fields=product_name,nutriments,countries_tags`;
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return undefined;
    const json = await res.json();
    return pickNutrition(json.products || []);
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}
