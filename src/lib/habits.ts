import { addDays, fromISO, weekDays } from './dates';

export interface Habit {
  id: string;
  name: string;
  color: string;
  /** Days of week the habit is scheduled, 0 = Monday … 6 = Sunday. */
  days: number[];
  createdAt: string;
  demo?: boolean;
}

export type Checkins = Record<string, string[]>; // habitId -> ISO dates

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function dayIndex(iso: string): number {
  return (fromISO(iso).getDay() + 6) % 7;
}

export function isScheduled(h: Habit, iso: string): boolean {
  return iso >= h.createdAt && h.days.includes(dayIndex(iso));
}

export function isDone(checkins: Checkins, habitId: string, iso: string): boolean {
  return (checkins[habitId] ?? []).includes(iso);
}

export function toggleCheckin(checkins: Checkins, habitId: string, iso: string, today: string): { checkins: Checkins; error?: string } {
  if (iso > today) return { checkins, error: 'You can’t check in for a day that hasn’t happened yet.' };
  const list = checkins[habitId] ?? [];
  const next = list.includes(iso) ? list.filter((d) => d !== iso) : [...list, iso].sort();
  return { checkins: { ...checkins, [habitId]: next } };
}

/**
 * Consecutive scheduled days completed, counting back from today.
 * If today is scheduled but not done yet, the streak is still alive (counted from yesterday).
 */
export function currentStreak(h: Habit, checkins: Checkins, today: string): number {
  let day = today;
  let streak = 0;
  if (isScheduled(h, day) && !isDone(checkins, h.id, day)) day = addDays(day, -1);
  for (let i = 0; i < 3660 && day >= h.createdAt; i++) {
    if (isScheduled(h, day)) {
      if (isDone(checkins, h.id, day)) streak++;
      else break;
    }
    day = addDays(day, -1);
  }
  return streak;
}

export function longestStreak(h: Habit, checkins: Checkins, today: string): number {
  let best = 0, run = 0;
  for (let day = h.createdAt; day <= today; day = addDays(day, 1)) {
    if (!isScheduled(h, day)) continue;
    if (isDone(checkins, h.id, day)) {
      run++;
      best = Math.max(best, run);
    } else if (day < today) {
      run = 0;
    }
  }
  return best;
}

export type DayState = 'done' | 'missed' | 'pending' | 'off' | 'future' | 'before';

export function dayState(h: Habit, checkins: Checkins, iso: string, today: string): DayState {
  if (iso > today) return 'future';
  if (iso < h.createdAt) return 'before';
  if (isDone(checkins, h.id, iso)) return 'done';
  if (!isScheduled(h, iso)) return 'off';
  return iso === today ? 'pending' : 'missed';
}

/** Missed scheduled days in [from, to] (inclusive), ignoring today. */
export function missedDays(h: Habit, checkins: Checkins, from: string, to: string, today: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (dayState(h, checkins, d, today) === 'missed') out.push(d);
  return out;
}

/** Completed scheduled days ÷ scheduled days elapsed, over the last `n` days (today included). */
export function completionRate(h: Habit, checkins: Checkins, today: string, n = 30): number | null {
  let scheduled = 0, done = 0;
  for (let i = 0; i < n; i++) {
    const d = addDays(today, -i);
    if (!isScheduled(h, d)) continue;
    if (d === today && !isDone(checkins, h.id, d)) continue; // today still in progress
    scheduled++;
    if (isDone(checkins, h.id, d)) done++;
  }
  return scheduled === 0 ? null : done / scheduled;
}

export function weekSummary(habits: Habit[], checkins: Checkins, mondayIso: string, today: string) {
  return weekDays(mondayIso).map((day) => {
    const due = habits.filter((h) => isScheduled(h, day));
    const done = due.filter((h) => isDone(checkins, h.id, day)).length;
    return { day, scheduled: due.length, done, future: day > today };
  });
}

export function validateHabit(input: { name: string; days: number[] }, habits: Habit[], editingId?: string) {
  const errors: { name?: string; days?: string } = {};
  const name = input.name.trim();
  if (!name) errors.name = 'Name the habit, for example “Read 10 pages”.';
  else if (name.length > 40) errors.name = 'Keep it under 40 characters.';
  else if (habits.some((h) => h.id !== editingId && h.name.toLowerCase() === name.toLowerCase())) errors.name = 'You already track a habit with this name.';
  if (input.days.length === 0) errors.days = 'Pick at least one day.';
  return errors;
}

/** Month grid (Mon-first) with leading/trailing nulls. */
export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const daysIn = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= daysIn; d++) cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}
