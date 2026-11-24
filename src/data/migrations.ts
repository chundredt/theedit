import type { AppData } from '../domain/types';

/** Bump when the stored shape changes, and add a step below. */
export const CURRENT_VERSION = 1;

type Migration = (data: any) => any;
const MIGRATIONS: Record<number, Migration> = {
  // 2: (d) => ({ ...d, newField: [] }),
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
