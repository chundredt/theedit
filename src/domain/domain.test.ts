import { describe, expect, it } from 'vitest';
import { money, parseAmount, fmtDate, mondayOf } from '../lib/format';
import { periodKeyFor, periodStart, periodEnd, daysLeft, dueDateInPeriod, periodDays } from './period';
import { summarize, resolveBudget, commissionHistory } from './budget';
import { groceryOverview } from './grocery';
import { emptyData, demoData } from '../data/seed';
import type { AppData, Transaction } from './types';
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
    expect(periodKeyFor('2026-11-25', 25)).toBe('2026-12'); // 25 Nov – 24 Dec = December budget
    expect(periodStart('2026-12', 25)).toBe('2026-11-25');
    expect(periodEnd('2026-12', 25)).toBe('2026-12-24');
    expect(periodDays('2026-03', 25)).toBe(28); // 25 Feb – 24 Mar
    expect(periodKeyFor('2027-01-10', 25)).toBe('2027-01');
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

describe('income: salary, commission and allowance', () => {
  function payday(): AppData {
    const d = emptyData(TODAY);
    d.settings.periodStartDay = 25;
    d.budgets['2026-12'] = {
      period: '2026-12',
      income: [
        { id: 's', name: 'Salary', kind: 'salary', amount: 20000, payDay: 25, received: 20000 },
        { id: 'c', name: 'Commission', kind: 'commission', amount: 5000, payDay: 25 },
        { id: 'a', name: 'Allowance', kind: 'allowance', amount: 1500, payDay: 25, received: 1500 },
      ],
      allocations: { rent: 8000, groceries: 2000 },
    };
    return d;
  }
  it('counts expected commission until it is received, then the actual amount', () => {
    const d = payday();
    let s = summarize(d, '2026-12', '2026-11-26');
    expect(s.incomeExpected).toBe(26500);
    expect(s.incomeReceived).toBe(21500);
    expect(s.incomePending).toBe(5000);
    expect(s.income).toBe(26500);
    expect(s.incomeLines.find((l) => l.line.id === 'c')!.late).toBe(true);
    d.budgets['2026-12'].income[1].received = 3800;
    s = summarize(d, '2026-12', '2026-11-26');
    expect(s.income).toBe(25300);
    expect(s.incomePending).toBe(0);
    expect(s.incomeLines.find((l) => l.line.id === 'c')!.difference).toBe(-1200);
    // The plan is still judged against expected income; spending money uses the actual.
    expect(s.unallocated).toBe(26500 - 10000);
    expect(s.safeToSpend).toBe(25300 - 8000);
  });
  it('next month copies expected income but not what was received', () => {
    const d = payday();
    const next = resolveBudget(d, '2027-01');
    expect(next.income.map((l) => l.received)).toEqual([undefined, undefined, undefined]);
    expect(next.income.map((l) => l.amount)).toEqual([20000, 5000, 1500]);
  });
  it('averages actual commission over recent months', () => {
    const d = payday();
    d.budgets['2026-12'].income[1].received = 4000;
    d.budgets['2026-11'] = { period: '2026-11', income: [{ id: 'c2', name: 'Commission', kind: 'commission', amount: 5000, received: 6000 }], allocations: {} };
    expect(commissionHistory(d, '2027-01')).toEqual({ average: 5000, months: 2, last: 4000 });
  });
  it('payday period: 25 Nov – 24 Dec (December) has 30 days and pay lands on the first day', () => {
    const d = payday();
    const s = summarize(d, '2026-12', '2026-11-25');
    expect(s.totalDays).toBe(30);
    expect(s.incomeLines[0].payDate).toBe('2026-11-25');
    expect(groceryOverview(d, '2026-12', '2026-11-25').weekly).toBeCloseTo(466.67, 2);
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
    expect(s.income).toBe(24500 + 4380 + 1500);
    expect(s.daysLeft).toBe(1);
    expect(s.spent).toBeGreaterThan(10000);
    expect(d.transactions.every((t) => t.date <= TODAY)).toBe(true);
    expect(d.foodLog.some((e) => e.eaten) && d.foodLog.some((e) => !e.eaten)).toBe(true);
    expect(d.stores).toEqual([]);
  });
});

import { parseReceiptText, receiptRows } from './receipt';

describe('till slip text', () => {
  const products = emptyData(TODAY).products;
  it('reads items, multiples, weighed items, date and total; skips payment lines', () => {
    const r = parseReceiptText([
      'CHECKERS HYPER',
      '24/11/2026 18:42',
      'CLOVER LOW FAT MILK 2L        34.99',
      'KOO BAKED BEANS 410G          37.98',
      '2 @ 18.99',
      'BANANAS',
      '1.234 kg @ 21.99/kg           27.14',
      'LARGE EGGS 18                 74.99',
      'XTRA SAVINGS                  -5.00',
      'TOTAL                        175.10',
      'CARD                         175.10',
    ].join('\n'));
    expect(r.date).toBe('2026-11-24');
    expect(r.total).toBe(175.1);
    expect(r.items.map((i) => i.name)).toEqual(['CLOVER LOW FAT MILK 2L', 'KOO BAKED BEANS 410G', 'BANANAS', 'LARGE EGGS 18']);
    const rows = receiptRows(r, products);
    expect(rows[0]).toMatchObject({ productId: 'milk', price: 34.99 });
    expect(rows[1]).toMatchObject({ productId: 'baked-beans', price: 18.99 });
    expect(rows[2]).toMatchObject({ productId: 'bananas', packSize: 1000, price: 21.99 });
    expect(rows[3]).toMatchObject({ productId: 'eggs', price: 74.99 });
  });
});

describe('matching slip items', () => {
  it('does not match on a generic word like "sauce" alone', () => {
    const products = emptyData(TODAY).products;
    const rows = receiptRows({ items: [{ name: 'PERI-PERI SAUCE 250ML', price: 42.99 }, { name: 'KOO BAKED BEANS 410G', price: 18.99 }] }, products);
    expect(rows[0].productId).toBe('');
    expect(rows[0].include).toBe(false);
    expect(rows[1].productId).toBe('baked-beans');
  });
});

import { parseIngredientText, pickNutrition, guessProduct, nutritionFromSimilar } from './ingredients';

describe('typing an ingredient list', () => {
  const products = emptyData(TODAY).products;
  it('turns everyday quantities into grams and matches products', () => {
    const rows = parseIngredientText('500g chicken breast fillets\n2 onions, 1 tin chopped tomatoes\n1 cup rice\n2 tbsp sunflower oil\n½ tsp salt\n1.5 kg potatoes\n3 cloves garlic\nPeri-peri sauce to taste', products);
    const by = (id: string) => rows.find((r) => r.productId === id);
    expect(by('chicken-breast')?.grams).toBe(500);
    expect(by('onions')?.grams).toBe(300);
    expect(by('chopped-tomatoes')?.grams).toBe(410);
    expect(by('rice')?.grams).toBe(190);
    expect(by('oil')?.grams).toBe(30);
    expect(by('salt')?.grams).toBe(3);
    expect(by('potatoes')?.grams).toBe(1500);
    expect(by('garlic')?.grams).toBe(15);
    const peri = rows.find((r) => /peri/i.test(r.name))!;
    expect(peri.productId).toBeUndefined();
    expect(peri.grams).toBe(2);
  });
  it('guesses aisle and diet tags for new ingredients', () => {
    expect(guessProduct('Lamb chops')).toMatchObject({ category: 'Meat & fish', tags: ['meat'] });
    expect(guessProduct('Parmesan')).toMatchObject({ category: 'Dairy & eggs', tags: ['dairy'] });
    expect(guessProduct('Ground cumin').category).toBe('Spices & sauces');
  });
  it('estimates nutrition from a similar ingredient you already have', () => {
    expect(nutritionFromSimilar('Chicken breast skinless', products)?.protein).toBe(23);
    expect(nutritionFromSimilar('Dragonfruit', products)).toBeUndefined();
  });
  it('picks median nutrition from database results, preferring SA products', () => {
    const n = pickNutrition([
      { nutriments: { 'energy-kcal_100g': 100, proteins_100g: 1, carbohydrates_100g: 20, fat_100g: 1 }, countries_tags: ['en:south-africa'] },
      { nutriments: { 'energy-kcal_100g': 120, proteins_100g: 2, carbohydrates_100g: 22, fat_100g: 2 }, countries_tags: ['en:south-africa'] },
      { nutriments: { 'energy-kcal_100g': 110, proteins_100g: 1.5, carbohydrates_100g: 21, fat_100g: 1.5 }, countries_tags: ['en:south-africa'] },
      { nutriments: { 'energy-kcal_100g': 400, proteins_100g: 9, carbohydrates_100g: 50, fat_100g: 20 }, countries_tags: ['en:france'] },
      { nutriments: { proteins_100g: 3 } },
    ]);
    expect(n).toEqual({ kcal: 110, protein: 1.5, carbs: 21, fat: 1.5 });
  });
});
