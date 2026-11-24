import { describe, expect, it } from 'vitest';
import { money, parseAmount, fmtDate, mondayOf } from '../lib/format';
import { periodKeyFor, periodStart, periodEnd, daysLeft, dueDateInPeriod, periodDays } from './period';
import { summarize, resolveBudget } from './budget';
import { groceryOverview } from './grocery';
import { emptyData, demoData } from '../data/seed';
import type { AppData, Transaction } from './types';
import { recipeStats, dietConflicts } from './recipes';
import { buildShoppingList, weeklyNeeds, emptyWeek, autoFillWeek } from './shopping';
import { storePrices, activeSpecials } from './prices';
import { goalProgress, monthsUntil } from './savings';
import { parseCatalogueText, parseSize } from './flyer';

const TODAY = '2026-11-24';
const tx = (p: Partial<Transaction>): Transaction => ({ id: Math.random().toString(), date: TODAY, description: 'x', amount: 0, categoryId: 'groceries', method: 'Debit card', createdAt: '', ...p });

function setup(): AppData {
  const d = emptyData(TODAY);
  d.budgets['2026-11'] = {
    period: '2026-11',
    income: [{ id: 'i', name: 'Salary', amount: 20000 }],
    allocations: { rent: 7000, medical: 2000, groceries: 2000, eatout: 500, 'sav-emergency': 1000 },
  };
  return d;
}

describe('formatting', () => {
  it('formats rand', () => {
    expect(money(2000)).toBe('R2,000.00');
    expect(money(-12.5)).toBe('−R12.50');
    expect(money(1234567.891, { cents: false })).toBe('R1,234,568');
  });
  it('parses SA-style amounts', () => {
    expect(parseAmount('2000')).toBe(2000);
    expect(parseAmount('R 2 000,50')).toBe(2000.5);
    expect(parseAmount('2,000.50')).toBe(2000.5);
    expect(parseAmount('1,250')).toBe(1250);
    expect(parseAmount('12,5')).toBe(12.5);
    expect(parseAmount('1.234,56')).toBe(1234.56);
    expect(parseAmount('abc')).toBeNaN();
  });
  it('formats dates DD/MM/YYYY', () => {
    expect(fmtDate('2026-11-04')).toBe('04/11/2026');
    expect(mondayOf('2026-11-29')).toBe('2026-11-23');
  });
});

describe('budget periods', () => {
  it('uses calendar months by default', () => {
    expect(periodKeyFor('2026-11-24', 1)).toBe('2026-11');
    expect(periodStart('2026-02', 1)).toBe('2026-02-01');
    expect(periodEnd('2026-02', 1)).toBe('2026-02-28');
  });
  it('supports a payday (25th) cycle named after the month it ends in', () => {
    expect(periodKeyFor('2026-11-24', 25)).toBe('2026-11');
    expect(periodKeyFor('2026-11-25', 25)).toBe('2026-12');
    expect(periodStart('2026-12', 25)).toBe('2026-11-25');
    expect(periodEnd('2026-12', 25)).toBe('2026-12-24');
    expect(periodDays('2026-03', 25)).toBe(28); // 25 Feb – 24 Mar
  });
  it('clamps start day 31 in short months', () => {
    expect(periodStart('2026-03', 31)).toBe('2026-02-28');
    expect(periodEnd('2026-03', 31)).toBe('2026-03-30');
  });
  it('counts days left including today', () => {
    expect(daysLeft('2026-11', 1, '2026-11-24')).toBe(7);
    expect(daysLeft('2026-10', 1, '2026-11-24')).toBe(0);
  });
  it('places due dates inside payday periods', () => {
    expect(dueDateInPeriod('2026-12', 25, 1)).toBe('2026-12-01');
    expect(dueDateInPeriod('2026-12', 25, 28)).toBe('2026-11-28');
  });
});

describe('budget summary', () => {
  it('calculates totals, remaining and safe-to-spend', () => {
    const d = setup();
    d.transactions = [
      tx({ categoryId: 'rent', amount: 7000, date: '2026-11-01' }),
      tx({ categoryId: 'groceries', amount: 800 }),
      tx({ categoryId: 'eatout', amount: 650 }),
      tx({ categoryId: 'sav-emergency', amount: 1000 }),
      tx({ categoryId: 'groceries', amount: 999, date: '2026-10-30' }), // other month
    ];
    const s = summarize(d, '2026-11', TODAY);
    expect(s.income).toBe(20000);
    expect(s.planned).toEqual({ fixed: 9000, variable: 2500, savings: 1000 });
    expect(s.unallocated).toBe(7500);
    expect(s.discretionary).toBe(10000);
    expect(s.spent).toBe(8450);
    expect(s.saved).toBe(1000);
    expect(s.remaining).toBe(10550);
    expect(s.outstandingFixed).toBe(2000); // medical aid unpaid
    expect(s.safeToSpend).toBe(8550);
    expect(s.perDay).toBeCloseTo(8550 / 7, 2);
    expect(s.overspent.map((r) => r.category.id)).toEqual(['eatout']);
  });
  it('flags over-allocation', () => {
    const d = setup();
    d.budgets['2026-11'].allocations.rent = 20000;
    expect(summarize(d, '2026-11', TODAY).overAllocated).toBe(true);
  });
  it('bill status: paid, overdue, due soon', () => {
    const d = setup();
    d.transactions = [tx({ categoryId: 'rent', amount: 7000, date: '2026-11-01' })];
    const bills = summarize(d, '2026-11', TODAY).bills;
    expect(bills.find((b) => b.category.id === 'rent')?.status).toBe('paid');
    expect(bills.find((b) => b.category.id === 'medical')?.status).toBe('overdue');
  });
  it('new months inherit the latest budget', () => {
    const d = setup();
    const b = resolveBudget(d, '2026-12');
    expect(b.inherited).toBe(true);
    expect(b.allocations.rent).toBe(7000);
  });
});

describe('grocery budget', () => {
  it('splits R2,000 into weekly and daily allowances', () => {
    const d = setup();
    d.transactions = [tx({ amount: 1500, date: '2026-11-10' })];
    const g = groceryOverview(d, '2026-11', TODAY);
    expect(g.budget).toBe(2000);
    expect(g.weekly).toBeCloseTo(466.67, 2); // 2000 × 7 / 30
    expect(g.daily).toBeCloseTo(66.67, 2);
    expect(g.remaining).toBe(500);
    expect(g.weeklyNow).toBe(500); // 7 days left → one week
    expect(g.pace).toBe('on');
  });
});

describe('prices, recipes and shopping', () => {
  it('prefers active specials and ignores expired ones', () => {
    const d = emptyData(TODAY);
    const chicken = storePrices(d, 'chicken-breast', TODAY);
    expect(chicken[0].store.id).toBe('checkers');
    expect(chicken[0].isSpecial).toBe(true);
    const cheese = storePrices(d, 'cheddar', TODAY).find((p) => p.store.id === 'checkers')!;
    expect(cheese.isSpecial).toBe(false);
    expect(activeSpecials(d, TODAY).some((s) => s.record.id === 's-cheddar-expired')).toBe(false);
  });
  it('calculates nutrition per serving from ingredients', () => {
    const d = emptyData(TODAY);
    const r = d.recipes.find((x) => x.id === 'boiled-eggs')!;
    const s = recipeStats(r, d, TODAY);
    expect(s.kcal).toBe(143);
    expect(s.protein).toBeCloseTo(12.6, 1);
    expect(s.costPerServing).toBeCloseTo((64.99 / 900) * 100, 2);
  });
  it('respects diet preferences', () => {
    const d = emptyData(TODAY);
    d.settings.diet = 'vegetarian';
    const products = new Map(d.products.map((p) => [p.id, p]));
    expect(dietConflicts(d.recipes.find((r) => r.id === 'chicken-curry')!, d.settings, products).length).toBeGreaterThan(0);
    expect(dietConflicts(d.recipes.find((r) => r.id === 'lentil-chickpea-curry')!, d.settings, products)).toEqual([]);
  });
  it('combines duplicate ingredients, subtracts pantry and buys whole packs', () => {
    const d = emptyData(TODAY);
    const plan = emptyWeek('2026-11-23');
    plan.days[0].breakfast = { recipeId: 'boiled-eggs', servings: 1 };
    plan.days[1].breakfast = { recipeId: 'boiled-eggs', servings: 2 };
    plan.days[2].lunch = { recipeId: 'egg-scramble', servings: 1 };
    d.pantry = [{ id: 'p', productId: 'eggs', quantity: 100, addedOn: TODAY, expiry: '2026-12-01' }];
    const eggs = weeklyNeeds(d, plan, TODAY).find((n) => n.product.id === 'eggs')!;
    expect(eggs.required).toBe(450);
    expect(eggs.inPantry).toBe(100);
    expect(eggs.toBuy).toBe(350);
    const list = buildShoppingList(d, plan, TODAY);
    const item = list.items.find((i) => i.product.id === 'eggs')!;
    expect(item.chosen?.packs).toBe(1);
    expect(item.chosen?.store.id).toBe('woolworths'); // R64.99 special is cheapest
    expect(item.leftover).toBe(550);
  });
  it('ignores expired pantry stock', () => {
    const d = emptyData(TODAY);
    const plan = emptyWeek('2026-11-23');
    plan.days[0].snack = { recipeId: 'boiled-eggs', servings: 1 };
    d.pantry = [{ id: 'p', productId: 'eggs', quantity: 500, addedOn: TODAY, expiry: '2026-11-01' }];
    expect(weeklyNeeds(d, plan, TODAY)[0].toBuy).toBe(100);
  });
  it('auto-fills a week without breaking diet rules', () => {
    const d = emptyData(TODAY);
    d.settings.diet = 'vegetarian';
    const plan = autoFillWeek(d, emptyWeek('2026-11-23'), TODAY, 1);
    const ids = plan.days.flatMap((day) => Object.values(day).map((s) => s!.recipeId));
    expect(ids.length).toBeGreaterThan(20);
    expect(ids).not.toContain('chicken-curry');
  });
});

describe('savings goals', () => {
  it('works out the monthly amount needed', () => {
    expect(monthsUntil('2026-11-24', '2027-05-24')).toBe(7);
    const d = emptyData(TODAY);
    const goal = { id: 'g', name: 'Car', target: 12000, openingBalance: 2000, targetDate: '2027-08-31', monthlyContribution: 1000, color: '', createdAt: TODAY };
    d.goals = [goal];
    d.transactions = [tx({ amount: 1000, goalId: 'g', categoryId: 'sav-other' })];
    const p = goalProgress(d, goal, TODAY);
    expect(p.saved).toBe(3000);
    expect(p.remaining).toBe(9000);
    expect(p.monthsLeft).toBe(10);
    expect(p.requiredMonthly).toBe(900);
    expect(p.status).toBe('on-track');
  });
});

describe('catalogue text parser', () => {
  const products = emptyData(TODAY).products;
  it('reads sizes', () => {
    expect(parseSize('Milk 2L')).toBe(2000);
    expect(parseSize('Beans 410g')).toBe(410);
    expect(parseSize('Rice 2,5 kg')).toBe(2500);
  });
  it('extracts names, prices, was-prices and multibuys', () => {
    const items = parseCatalogueText(
      [
        'Clover Low Fat Milk 2L R32.99',
        'Chicken Breast Fillets per kg R89,99',
        'Large Eggs 18s Was R79.99 Now R64.99',
        'Any 2 for R45 Tuna Chunks in Brine 170g',
        'Fresh Bananas',
        'R 17.99',
        'Terms and conditions apply',
      ].join('\n'),
      products,
    );
    expect(items).toHaveLength(5);
    expect(items[0]).toMatchObject({ price: 32.99, packSize: 2000, matchId: 'milk' });
    expect(items[1]).toMatchObject({ price: 89.99, packSize: 1000, perKg: true, matchId: 'chicken-breast' });
    expect(items[2]).toMatchObject({ price: 64.99, wasPrice: 79.99, matchId: 'eggs' });
    expect(items[3]).toMatchObject({ price: 22.5, multiBuy: { qty: 2, total: 45 }, matchId: 'tuna', packSize: 170 });
    expect(items[4]).toMatchObject({ price: 17.99, matchId: 'bananas' });
  });
});

describe('demo data', () => {
  it('builds a consistent three-month demo', () => {
    const d = demoData(TODAY);
    expect(Object.keys(d.budgets)).toEqual(['2026-09', '2026-10', '2026-11']);
    const s = summarize(d, '2026-11', TODAY);
    expect(s.income).toBe(30000);
    expect(s.spent).toBeGreaterThan(10000);
    expect(d.transactions.every((t) => t.date <= TODAY)).toBe(true);
    expect(Object.values(d.mealPlans)[0].days.some((x) => x.dinner)).toBe(true);
  });
});
