import { create } from 'zustand';
import { useEffect, useState } from 'react';
import { getToday, useStore } from '../data/store';
import { daysLeft, periodKeyFor, shiftPeriod } from '../domain/period';
import { mondayOf } from './format';
import type { PeriodKey, WeekKey } from '../domain/types';

/** View state shared across pages (not persisted): the month and week being looked at. */
interface UIState {
  period: PeriodKey | null;
  week: WeekKey;
  addOpen: boolean;
  setPeriod(p: PeriodKey): void;
  setWeek(w: WeekKey): void;
  setAddOpen(v: boolean): void;
}

export const useUI = create<UIState>((set) => ({
  period: null,
  week: mondayOf(getToday()),
  addOpen: false,
  setPeriod: (period) => set({ period }),
  setWeek: (week) => set({ week }),
  setAddOpen: (addOpen) => set({ addOpen }),
}));

/** Selected budget period, defaulting to the one containing today. */
export function usePeriod(): [PeriodKey, (p: PeriodKey) => void] {
  const startDay = useStore((s) => s.data.settings.periodStartDay);
  const period = useUI((s) => s.period);
  const setPeriod = useUI((s) => s.setPeriod);
  const budgets = useStore((s) => s.data.budgets);
  return [period || defaultPeriod(getToday(), startDay, budgets), setPeriod];
}

/**
 * The month to show when nothing is picked: normally the one containing today. In the last
 * two days before payday (or when only next month has been set up) show the coming month,
 * because that's the one you're planning.
 */
export function defaultPeriod(today: string, startDay: number, budgets: Record<string, unknown>): PeriodKey {
  const current = periodKeyFor(today, startDay);
  const next = shiftPeriod(current, 1);
  if (startDay > 1 && daysLeft(current, startDay, today) <= 2) return next;
  if (!budgets[current] && budgets[next]) return next;
  return current;
}

export type Route =
  | 'today' | 'reset' | 'habits' | 'workouts'
  | 'dashboard' | 'budget' | 'transactions' | 'savings' | 'reports'
  | 'groceries' | 'meals' | 'shopping' | 'preferences';

const ROUTES: Route[] = ['today', 'reset', 'habits', 'workouts', 'dashboard', 'budget', 'transactions', 'savings', 'reports', 'groceries', 'meals', 'shopping', 'preferences'];

function parseHash(): Route {
  const h = location.hash.replace(/^#\/?/, '').split(/[?/]/)[0];
  // Old links to removed pages land on the food log.
  if (h === 'recipes' || h === 'pantry' || h === 'prices') return 'meals';
  return ROUTES.includes(h as Route) ? (h as Route) : 'today';
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parseHash());
  useEffect(() => {
    const on = () => {
      setRoute(parseHash());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function go(route: Route) {
  location.hash = route;
}
