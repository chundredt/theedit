import { create } from 'zustand';
import type {
  AppData, Budget, Catalogue, Category, ID, IncomeLine, ISODate, MealPlanWeek, MealSlot, MealType, PantryItem,
  PeriodKey, PriceRecord, Product, Recipe, SavingsGoal, Settings, Store, Transaction, WeekKey,
} from '../domain/types';
import { demoData, emptyData, PALETTE } from './seed';
import { LocalStorageAdapter, type StorageAdapter } from './storage';
import { migrate } from './migrations';
import { resolveBudget } from '../domain/budget';
import { emptyWeek, buildShoppingList, weeklyNeeds } from '../domain/shopping';
import { uid } from '../lib/id';
import { round2, todayISO } from '../lib/format';
import { groceryCategory } from '../domain/budget';
import { daysLeft, periodKeyFor, shiftPeriod } from '../domain/period';

/** "Today" — overridable with ?today=YYYY-MM-DD for testing and demos. */
export function getToday(): ISODate {
  try {
    const q = new URLSearchParams(location.search).get('today');
    if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
  } catch {
    /* not in a browser */
  }
  return todayISO();
}

export interface Toast {
  id: string;
  message: string;
  tone?: 'default' | 'error';
  undo?: AppData;
}

interface State {
  data: AppData;
  saveError: boolean;
  toasts: Toast[];
  toast(message: string, opts?: { tone?: Toast['tone']; undo?: AppData }): void;
  dismissToast(id: string): void;
  restore(snapshot: AppData): void;
  /** Apply a change to a copy of the data and persist it. */
  mutate(fn: (d: AppData) => void, undoLabel?: string): void;

  updateSettings(p: Partial<Settings>): void;
  // Categories & budgets
  addCategory(c: Omit<Category, 'id' | 'color'> & { color?: string }, key?: PeriodKey, amount?: number): ID;
  updateCategory(id: ID, p: Partial<Category>): void;
  deleteCategory(id: ID, moveTo?: ID): void;
  setAllocation(key: PeriodKey, categoryId: ID, amount: number): void;
  setIncome(key: PeriodKey, lines: IncomeLine[]): void;
  markIncome(key: PeriodKey, lineId: ID, received: number | undefined, date?: ISODate): void;
  copyBudget(from: PeriodKey, to: PeriodKey): void;
  // Transactions
  addTransaction(t: Omit<Transaction, 'id' | 'createdAt'>): ID;
  updateTransaction(id: ID, p: Partial<Transaction>): void;
  deleteTransaction(id: ID): void;
  // Goals
  saveGoal(g: Omit<SavingsGoal, 'id' | 'createdAt' | 'color'> & { id?: ID; color?: string }): ID;
  deleteGoal(id: ID): void;
  contribute(goalId: ID, amount: number, date: ISODate, note?: string): void;
  // Food
  saveStore(s: Omit<Store, 'id'> & { id?: ID }): ID;
  deleteStore(id: ID): void;
  saveProduct(p: Omit<Product, 'id'> & { id?: ID }): ID;
  deleteProduct(id: ID): void;
  savePrice(p: Omit<PriceRecord, 'id'> & { id?: ID }): ID;
  addPrices(list: Omit<PriceRecord, 'id'>[], catalogue?: Omit<Catalogue, 'id' | 'itemCount'>): void;
  deletePrice(id: ID): void;
  saveCatalogue(c: Omit<Catalogue, 'id'> & { id?: ID }): void;
  deleteCatalogue(id: ID): void;
  saveRecipe(r: Omit<Recipe, 'id'> & { id?: ID }): ID;
  deleteRecipe(id: ID): void;
  setSlot(week: WeekKey, day: number, meal: MealType, slot: MealSlot | null): void;
  setWeek(plan: MealPlanWeek): void;
  toggleShopping(week: WeekKey, productId: ID): void;
  setStoreOverride(week: WeekKey, productId: ID, storeId: ID): void;
  addExtra(week: WeekKey, name: string): void;
  toggleExtra(week: WeekKey, id: ID): void;
  removeExtra(week: WeekKey, id: ID): void;
  completeShop(week: WeekKey, spend: { storeId: ID; amount: number }[], date: ISODate, opts: { leftovers: boolean; deductPantry: boolean }): void;
  savePantry(p: Omit<PantryItem, 'id' | 'addedOn'> & { id?: ID; addedOn?: ISODate }): void;
  deletePantry(id: ID): void;
  // Whole-data
  loadDemo(): void;
  startFresh(setup?: { salary: number; commission: number; allowance: number; grocery: number; startDay: number; name?: string }): void;
  importData(json: string): void;
}

let adapter: StorageAdapter = new LocalStorageAdapter();
export function setStorageAdapter(a: StorageAdapter) {
  adapter = a;
}

function initialData(): AppData {
  const loaded = adapter.load();
  return loaded || emptyData(getToday());
}

function ensureBudget(d: AppData, key: PeriodKey): Budget {
  if (!d.budgets[key]) {
    const { inherited: _i, ...b } = resolveBudget(d, key);
    d.budgets[key] = b;
  }
  return d.budgets[key];
}

function ensureShopping(d: AppData, week: WeekKey) {
  if (!d.shopping[week]) d.shopping[week] = { week, checked: [], storeOverride: {}, extras: [] };
  return d.shopping[week];
}

const nextColor = (used: string[]) => PALETTE.find((c) => !used.includes(c)) || PALETTE[used.length % PALETTE.length];

export const useStore = create<State>((set, get) => {
  const commit = (data: AppData) => {
    try {
      adapter.save(data);
      set({ data, saveError: false });
    } catch {
      set({ data, saveError: true });
    }
  };
  const mutate: State['mutate'] = (fn, undoLabel) => {
    const before = get().data;
    const draft = structuredClone(before);
    fn(draft);
    commit(draft);
    if (undoLabel) get().toast(undoLabel, { undo: before });
  };

  return {
    data: initialData(),
    saveError: false,
    toasts: [],
    toast(message, opts = {}) {
      const id = uid();
      set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, ...opts }] }));
      setTimeout(() => get().dismissToast(id), opts.undo ? 6000 : 3200);
    },
    dismissToast(id) {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    },
    restore(snapshot) {
      commit(snapshot);
    },
    mutate,

    updateSettings(p) {
      mutate((d) => void Object.assign(d.settings, p));
    },

    addCategory(c, key, amount) {
      const id = uid();
      mutate((d) => {
        d.categories.push({ ...c, id, color: c.color || nextColor(d.categories.filter((x) => x.group === c.group).map((x) => x.color)) });
        if (key && amount) ensureBudget(d, key).allocations[id] = round2(amount);
      });
      return id;
    },
    updateCategory(id, p) {
      mutate((d) => {
        const c = d.categories.find((x) => x.id === id);
        if (c) Object.assign(c, p);
      });
    },
    deleteCategory(id, moveTo) {
      const name = get().data.categories.find((c) => c.id === id)?.name;
      mutate((d) => {
        d.categories = d.categories.filter((c) => c.id !== id);
        for (const b of Object.values(d.budgets)) delete b.allocations[id];
        if (moveTo) d.transactions.forEach((t) => t.categoryId === id && (t.categoryId = moveTo));
        else d.transactions = d.transactions.filter((t) => t.categoryId !== id);
        d.goals.forEach((g) => g.categoryId === id && (g.categoryId = undefined));
      }, `Deleted “${name}”`);
    },
    setAllocation(key, categoryId, amount) {
      mutate((d) => {
        ensureBudget(d, key).allocations[categoryId] = Math.max(0, round2(amount || 0));
      });
    },
    setIncome(key, lines) {
      mutate((d) => {
        ensureBudget(d, key).income = lines.map((l) => ({ ...l, amount: Math.max(0, round2(l.amount || 0)) }));
      });
    },
    markIncome(key, lineId, received, date) {
      mutate((d) => {
        const line = ensureBudget(d, key).income.find((l) => l.id === lineId);
        if (!line) return;
        if (received === undefined) {
          delete line.received;
          delete line.receivedOn;
        } else {
          line.received = Math.max(0, round2(received));
          line.receivedOn = date || getToday();
        }
      });
    },
    copyBudget(from, to) {
      mutate((d) => {
        const src = resolveBudget(d, from);
        d.budgets[to] = { period: to, income: src.income.map(({ received: _r, receivedOn: _o, ...i }) => ({ ...i, id: uid() })), allocations: { ...src.allocations } };
      });
    },

    addTransaction(t) {
      const id = uid();
      mutate((d) => {
        d.transactions.unshift({ ...t, amount: round2(t.amount), id, createdAt: new Date().toISOString() });
      });
      return id;
    },
    updateTransaction(id, p) {
      mutate((d) => {
        const t = d.transactions.find((x) => x.id === id);
        if (t) Object.assign(t, p, p.amount !== undefined ? { amount: round2(p.amount) } : {});
      });
    },
    deleteTransaction(id) {
      const t = get().data.transactions.find((x) => x.id === id);
      mutate((d) => {
        d.transactions = d.transactions.filter((x) => x.id !== id);
      }, `Deleted “${t?.description || 'transaction'}”`);
    },

    saveGoal(g) {
      const id = g.id || uid();
      mutate((d) => {
        const existing = d.goals.find((x) => x.id === id);
        if (existing) Object.assign(existing, g);
        else d.goals.push({ ...g, id, color: g.color || nextColor(d.goals.map((x) => x.color)), createdAt: getToday() } as SavingsGoal);
      });
      return id;
    },
    deleteGoal(id) {
      const g = get().data.goals.find((x) => x.id === id);
      mutate((d) => {
        d.goals = d.goals.filter((x) => x.id !== id);
        d.transactions.forEach((t) => t.goalId === id && delete t.goalId);
      }, `Deleted goal “${g?.name}” (its transfers stay in your transactions)`);
    },
    contribute(goalId, amount, date, note) {
      mutate((d) => {
        const g = d.goals.find((x) => x.id === goalId);
        if (!g) return;
        const cat = d.categories.find((c) => c.id === g.categoryId) || d.categories.find((c) => c.group === 'savings');
        if (!cat) return;
        d.transactions.unshift({
          id: uid(), date, amount: round2(amount), description: amount >= 0 ? `Saved towards ${g.name}` : `Withdrew from ${g.name}`,
          categoryId: cat.id, method: 'EFT', goalId, notes: note, createdAt: new Date().toISOString(),
        });
      });
    },

    saveStore(s) {
      const id = s.id || uid();
      mutate((d) => {
        const e = d.stores.find((x) => x.id === id);
        if (e) Object.assign(e, s);
        else d.stores.push({ ...s, id });
      });
      return id;
    },
    deleteStore(id) {
      mutate((d) => {
        d.stores = d.stores.filter((s) => s.id !== id);
        d.prices = d.prices.filter((p) => p.storeId !== id);
        d.catalogues = d.catalogues.filter((c) => c.storeId !== id);
      }, 'Store and its prices deleted');
    },
    saveProduct(p) {
      const id = p.id || uid();
      mutate((d) => {
        const e = d.products.find((x) => x.id === id);
        if (e) Object.assign(e, p);
        else d.products.push({ ...p, id });
      });
      return id;
    },
    deleteProduct(id) {
      const name = get().data.products.find((p) => p.id === id)?.name;
      mutate((d) => {
        d.products = d.products.filter((p) => p.id !== id);
        d.prices = d.prices.filter((p) => p.productId !== id);
        d.pantry = d.pantry.filter((p) => p.productId !== id);
        d.recipes.forEach((r) => (r.ingredients = r.ingredients.filter((i) => i.productId !== id)));
      }, `Deleted “${name}”`);
    },
    savePrice(p) {
      const id = p.id || uid();
      mutate((d) => {
        const e = d.prices.find((x) => x.id === id);
        if (e) Object.assign(e, p);
        else d.prices.push({ ...p, id });
      });
      return id;
    },
    addPrices(list, catalogue) {
      mutate((d) => {
        for (const p of list) d.prices.push({ ...p, id: uid() });
        if (catalogue) d.catalogues.unshift({ ...catalogue, id: uid(), itemCount: list.length });
      });
    },
    deletePrice(id) {
      mutate((d) => {
        d.prices = d.prices.filter((p) => p.id !== id);
      }, 'Price deleted');
    },
    saveCatalogue(c) {
      const id = c.id || uid();
      mutate((d) => {
        const e = d.catalogues.find((x) => x.id === id);
        if (e) Object.assign(e, c);
        else d.catalogues.unshift({ ...c, id });
      });
    },
    deleteCatalogue(id) {
      mutate((d) => {
        d.catalogues = d.catalogues.filter((c) => c.id !== id);
      }, 'Catalogue removed');
    },
    saveRecipe(r) {
      const id = r.id || uid();
      mutate((d) => {
        const e = d.recipes.find((x) => x.id === id);
        if (e) Object.assign(e, r);
        else d.recipes.push({ ...r, id, custom: true });
      });
      return id;
    },
    deleteRecipe(id) {
      const name = get().data.recipes.find((r) => r.id === id)?.name;
      mutate((d) => {
        d.recipes = d.recipes.filter((r) => r.id !== id);
        for (const w of Object.values(d.mealPlans)) w.days.forEach((day) => (Object.keys(day) as MealType[]).forEach((m) => day[m]?.recipeId === id && delete day[m]));
      }, `Deleted “${name}”`);
    },
    setSlot(week, day, meal, slot) {
      mutate((d) => {
        const plan = d.mealPlans[week] || (d.mealPlans[week] = emptyWeek(week));
        if (slot) plan.days[day][meal] = slot;
        else delete plan.days[day][meal];
      });
    },
    setWeek(plan) {
      mutate((d) => {
        d.mealPlans[plan.week] = plan;
      });
    },
    toggleShopping(week, productId) {
      mutate((d) => {
        const s = ensureShopping(d, week);
        s.checked = s.checked.includes(productId) ? s.checked.filter((x) => x !== productId) : [...s.checked, productId];
      });
    },
    setStoreOverride(week, productId, storeId) {
      mutate((d) => {
        ensureShopping(d, week).storeOverride[productId] = storeId;
      });
    },
    addExtra(week, name) {
      mutate((d) => {
        ensureShopping(d, week).extras.push({ id: uid(), name, checked: false });
      });
    },
    toggleExtra(week, id) {
      mutate((d) => {
        const e = ensureShopping(d, week).extras.find((x) => x.id === id);
        if (e) e.checked = !e.checked;
      });
    },
    removeExtra(week, id) {
      mutate((d) => {
        const s = ensureShopping(d, week);
        s.extras = s.extras.filter((x) => x.id !== id);
      });
    },
    completeShop(week, spend, date, opts) {
      mutate((d) => {
        const cat = groceryCategory(d);
        const plan = d.mealPlans[week];
        const s = ensureShopping(d, week);
        const list = buildShoppingList(d, plan, date, s.storeOverride);
        const needs = weeklyNeeds(d, plan, date);
        for (const e of spend) {
          if (!(e.amount > 0) || !cat) continue;
          const store = d.stores.find((x) => x.id === e.storeId);
          d.transactions.unshift({
            id: uid(), date, amount: round2(e.amount), description: `${store?.name || 'Grocery'} shop (meal plan)`,
            categoryId: cat.id, method: 'Debit card', storeId: e.storeId, createdAt: new Date().toISOString(),
          });
        }
        if (opts.deductPantry) {
          // The week's meals use up what was already at home.
          for (const n of needs) {
            let use = Math.min(n.required, n.inPantry);
            for (const item of d.pantry.filter((p) => p.productId === n.product.id && (!p.expiry || p.expiry >= date)).sort((a, b) => (a.expiry || '9').localeCompare(b.expiry || '9'))) {
              if (use <= 0) break;
              const take = Math.min(item.quantity, use);
              item.quantity -= take;
              use -= take;
            }
          }
          d.pantry = d.pantry.filter((p) => p.quantity > 0.5);
        }
        if (opts.leftovers) {
          for (const it of list.items) {
            if (it.leftover > 0 && s.checked.includes(it.product.id))
              d.pantry.push({ id: uid(), productId: it.product.id, quantity: it.leftover, addedOn: date });
          }
        }
        s.completedOn = date;
      });
      get().toast('Shop recorded — grocery budget and pantry updated');
    },
    savePantry(p) {
      mutate((d) => {
        const id = p.id || uid();
        const e = d.pantry.find((x) => x.id === id);
        if (e) Object.assign(e, p);
        else d.pantry.push({ ...p, id, addedOn: p.addedOn || getToday() });
      });
    },
    deletePantry(id) {
      mutate((d) => {
        d.pantry = d.pantry.filter((p) => p.id !== id);
      }, 'Removed from pantry');
    },

    loadDemo() {
      commit(demoData(getToday()));
    },
    startFresh(setup) {
      const d = emptyData(getToday());
      d.settings.onboarded = true;
      if (setup) {
        d.settings.periodStartDay = setup.startDay;
        d.settings.name = setup.name || '';
        // Defaults are only suggestions; a fresh start keeps categories but no amounts except groceries.
        const key = periodKeyFor(getToday(), setup.startDay);
        const upcoming = daysLeft(key, setup.startDay, getToday()) <= 5 ? shiftPeriod(key, 1) : null;
        d.budgets[key] = {
          period: key,
          income: [
            { name: 'Salary', kind: 'salary' as const, amount: setup.salary },
            { name: 'Commission', kind: 'commission' as const, amount: setup.commission },
            { name: 'Allowance', kind: 'allowance' as const, amount: setup.allowance },
          ].filter((l) => l.amount > 0).map((l) => ({ ...l, id: uid(), amount: round2(l.amount), payDay: setup.startDay })),
          allocations: setup.grocery > 0 ? { groceries: round2(setup.grocery) } : {},
        };
        if (upcoming) d.budgets[upcoming] = { ...structuredClone(d.budgets[key]), period: upcoming };
      }
      commit(d);
    },
    importData(json) {
      const parsed = JSON.parse(json);
      if (!parsed || !Array.isArray(parsed.transactions) || !parsed.settings || !Array.isArray(parsed.categories)) throw new Error('This file is not a RandWise backup.');
      const base = emptyData(getToday());
      commit(migrate({ ...base, ...parsed }));
    },
  };
});


export const useData = () => useStore((s) => s.data);
