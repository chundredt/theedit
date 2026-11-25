import { describe, expect, it } from 'vitest';
import { averageOver, dayTotals, matchCommon, quickPicks, readAmount, readFoodText, rememberFoods, splitItems } from './food';
import { emptyData } from '../data/seed';
import type { FoodEntry } from './types';

const products = emptyData().products;

describe('reading what you ate', () => {
  it('splits a sentence into foods', () => {
    expect(splitItems('2 eggs, toast and coffee with milk')).toEqual(['2 eggs', 'toast', 'coffee with milk']);
    expect(splitItems('mac and cheese and salad')).toEqual(['mac and cheese', 'salad']);
  });
  it('reads amounts', () => {
    expect(readAmount('2 eggs')).toEqual({ qty: 2, rest: 'eggs' });
    expect(readAmount('half a sandwich')).toEqual({ qty: 0.5, rest: 'sandwich' });
    expect(readAmount('150g chicken breast')).toMatchObject({ grams: 150, rest: 'chicken breast' });
  });
  it('prefers the more specific food', () => {
    expect(matchCommon('chicken curry')?.[0]).toBe('Chicken curry (cup)');
    expect(matchCommon('2 slices of toast')?.[0]).toBe('Toast (slice)');
    expect(matchCommon('a cup of coffee')?.[0]).toBe('Coffee with milk');
  });
  it('adds up calories and protein for a typed breakfast', () => {
    const lines = readFoodText('2 eggs, 2 slices toast, coffee with milk', [], products);
    expect(lines.map((l) => l.kcal)).toEqual([156, 160, 30]);
    expect(lines.every((l) => l.known)).toBe(true);
    expect(Math.round(lines.reduce((a, l) => a + l.protein, 0))).toBe(20);
  });
  it('uses the ingredient list for weights', () => {
    const [l] = readFoodText('200g rice', [], products);
    expect(l.known).toBe(true);
    expect(l.kcal).toBeGreaterThan(200);
  });
  it('flags foods it does not know', () => {
    const [l] = readFoodText('grandma special', [], products);
    expect(l.known).toBe(false);
    expect(l.kcal).toBe(0);
  });
  it('remembers your numbers per portion and scales them', () => {
    const mine = rememberFoods([], [{ base: 'grandma special', qty: 1, kcal: 420, protein: 18 }], '2026-12-03');
    const [l] = readFoodText('2 grandma special', mine, products);
    expect(l).toMatchObject({ kcal: 840, protein: 36, known: true });
  });
});

describe('day totals and planning', () => {
  const e = (date: string, kcal: number, eaten = true): FoodEntry => ({ id: date + kcal, date, meal: 'lunch', name: `Food ${kcal}`, kcal, protein: 10, eaten });
  it('counts only what was eaten, and keeps the plan separate', () => {
    const t = dayTotals([e('2026-12-03', 500), e('2026-12-03', 300, false)], '2026-12-03');
    expect(t).toMatchObject({ kcal: 500, protein: 10, plannedKcal: 300 });
  });
  it('averages over days with food logged', () => {
    expect(averageOver([e('2026-12-01', 1800), e('2026-12-02', 2200)], ['2026-12-01', '2026-12-02', '2026-12-03'])).toEqual({ kcal: 2000, protein: 10, days: 2 });
  });
  it('offers favourites first, then recent foods', () => {
    const picks = quickPicks({ foodLog: [e('2026-12-01', 100), e('2026-12-02', 200)], myFoods: [{ id: 'f', name: 'Oats', kcal: 150, protein: 5, favourite: true, uses: 1, lastUsed: '2026-12-01' }] });
    expect(picks.map((p) => p.name)).toEqual(['Oats', 'Food 200', 'Food 100']);
  });
});
