import type { AppData, Habit, Routine, WorkoutLog } from '../domain/types';
import { addDays } from '../lib/format';
import { uid } from '../lib/id';

export function defaultRoutines(): Routine[] {
  return [
    { id: 'r-full-a', name: 'Full body A', emoji: '🏋️', color: 'coral', kind: 'strength', minutes: 45, exercises: [
      { name: 'Goblet squats', sets: 3, reps: '10', weight: 12 },
      { name: 'Push-ups (knees if needed)', sets: 3, reps: '8–12' },
      { name: 'Dumbbell rows', sets: 3, reps: '10 each side', weight: 8 },
      { name: 'Glute bridges', sets: 3, reps: '12' },
      { name: 'Plank', sets: 3, reps: '40 s' },
    ] },
    { id: 'r-full-b', name: 'Full body B', emoji: '💪', color: 'periwinkle', kind: 'strength', minutes: 45, exercises: [
      { name: 'Reverse lunges', sets: 3, reps: '10 each leg', weight: 6 },
      { name: 'Dumbbell shoulder press', sets: 3, reps: '10', weight: 6 },
      { name: 'Romanian deadlifts', sets: 3, reps: '10', weight: 12 },
      { name: 'Lat pulldown or band pull-aparts', sets: 3, reps: '12' },
      { name: 'Dead bugs', sets: 3, reps: '10' },
    ] },
    { id: 'r-walk', name: 'Brisk walk or easy run', emoji: '👟', color: 'mint', kind: 'cardio', minutes: 30, exercises: [{ name: 'Walk or jog', minutes: 30 }] },
    { id: 'r-yoga', name: 'Yoga & mobility', emoji: '🧘', color: 'lavender', kind: 'mobility', minutes: 25, exercises: [
      { name: 'Sun salutations', minutes: 8 },
      { name: 'Hip openers', minutes: 7 },
      { name: 'Hamstring & back stretch', minutes: 7 },
      { name: 'Breathing', minutes: 3 },
    ] },
  ];
}

/** A balanced starting week you can change: strength Mon/Wed/Fri, cardio Tue/Thu, yoga Saturday, Sunday rest. */
export function defaultSchedule(): Record<number, string | undefined> {
  return { 0: 'r-full-a', 1: 'r-walk', 2: 'r-full-b', 3: 'r-walk', 4: 'r-full-a', 5: 'r-yoga' };
}

export const HABIT_IDEAS: Omit<Habit, 'id' | 'createdAt'>[] = [
  { name: 'Drink water', emoji: '💧', color: 'sky', days: [], target: 8, unit: 'glasses' },
  { name: 'Log my spending', emoji: '🧾', color: 'lavender', days: [], target: 1 },
  { name: '8,000 steps', emoji: '👟', color: 'mint', days: [], target: 1 },
  { name: 'Hit my protein', emoji: '🍳', color: 'butter', days: [], target: 1 },
  { name: 'Read 10 minutes', emoji: '📖', color: 'periwinkle', days: [], target: 1 },
  { name: 'In bed by 22:30', emoji: '🌙', color: 'pink', days: [], target: 1 },
  { name: 'No-spend day', emoji: '🚫', color: 'coral', days: [1, 3], target: 1 },
  { name: 'Prep tomorrow’s lunch', emoji: '🥡', color: 'mint', days: [0, 1, 2, 3, 6], target: 1 },
  { name: 'Skincare', emoji: '🧴', color: 'pink', days: [], target: 1 },
  { name: 'Stretch 5 minutes', emoji: '🤸', color: 'lavender', days: [], target: 1 },
];

/** Sample habits and workout history for the demo (deterministic). */
export function demoWellness(data: AppData, today: string) {
  const start = addDays(today, -41);
  const picks = [0, 1, 2, 3, 5];
  data.habits = picks.map((i) => ({ ...HABIT_IDEAS[i], id: `h-${i}`, createdAt: start }));
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let d = start; d < today; d = addDays(d, 1)) {
    const log: Record<string, number> = {};
    for (const h of data.habits) {
      const r = rand();
      if (h.target > 1) log[h.id] = r > 0.25 ? h.target : Math.floor(r * h.target * 3);
      else if (r > 0.3) log[h.id] = 1;
    }
    data.habitLogs[d] = log;
  }
  data.habitLogs[today] = { 'h-0': 3, 'h-1': 1 };
  const logs: WorkoutLog[] = [];
  for (let d = start; d < today; d = addDays(d, 1)) {
    const wd = (new Date(d + 'T00:00:00').getDay() + 6) % 7;
    const rid = data.workoutSchedule[wd];
    const r = data.routines.find((x) => x.id === rid);
    if (!r || rand() < 0.25) continue;
    logs.push({ id: uid(), date: d, routineId: r.id, name: r.name, kind: r.kind, minutes: r.minutes, done: r.exercises.map((_, i) => i), effort: (1 + Math.floor(rand() * 3)) as 1 | 2 | 3 });
  }
  data.workoutLogs = logs;
}
