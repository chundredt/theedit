import type { AppData, Category, DietTag, PriceRecord, Product, ProductCategory, Recipe, MealType, Settings, Store, Transaction, PaymentMethod } from '../domain/types';
import { CURRENT_VERSION } from './migrations';
import { addDays, mondayOf, round2 } from '../lib/format';
import { dueDateInPeriod, periodKeyFor, periodStart, shiftPeriod, periodEnd } from '../domain/period';
import { autoFillWeek, emptyWeek } from '../domain/shopping';
import { uid } from '../lib/id';
import { extraProducts } from './seed-ingredients';
import { defaultRoutines, defaultSchedule, demoWellness } from './seed-wellness';

// Chart palette — validated for colour-blind separation (see docs/ARCHITECTURE.md).
export const PALETTE = ['#3F8F5A', '#3A78C4', '#D2663E', '#A15BB0', '#C98F0A', '#14A3A0', '#5A55C8', '#DB5E7E'];

type CatSeed = [id: string, name: string, group: Category['group'], amount: number, dueDay?: number, pay?: PaymentMethod];
const CATEGORY_SEED: CatSeed[] = [
  ['rent', 'Rent / bond', 'fixed', 8500, 1, 'EFT'],
  ['utilities', 'Electricity & water', 'fixed', 1400, 7, 'EFT'],
  ['medical', 'Medical aid', 'fixed', 2100, 1, 'Debit order'],
  ['insurance', 'Insurance', 'fixed', 650, 3, 'Debit order'],
  ['car', 'Car payment', 'fixed', 3800, 5, 'Debit order'],
  ['gym', 'Gym', 'fixed', 450, 1, 'Debit order'],
  ['subs', 'Subscriptions', 'fixed', 320, 15, 'Credit card'],
  ['cc', 'Credit card repayment', 'fixed', 1200, 25, 'Debit order'],
  ['cell', 'Cellphone & data', 'fixed', 499, 20, 'Debit order'],
  ['groceries', 'Groceries', 'variable', 3200],
  ['fuel', 'Fuel & transport', 'variable', 2200],
  ['eatout', 'Eating out & takeaways', 'variable', 900],
  ['clothing', 'Clothing', 'variable', 500],
  ['beauty', 'Beauty & personal care', 'variable', 450],
  ['entertainment', 'Entertainment', 'variable', 400],
  ['shopping', 'Shopping', 'variable', 400],
  ['misc', 'Miscellaneous', 'variable', 300],
  ['sav-emergency', 'Emergency fund', 'savings', 1500],
  ['sav-holiday', 'Holiday savings', 'savings', 700],
  ['sav-personal', 'Personal savings', 'savings', 500],
  ['sav-yearly', 'Yearly costs fund', 'savings', 0],
  ['sav-other', 'Other savings goals', 'savings', 0],
];

export function defaultCategories(): Category[] {
  const counters = { fixed: 0, variable: 0, savings: 0 };
  return CATEGORY_SEED.map(([id, name, group, , dueDay, pay]) => ({
    id,
    name,
    group,
    color: PALETTE[(counters[group]++ + (group === 'variable' ? 2 : group === 'savings' ? 5 : 0)) % PALETTE.length],
    dueDay,
    payMethod: pay,
    role: id === 'groceries' ? ('groceries' as const) : undefined,
  }));
}

export const DEFAULT_STORES: Store[] = [
  { id: 'checkers', name: 'Checkers', color: '#3A78C4', website: 'https://www.checkers.co.za/specials' },
  { id: 'flm', name: "Food Lover's Market", color: '#C98F0A', website: 'https://foodloversmarket.co.za/specials/' },
  { id: 'woolworths', name: 'Woolworths', color: '#3F8F5A', website: 'https://www.woolworths.co.za/cat/Food/_/N-1z13sk5' },
];

// [id, name, category, packSize g/ml, kcal, protein, carbs, fat (per 100 g), tags, checkers, flm, woolworths, piece?]
type ProdSeed = [string, string, ProductCategory, number, number, number, number, number, DietTag[], number | null, number | null, number | null, [number, string]?];
const PRODUCT_SEED: ProdSeed[] = [
  ['chicken-breast', 'Chicken breast fillets', 'Meat & fish', 1000, 120, 23, 0, 2.6, ['meat'], 99.99, 94.99, 129.99],
  ['chicken-thighs', 'Chicken thighs', 'Meat & fish', 1000, 177, 18, 0, 11.5, ['meat'], 74.99, 69.99, 94.99],
  ['beef-mince', 'Lean beef mince', 'Meat & fish', 500, 200, 20, 0, 13, ['meat'], 69.99, 64.99, 89.99],
  ['hake', 'Hake fillets (frozen)', 'Frozen', 800, 86, 18, 0, 1.3, ['fish'], 89.99, 94.99, 119.99],
  ['tuna', 'Tuna chunks in brine (tin)', 'Tins & jars', 170, 116, 26, 0, 1, ['fish'], 26.99, 27.99, 34.99],
  ['pilchards', 'Pilchards in tomato sauce', 'Tins & jars', 400, 140, 17, 2.5, 7, ['fish'], 29.99, 31.99, 36.99],
  ['biltong', 'Beef biltong (lean)', 'Snacks', 100, 300, 56, 2, 6, ['meat'], 54.99, 49.99, 69.99],
  ['eggs', 'Large eggs (18)', 'Dairy & eggs', 900, 143, 12.6, 0.7, 9.5, ['egg'], 74.99, 69.99, 84.99, [50, 'egg']],
  ['milk', 'Low-fat milk 2 L', 'Dairy & eggs', 2000, 46, 3.4, 4.8, 1.5, ['dairy'], 34.99, 33.99, 38.99],
  ['yoghurt', 'Plain low-fat yoghurt 1 kg', 'Dairy & eggs', 1000, 63, 5.3, 7, 1.6, ['dairy'], 39.99, 37.99, 44.99],
  ['cottage-cheese', 'Cottage cheese', 'Dairy & eggs', 250, 98, 11, 3.4, 4.3, ['dairy'], 29.99, 31.99, 34.99],
  ['cheddar', 'Cheddar cheese', 'Dairy & eggs', 400, 403, 25, 1.3, 33, ['dairy'], 79.99, 74.99, 94.99],
  ['lentils', 'Brown lentils (dry)', 'Pantry staples', 500, 352, 25, 60, 1.1, [], 27.99, 24.99, 34.99],
  ['chickpeas', 'Chickpeas (tin)', 'Tins & jars', 400, 120, 7, 18, 2.5, [], 17.99, 16.99, 22.99],
  ['baked-beans', 'Baked beans in tomato sauce', 'Tins & jars', 410, 85, 4.8, 14, 0.4, [], 18.99, 19.99, 21.99],
  ['soya-mince', 'Soya mince', 'Pantry staples', 200, 340, 50, 30, 1, [], 19.99, 22.99, null],
  ['oats', 'Rolled oats', 'Pantry staples', 1000, 380, 13, 60, 7, ['gluten'], 39.99, 42.99, 49.99],
  ['maize-meal', 'Super maize meal', 'Pantry staples', 2500, 360, 8, 77, 1.5, [], 44.99, 46.99, 59.99],
  ['rice', 'White rice', 'Pantry staples', 2000, 360, 7, 80, 0.6, [], 52.99, 49.99, 69.99],
  ['pasta', 'Pasta (penne)', 'Pantry staples', 500, 355, 12, 72, 1.5, ['gluten'], 22.99, 21.99, 29.99],
  ['bread', 'Brown bread', 'Bakery', 700, 240, 9, 43, 3, ['gluten'], 18.99, 19.99, 24.99, [35, 'slice']],
  ['wraps', 'Tortilla wraps (6)', 'Bakery', 480, 300, 8, 50, 7, ['gluten'], 34.99, 32.99, 42.99, [80, 'wrap']],
  ['potatoes', 'Potatoes', 'Fruit & veg', 2000, 77, 2, 17, 0.1, [], 39.99, 32.99, 49.99],
  ['sweet-potato', 'Sweet potatoes', 'Fruit & veg', 1000, 86, 1.6, 20, 0.1, [], 29.99, 24.99, 36.99],
  ['butternut', 'Butternut', 'Fruit & veg', 1000, 45, 1, 11.7, 0.1, [], 22.99, 17.99, 29.99],
  ['onions', 'Onions', 'Fruit & veg', 1000, 40, 1.1, 9, 0.1, [], 24.99, 19.99, 29.99, [150, 'onion']],
  ['tomatoes', 'Tomatoes', 'Fruit & veg', 1000, 18, 0.9, 3.9, 0.2, [], 34.99, 26.99, 44.99, [120, 'tomato']],
  ['carrots', 'Carrots', 'Fruit & veg', 1000, 41, 0.9, 10, 0.2, [], 19.99, 16.99, 26.99],
  ['spinach', 'Baby spinach', 'Fruit & veg', 200, 23, 2.9, 3.6, 0.4, [], 24.99, 19.99, 32.99],
  ['cabbage', 'Cabbage', 'Fruit & veg', 1500, 25, 1.3, 5.8, 0.1, [], 22.99, 17.99, 29.99],
  ['mushrooms', 'Button mushrooms', 'Fruit & veg', 250, 22, 3.1, 3.3, 0.3, [], 27.99, 22.99, 32.99],
  ['peppers', 'Green peppers', 'Fruit & veg', 450, 20, 0.9, 4.6, 0.2, [], 24.99, 19.99, 29.99, [150, 'pepper']],
  ['garlic', 'Garlic', 'Fruit & veg', 150, 149, 6.4, 33, 0.5, [], 14.99, 12.99, 19.99, [5, 'clove']],
  ['bananas', 'Bananas', 'Fruit & veg', 1000, 89, 1.1, 23, 0.3, [], 26.99, 21.99, 32.99, [120, 'banana']],
  ['apples', 'Apples', 'Fruit & veg', 1500, 52, 0.3, 14, 0.2, [], 34.99, 29.99, 44.99, [150, 'apple']],
  ['mixed-veg', 'Frozen mixed vegetables', 'Frozen', 1000, 65, 3, 11, 0.5, [], 44.99, 47.99, 54.99],
  ['chopped-tomatoes', 'Chopped tomatoes (tin)', 'Tins & jars', 410, 20, 1, 3.5, 0.2, [], 16.99, 15.99, 21.99],
  ['chakalaka', 'Chakalaka (tin)', 'Tins & jars', 410, 60, 2, 10, 1.5, [], 17.99, 18.99, null],
  ['peanut-butter', 'Peanut butter', 'Pantry staples', 400, 590, 25, 20, 50, [], 39.99, 42.99, 49.99],
  ['peanuts', 'Salted peanuts', 'Snacks', 400, 590, 26, 16, 50, [], 39.99, 37.99, 49.99],
  ['popcorn', 'Popcorn kernels', 'Snacks', 500, 375, 11, 74, 4, [], 24.99, 26.99, 34.99],
  ['honey', 'Honey', 'Pantry staples', 375, 304, 0.3, 82, 0, [], 54.99, 59.99, 69.99],
  ['oil', 'Sunflower oil', 'Pantry staples', 2000, 884, 0, 0, 100, [], 69.99, 64.99, 79.99],
  ['curry-powder', 'Curry powder', 'Spices & sauces', 100, 325, 12, 58, 14, [], 24.99, 22.99, 34.99],
  ['braai-spice', 'Braai spice', 'Spices & sauces', 200, 200, 6, 35, 4, [], 34.99, 32.99, 44.99],
  ['stock', 'Stock cubes (12)', 'Spices & sauces', 120, 220, 10, 25, 9, ['gluten'], 24.99, 25.99, 32.99],
];

export function defaultProducts(): Product[] {
  return PRODUCT_SEED.map(([id, name, category, packSize, kcal, protein, carbs, fat, tags, , , , piece]): Product => ({
    id,
    name,
    category,
    packSize,
    nutrition: { kcal, protein, carbs, fat },
    tags,
    pieceGrams: piece?.[0],
    pieceLabel: piece?.[1],
  })).concat(extraProducts());
}

/**
 * Sample prices so recipe costs and shopping lists work immediately. They are tagged
 * source "sample" with an old verified date, and the UI tells you to verify them.
 */
export function samplePrices(today: string): PriceRecord[] {
  const verified = addDays(today, -40);
  const out: PriceRecord[] = [];
  const stores = ['checkers', 'flm', 'woolworths'];
  for (const row of PRODUCT_SEED) {
    const prices = [row[9], row[10], row[11]];
    prices.forEach((price, i) => {
      if (price == null) return;
      out.push({ id: `p-${row[0]}-${stores[i]}`, productId: row[0], storeId: stores[i], price, packSize: row[3], isSpecial: false, verifiedOn: verified, source: 'sample' });
    });
  }
  const special = (productId: string, storeId: string, price: number, ends: number, packSize?: number, label?: string): PriceRecord => {
    const prod = PRODUCT_SEED.find((p) => p[0] === productId)!;
    return {
      id: `s-${productId}-${storeId}`,
      productId,
      storeId,
      price,
      packSize: packSize || prod[3],
      isSpecial: true,
      specialEnds: addDays(today, ends),
      verifiedOn: addDays(today, -2),
      source: 'sample',
      label,
    };
  };
  out.push(
    special('chicken-breast', 'checkers', 84.99, 5),
    special('beef-mince', 'checkers', 59.99, 2),
    special('tuna', 'checkers', 22.5, 6, undefined, 'Any 2 for R45'),
    special('tomatoes', 'flm', 19.99, 3),
    special('bananas', 'flm', 16.99, 4),
    special('potatoes', 'flm', 27.99, 5),
    special('eggs', 'woolworths', 64.99, 6),
    special('yoghurt', 'woolworths', 34.99, 3),
    { ...special('cheddar', 'checkers', 64.99, -3), id: 's-cheddar-expired' },
  );
  return out;
}

type RecipeSeed = [string, string, string, MealType[], number, number, [string, number][], string[], string[]];
const RECIPE_SEED: RecipeSeed[] = [
  ['protein-oats', 'Peanut butter banana oats', '🥣', ['breakfast'], 1, 7, [['oats', 60], ['milk', 250], ['bananas', 120], ['peanut-butter', 15], ['honey', 8]],
    ['Bring the milk and oats to a simmer, stirring, for 4–5 minutes.', 'Slice the banana on top, add the peanut butter and a drizzle of honey.'], ['Budget', 'Quick']],
  ['egg-scramble', 'Spinach & tomato egg scramble on toast', '🍳', ['breakfast', 'lunch'], 1, 10, [['eggs', 150], ['spinach', 40], ['tomatoes', 60], ['bread', 70], ['oil', 5]],
    ['Wilt the spinach and chopped tomato in the oil.', 'Add whisked eggs and stir gently until just set.', 'Serve on toasted bread.'], ['High protein', 'Quick']],
  ['yoghurt-bowl', 'Yoghurt, oats & apple bowl', '🍎', ['breakfast', 'snack'], 1, 5, [['yoghurt', 200], ['oats', 40], ['apples', 150], ['honey', 8]],
    ['Dice the apple.', 'Layer yoghurt, oats and apple; finish with honey.'], ['No cook', 'Quick']],
  ['cottage-toast', 'Cottage cheese & tomato toast', '🍞', ['breakfast', 'snack'], 1, 5, [['bread', 70], ['cottage-cheese', 125], ['tomatoes', 80]],
    ['Toast the bread.', 'Top with cottage cheese, sliced tomato, salt and pepper.'], ['Quick', 'High protein']],
  ['omelette', 'Mushroom & cheddar omelette', '🍳', ['breakfast', 'lunch'], 1, 10, [['eggs', 150], ['mushrooms', 80], ['cheddar', 20], ['spinach', 30], ['oil', 5]],
    ['Fry the sliced mushrooms until golden.', 'Pour in the whisked eggs, add spinach and grated cheddar, fold and serve.'], ['High protein', 'Low carb']],
  ['chicken-stirfry', 'Chicken & veg stir-fry with rice', '🥘', ['lunch', 'dinner'], 4, 25, [['chicken-breast', 600], ['mixed-veg', 400], ['onions', 150], ['garlic', 10], ['rice', 300], ['oil', 20], ['stock', 10]],
    ['Cook the rice.', 'Fry sliced chicken in oil over high heat until browned.', 'Add onion, garlic and frozen veg; stir-fry 5 minutes.', 'Crumble in the stock cube with a splash of water and toss. Serve with rice.'], ['High protein', 'Meal prep']],
  ['mince-lentil-bolognaise', 'Beef & lentil bolognaise', '🍝', ['lunch', 'dinner'], 6, 40, [['beef-mince', 500], ['lentils', 150], ['chopped-tomatoes', 820], ['onions', 150], ['carrots', 150], ['garlic', 10], ['pasta', 500], ['oil', 15], ['stock', 10]],
    ['Brown the mince with onion, garlic and grated carrot.', 'Add lentils, tomatoes, stock and 500 ml water; simmer 25 minutes until lentils are soft.', 'Cook the pasta and serve with the sauce.'], ['Budget', 'Meal prep', 'Freezes well']],
  ['tuna-pasta', 'Creamy tuna pasta salad', '🐟', ['lunch'], 2, 15, [['tuna', 340], ['pasta', 160], ['peppers', 150], ['yoghurt', 100], ['onions', 40]],
    ['Cook and cool the pasta.', 'Mix drained tuna, diced pepper, onion and yoghurt; season.', 'Fold through the pasta.'], ['High protein', 'Lunchbox']],
  ['pilchard-fishcakes', 'Pilchard fishcakes & sweet potato mash', '🐟', ['dinner'], 4, 30, [['pilchards', 400], ['eggs', 100], ['oats', 60], ['onions', 150], ['sweet-potato', 800], ['oil', 30]],
    ['Boil and mash the sweet potato.', 'Mash pilchards (sauce drained) with egg, oats and grated onion; shape 8 cakes.', 'Pan-fry in oil 3–4 minutes a side.'], ['Budget', 'Omega-3']],
  ['chicken-curry', 'Chicken & potato curry', '🍛', ['dinner'], 4, 45, [['chicken-thighs', 1000], ['onions', 300], ['chopped-tomatoes', 410], ['potatoes', 500], ['curry-powder', 20], ['garlic', 15], ['oil', 20], ['rice', 300]],
    ['Fry onion, garlic and curry powder in oil.', 'Add chicken and brown; add tomatoes, cubed potato and 250 ml water.', 'Simmer covered 30 minutes. Serve with rice.'], ['Family favourite', 'Freezes well']],
  ['lentil-chickpea-curry', 'Lentil & chickpea curry', '🍛', ['lunch', 'dinner'], 4, 35, [['lentils', 200], ['chickpeas', 400], ['chopped-tomatoes', 410], ['onions', 150], ['spinach', 100], ['curry-powder', 15], ['garlic', 10], ['oil', 15], ['rice', 300]],
    ['Fry onion, garlic and curry powder.', 'Add lentils, tomatoes and 700 ml water; simmer 20 minutes.', 'Stir in chickpeas and spinach; cook 5 minutes. Serve with rice.'], ['Vegetarian', 'Budget']],
  ['pap-chakalaka', 'Braai-spiced chicken, pap & chakalaka', '🔥', ['dinner'], 4, 40, [['maize-meal', 400], ['chakalaka', 820], ['chicken-thighs', 1000], ['braai-spice', 15], ['oil', 10]],
    ['Rub chicken with oil and braai spice; roast at 200 °C for 35 minutes (or braai).', 'Cook stiff pap with 1.2 L salted water.', 'Heat the chakalaka and serve together.'], ['Proudly SA', 'High protein']],
  ['soya-cottage-pie', 'Soya mince cottage pie', '🥧', ['dinner'], 4, 50, [['soya-mince', 200], ['onions', 150], ['carrots', 150], ['mixed-veg', 200], ['chopped-tomatoes', 410], ['potatoes', 1000], ['milk', 100], ['stock', 10], ['cheddar', 60], ['oil', 15]],
    ['Soak soya mince in 400 ml hot stock for 10 minutes.', 'Fry onion and carrot, add soya, veg and tomatoes; simmer 10 minutes.', 'Top with mashed potato (with milk), sprinkle cheese, bake 20 minutes at 200 °C.'], ['Vegetarian', 'Budget']],
  ['chicken-wraps', 'Spicy chicken wraps', '🌯', ['lunch'], 2, 15, [['chicken-breast', 300], ['wraps', 160], ['peppers', 100], ['onions', 50], ['yoghurt', 60], ['spinach', 40], ['oil', 10], ['braai-spice', 5]],
    ['Fry sliced chicken, pepper and onion with braai spice.', 'Fill wraps with spinach, chicken and a spoon of yoghurt.'], ['High protein', 'Quick']],
  ['hake-traybake', 'Oven hake, wedges & veg', '🐟', ['dinner'], 2, 35, [['hake', 400], ['potatoes', 500], ['mixed-veg', 300], ['oil', 20], ['garlic', 5]],
    ['Roast potato wedges in oil at 220 °C for 20 minutes.', 'Add hake and veg to the tray with garlic; roast 12–15 minutes more.'], ['Lean', 'One tray']],
  ['butternut-soup', 'Butternut & chickpea soup', '🥣', ['lunch'], 4, 40, [['butternut', 1000], ['chickpeas', 400], ['onions', 150], ['carrots', 150], ['stock', 10], ['garlic', 10], ['oil', 15]],
    ['Fry onion and garlic; add cubed butternut, carrot, stock and 1 L water.', 'Simmer 25 minutes, add chickpeas and blend until smooth.'], ['Vegetarian', 'Freezes well']],
  ['beef-bean-chilli', 'Beef & bean chilli with rice', '🌶️', ['dinner'], 4, 35, [['beef-mince', 500], ['baked-beans', 410], ['chopped-tomatoes', 410], ['onions', 150], ['peppers', 150], ['garlic', 10], ['rice', 300], ['oil', 15], ['braai-spice', 10]],
    ['Brown the mince with onion, pepper, garlic and spice.', 'Add beans and tomatoes; simmer 20 minutes.', 'Serve with rice.'], ['Meal prep', 'High protein']],
  ['cabbage-mince', 'Mince & cabbage stir-fry', '🥬', ['lunch', 'dinner'], 4, 25, [['beef-mince', 500], ['cabbage', 600], ['onions', 150], ['carrots', 150], ['garlic', 10], ['oil', 15], ['stock', 10]],
    ['Brown the mince with onion and garlic.', 'Add shredded cabbage, grated carrot and stock; stir-fry until tender.'], ['Low carb', 'Budget']],
  ['chicken-traybake', 'Chicken, potato & carrot tray bake', '🍗', ['dinner'], 4, 50, [['chicken-thighs', 1000], ['potatoes', 800], ['carrots', 300], ['onions', 300], ['oil', 25], ['braai-spice', 15]],
    ['Toss everything with oil and spice on a large tray.', 'Roast at 200 °C for 45 minutes, turning once.'], ['One tray', 'Family favourite']],
  ['biltong-apple', 'Biltong & an apple', '🥩', ['snack'], 1, 1, [['biltong', 40], ['apples', 150]], ['Slice and enjoy.'], ['High protein', 'No cook']],
  ['pb-banana-toast', 'Peanut butter banana toast', '🍌', ['snack', 'breakfast'], 1, 4, [['bread', 35], ['peanut-butter', 15], ['bananas', 120]], ['Toast, spread and top with banana.'], ['Quick']],
  ['popcorn', 'Stovetop popcorn', '🍿', ['snack'], 2, 8, [['popcorn', 60], ['oil', 10]], ['Heat oil, add kernels, cover and shake until popping slows. Salt to taste.'], ['Budget']],
  ['boiled-eggs', 'Boiled eggs', '🥚', ['snack'], 1, 10, [['eggs', 100]], ['Boil 9 minutes, cool in cold water and peel.'], ['High protein', 'Meal prep']],
  ['yoghurt-banana', 'Yoghurt & banana', '🍌', ['snack'], 1, 2, [['yoghurt', 175], ['bananas', 120]], ['Slice banana over the yoghurt.'], ['No cook']],
];

export function defaultRecipes(): Recipe[] {
  return RECIPE_SEED.map(([id, name, emoji, mealTypes, servings, prepMinutes, ings, steps, tags]) => ({
    id,
    name,
    emoji,
    mealTypes,
    servings,
    prepMinutes,
    ingredients: ings.map(([productId, grams]) => ({ productId, grams })),
    steps,
    tags,
  }));
}

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  periodStartDay: 1,
  householdSize: 1,
  diet: 'none',
  dairyFree: false,
  glutenFree: false,
  excludedProducts: [],
  kcalTarget: 2000,
  proteinTarget: 120,
  preferredStores: ['checkers', 'flm', 'woolworths'],
  onboarded: false,
};

/** A blank workspace: default categories, stores, products, sample prices and recipes; no money data. */
export function emptyData(today: string): AppData {
  return {
    version: CURRENT_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    categories: defaultCategories(),
    budgets: {},
    transactions: [],
    goals: [],
    stores: DEFAULT_STORES.map((s) => ({ ...s })),
    products: defaultProducts(),
    prices: samplePrices(today),
    catalogues: [],
    recipes: defaultRecipes(),
    mealPlans: {},
    shopping: {},
    pantry: [],
    habits: [],
    habitLogs: {},
    routines: defaultRoutines(),
    workoutSchedule: defaultSchedule(),
    workoutLogs: [],
    resets: {},
    challenges: {},
    storeFactors: {},
  };
}

/** Deterministic pseudo-random so the demo looks the same every time. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Three months of realistic demo data ending today. */
export function demoData(today: string): AppData {
  const data = emptyData(today);
  data.settings = { ...data.settings, onboarded: true, periodStartDay: 25 };
  const rand = rng(42);
  const sd = data.settings.periodStartDay;
  const current = periodKeyFor(today, sd);
  const allocations = Object.fromEntries(CATEGORY_SEED.map(([id, , , amt]) => [id, amt]));
  const txs: Transaction[] = [];
  const add = (date: string, description: string, amount: number, categoryId: string, method: PaymentMethod, extra: Partial<Transaction> = {}) =>
    txs.push({ id: uid(), date, description, amount: round2(amount), categoryId, method, createdAt: `${date}T12:00:00`, ...extra });

  const goals = [
    { id: 'goal-emergency', name: 'Emergency fund (3 months)', target: 30000, openingBalance: 8000, targetDate: addDays(today, 420), monthlyContribution: 1500, categoryId: 'sav-emergency', color: PALETTE[0], createdAt: today },
    { id: 'goal-holiday', name: 'Drakensberg weekend away', target: 9000, openingBalance: 2500, targetDate: addDays(today, 300), monthlyContribution: 700, categoryId: 'sav-holiday', color: PALETTE[1], createdAt: today },
    { id: 'goal-laptop', name: 'New laptop', target: 15000, openingBalance: 1000, targetDate: addDays(today, 200), monthlyContribution: 500, categoryId: 'sav-personal', color: PALETTE[3], createdAt: today },
  ];
  data.goals = [
    ...goals,
    { id: 'y-licence', name: 'Car licence disc', emoji: '🚗', kind: 'yearly', repeats: true, target: 650, openingBalance: 400, targetDate: addDays(today, 45), monthlyContribution: 125, categoryId: 'sav-yearly', color: PALETTE[4], createdAt: today },
    { id: 'y-service', name: 'Car service', emoji: '🔧', kind: 'yearly', repeats: true, target: 3500, openingBalance: 1200, targetDate: addDays(today, 150), monthlyContribution: 460, categoryId: 'sav-yearly', color: PALETTE[5], createdAt: today },
    { id: 'y-xmas', name: 'Christmas & gifts', emoji: '🎁', kind: 'yearly', repeats: true, target: 3000, openingBalance: 2200, targetDate: addDays(today, 21), monthlyContribution: 400, categoryId: 'sav-yearly', color: PALETTE[7], createdAt: today },
  ] as typeof goals;

  const groceryStores = ['checkers', 'flm', 'woolworths'] as const;
  const storeName = { checkers: 'Checkers', flm: "Food Lover's Market", woolworths: 'Woolworths' };
  for (let back = 2; back >= 0; back--) {
    const key = shiftPeriod(current, -back);
    data.budgets[key] = {
      period: key,
      income: [
        { id: `inc-salary-${key}`, name: 'Salary', kind: 'salary', amount: 24500, payDay: 25, received: 24500, receivedOn: periodStart(key, 25) },
        { id: `inc-comm-${key}`, name: 'Commission', kind: 'commission', amount: 4000, payDay: 25, received: [3150, 5120, 4380][2 - back], receivedOn: periodStart(key, 25) },
        { id: `inc-allow-${key}`, name: 'Car allowance', kind: 'allowance', amount: 1500, payDay: 25, received: 1500, receivedOn: periodStart(key, 25) },
      ],
      allocations: { ...allocations, ...(back === 2 ? { eatout: 800 } : {}) },
    };
    const start = periodStart(key, sd);
    const end = periodEnd(key, sd);
    const last = back === 0 ? today : end;
    const within = (iso: string) => iso >= start && iso <= last;

    // Fixed costs on their due dates.
    for (const [id, name, group, amt, dueDay, pay] of CATEGORY_SEED) {
      if (group !== 'fixed' || !dueDay) continue;
      const due = dueDateInPeriod(key, sd, dueDay);
      if (!within(due)) continue;
      const amount = id === 'utilities' ? amt * (0.85 + rand() * 0.3) : id === 'subs' ? 319.97 : amt;
      add(due, id === 'subs' ? 'Netflix, Spotify & iCloud' : name, amount, id, pay || 'Debit order');
    }
    // Groceries: a main shop each week plus top-ups.
    for (let d = start, i = 0; d <= last; d = addDays(d, 1), i++) {
      const dow = new Date(d + 'T00:00:00').getDay();
      if (dow === 6) {
        const store = groceryStores[Math.floor(rand() * 2)];
        add(d, `${storeName[store]} weekly shop`, 520 + rand() * 260, 'groceries', 'Debit card', { storeId: store });
      } else if (dow === 3 && rand() > 0.35) {
        add(d, `Woolworths top-up`, 90 + rand() * 120, 'groceries', 'Tap / mobile pay', { storeId: 'woolworths' });
      }
      if (dow === 1 || (dow === 4 && rand() > 0.85)) add(d, rand() > 0.5 ? 'Engen fuel' : 'Shell fuel', 380 + rand() * 140, 'fuel', 'Debit card');
      if ((dow === 5 || dow === 0) && rand() > 0.7)
        add(d, ['Nando’s', 'Mugg & Bean', 'Uber Eats', 'Spur', 'Kauai'][Math.floor(rand() * 5)], 90 + rand() * 110, 'eatout', 'Credit card');
      if (dow === 2 && rand() > 0.8) add(d, 'Clicks', 80 + rand() * 180, 'beauty', 'Debit card');
      if (dow === 6 && rand() > 0.75) add(d, ['Ster-Kinekor', 'Computicket'][Math.floor(rand() * 2)], 120 + rand() * 150, 'entertainment', 'Credit card');
      void i;
    }
    if (within(addDays(start, 9))) add(addDays(start, 9), back === 0 ? 'Mr Price' : 'Woolworths clothing', 280 + rand() * 300, 'clothing', 'Store card');
    if (within(addDays(start, 13))) add(addDays(start, 13), 'Takealot order', 180 + rand() * 260, 'shopping', 'Credit card');
    if (within(addDays(start, 16))) add(addDays(start, 16), 'Parking & tolls', 60 + rand() * 90, 'misc', 'Tap / mobile pay');
    if (back === 0 && within(addDays(start, 18))) add(addDays(start, 18), 'Birthday dinner', 640, 'eatout', 'Credit card');
    // Savings transfers on payday + 1.
    const sDay = addDays(start, 1);
    if (within(sDay)) {
      add(sDay, 'Transfer to emergency fund', 1500, 'sav-emergency', 'EFT', { goalId: 'goal-emergency' });
      add(sDay, 'Transfer to holiday pot', 700, 'sav-holiday', 'EFT', { goalId: 'goal-holiday' });
      if (back !== 0) add(sDay, 'Transfer to laptop savings', 500, 'sav-personal', 'EFT', { goalId: 'goal-laptop' });
    }
  }
  data.transactions = txs.sort((a, b) => b.date.localeCompare(a.date));

  data.pantry = [
    ['eggs', 300, 6], ['oats', 600, 120], ['rice', 1200, 200], ['onions', 450, 14], ['chopped-tomatoes', 410, 300], ['spinach', 100, 2],
    ['curry-powder', 80, 180], ['oil', 1500, 200], ['garlic', 60, 20], ['stock', 80, 300], ['pasta', 250, 250],
  ].map(([productId, quantity, days]) => ({ id: uid(), productId: productId as string, quantity: quantity as number, expiry: addDays(today, days as number), addedOn: addDays(today, -5) }));

  const week = mondayOf(today);
  data.mealPlans[week] = autoFillWeek(data, emptyWeek(week), today, 1, ['breakfast', 'lunch', 'dinner']);
  data.catalogues = [
    { id: uid(), storeId: 'checkers', title: 'Checkers weekly specials (link only)', url: 'https://www.checkers.co.za/specials', addedOn: today, itemCount: 0, validFrom: addDays(today, -3), validTo: addDays(today, 5) },
  ];
  demoWellness(data, today);
  return data;
}
