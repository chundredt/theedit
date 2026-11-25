import type { AppData, ISODate } from './types';
import { summarize } from './budget';
import { periodKeyFor } from './period';
import { addDays } from '../lib/format';

export interface Challenge {
  id: string;
  area: 'money' | 'food' | 'body' | 'mind';
  title: string;
  detail: string;
}

/** Small, doable-today challenges. Placeholders like {protein} are filled from your settings and data. */
const POOL: Challenge[] = [
  { id: 'no-spend', area: 'money', title: 'No-spend day', detail: 'Nothing but essentials today. Bills and planned groceries don’t count.' },
  { id: 'pack-lunch', area: 'money', title: 'Pack your lunch', detail: 'Bring lunch from home instead of buying it.' },
  { id: 'no-takeaway', area: 'money', title: 'Skip the takeaways', detail: 'Cook tonight — even something simple.' },
  { id: 'log-all', area: 'money', title: 'Log every rand', detail: 'Add every purchase today, however small.' },
  { id: 'sub-check', area: 'money', title: 'Check one subscription', detail: 'Open one debit order or subscription and decide if it’s still worth it.' },
  { id: 'save-50', area: 'money', title: 'Move R50 to savings', detail: 'Small amounts add up. Put R50 towards a goal today.' },
  { id: 'protein', area: 'food', title: 'Hit {protein} g of protein', detail: 'Add eggs, tuna, chicken or lentils to make it easy.' },
  { id: 'water', area: 'food', title: 'Drink 2 litres of water', detail: 'Fill a bottle in the morning and finish it twice.' },
  { id: 'log-food', area: 'food', title: 'Log everything you eat', detail: 'Every meal and snack, even the small ones.' },
  { id: 'veg', area: 'food', title: 'Half a plate of veg', detail: 'Fill half your dinner plate with vegetables.' },
  { id: 'prep', area: 'food', title: 'Prep tomorrow’s lunch', detail: 'Ten minutes tonight saves money tomorrow.' },
  { id: 'walk', area: 'body', title: '10-minute walk after dinner', detail: 'Good for digestion, sleep and steps.' },
  { id: 'squats', area: 'body', title: '50 squats today', detail: 'Split them up — 10 every time you make tea.' },
  { id: 'stretch', area: 'body', title: 'Stretch for 5 minutes', detail: 'Before bed: hips, hamstrings and back.' },
  { id: 'stairs', area: 'body', title: 'Take the stairs', detail: 'Every time you have the choice today.' },
  { id: 'workout', area: 'body', title: 'Show up for {workout}', detail: 'It’s on your plan today. Even a short version counts.' },
  { id: 'phone-down', area: 'mind', title: 'Phone down 30 min before bed', detail: 'Read, stretch or just wind down.' },
  { id: 'grateful', area: 'mind', title: 'Three good things', detail: 'Write down three things that went well today.' },
  { id: 'early', area: 'mind', title: 'In bed by 22:30', detail: 'Tomorrow-you will thank you.' },
];

function hash(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}

/** Choose a challenge for the day, nudged by what's going on: overspending, food about to expire, a planned workout. */
export function pickChallenge(data: AppData, date: ISODate, swaps: number): { challenge: Challenge; text: { title: string; detail: string } } {
  const wd = (new Date(date + 'T00:00:00').getDay() + 6) % 7;
  const routine = data.routines.find((r) => r.id === data.workoutSchedule[wd]);
  const s = data.budgets && Object.keys(data.budgets).length ? summarize(data, periodKeyFor(date, data.settings.periodStartDay), date) : null;
  const overspending = !!s && (s.overspent.length > 0 || s.nearLimit.length > 1);
  const recent = new Set([1, 2, 3].map((i) => data.challenges[addDays(date, -i)]?.id).filter(Boolean));

  let pool = POOL.filter((c) => !recent.has(c.id));
  if (!routine) pool = pool.filter((c) => c.id !== 'workout');
  // Context first: the most useful challenge for today, unless you swapped it.
  const priority = [overspending && 'no-spend', routine && 'workout'].filter(Boolean) as string[];
  const order = [...priority.filter((id) => pool.some((c) => c.id === id)).map((id) => pool.find((c) => c.id === id)!), ...pool.slice().sort((a, b) => hash(date + a.id) - hash(date + b.id))];
  const challenge = order[swaps % order.length];
  return { challenge, text: describeChallenge(data, date, challenge.id)! };
}

/** The wording for a saved challenge, with today's details filled in. */
export function describeChallenge(data: AppData, date: ISODate, id: string): { title: string; detail: string; area: Challenge['area'] } | undefined {
  const c = POOL.find((x) => x.id === id);
  if (!c) return undefined;
  const wd = (new Date(date + 'T00:00:00').getDay() + 6) % 7;
  const routine = data.routines.find((r) => r.id === data.workoutSchedule[wd]);
  const fill = (t: string) =>
    t.replace('{protein}', String(data.settings.proteinTarget))
      .replace('{workout}', routine?.name || 'your workout');
  return { title: fill(c.title), detail: fill(c.detail), area: c.area };
}

/** Days in a row with the daily challenge done (today counts once done). */
export function challengeStreak(data: AppData, today: ISODate): number {
  let n = 0;
  let d = data.challenges[today]?.done ? today : addDays(today, -1);
  while (data.challenges[d]?.done) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}
