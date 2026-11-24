import type { AppData } from '../domain/types';

/** Bump when the stored shape changes, and add a step below. */
export const CURRENT_VERSION = 2;

type Migration = (data: any) => any;
const MIGRATIONS: Record<number, Migration> = {
  // v2: income lines gain a type (salary / commission / allowance / other) and a received amount.
  2: (d) => {
    for (const b of Object.values<any>(d.budgets || {}))
      for (const l of b.income || [])
        l.kind ??= /salar/i.test(l.name) ? 'salary' : /commission/i.test(l.name) ? 'commission' : /allowance/i.test(l.name) ? 'allowance' : 'other';
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
