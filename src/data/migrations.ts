import type { AppData } from '../domain/types';
import { defaultRoutines, defaultSchedule } from './seed-wellness';
import { extraProducts } from './seed-ingredients';

/** Bump when the stored shape changes, and add a step below. */
export const CURRENT_VERSION = 6;

type Migration = (data: any) => any;
const MIGRATIONS: Record<number, Migration> = {
  // v2: income lines gain a type (salary / commission / allowance / other) and a received amount.
  2: (d) => {
    for (const b of Object.values<any>(d.budgets || {}))
      for (const l of b.income || [])
        l.kind ??= /salar/i.test(l.name) ? 'salary' : /commission/i.test(l.name) ? 'commission' : /allowance/i.test(l.name) ? 'allowance' : 'other';
    return d;
  },
  // v3: habits and workouts.
  3: (d) => ({ habits: [], habitLogs: {}, routines: defaultRoutines(), workoutSchedule: defaultSchedule(), workoutLogs: [], ...d }),
  // v4: weekly resets and a savings category for yearly costs.
  4: (d) => {
    d.resets ??= {};
    if (!d.categories.some((c: any) => c.id === 'sav-yearly'))
      d.categories.push({ id: 'sav-yearly', name: 'Yearly costs fund', group: 'savings', color: '#5A55C8' });
    return d;
  },
  // v5: daily challenges.
  5: (d) => ({ challenges: {}, ...d }),
  // v6: more built-in ingredients (only adds ones you don't have).
  6: (d) => {
    const have = new Set(d.products.map((p: any) => p.id));
    d.products.push(...extraProducts().filter((p) => !have.has(p.id)));
    return d;
  },
};

export function migrate(raw: any): AppData {
  let data = raw;
  let v = Number(data?.version || 1);
  while (v < CURRENT_VERSION) {
    v++;
    data = MIGRATIONS[v] ? MIGRATIONS[v](data) : data;
    data.version = v;
  }
  return data as AppData;
}
