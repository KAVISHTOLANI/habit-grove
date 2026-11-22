import { describe, expect, it } from 'vitest';
import { completionRate, currentStreak, dayState, longestStreak, missedDays, monthGrid, toggleCheckin, validateHabit, weekSummary, type Habit } from './habits';

// 2026-03-02 is a Monday.
const daily: Habit = { id: 'h', name: 'Read', color: '#000', days: [0, 1, 2, 3, 4, 5, 6], createdAt: '2026-03-01' };
const weekdays: Habit = { ...daily, id: 'w', days: [0, 1, 2, 3, 4] };

describe('streaks', () => {
  it('counts consecutive days and survives an unfinished today', () => {
    const c = { h: ['2026-03-05', '2026-03-06', '2026-03-07'] };
    expect(currentStreak(daily, c, '2026-03-07')).toBe(3);
    expect(currentStreak(daily, c, '2026-03-08')).toBe(3); // today not done yet
    expect(currentStreak(daily, c, '2026-03-09')).toBe(0); // missed the 8th
  });
  it('skips unscheduled days', () => {
    // Fri 6th and Mon 9th done; weekend not scheduled
    const c = { w: ['2026-03-06', '2026-03-09'] };
    expect(currentStreak(weekdays, c, '2026-03-09')).toBe(2);
  });
  it('finds the longest run', () => {
    const c = { h: ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-05', '2026-03-06'] };
    expect(longestStreak(daily, c, '2026-03-06')).toBe(3);
  });
});

describe('day states and missed days', () => {
  it('labels days', () => {
    const c = { w: ['2026-03-02'] };
    expect(dayState(weekdays, c, '2026-03-02', '2026-03-04')).toBe('done');
    expect(dayState(weekdays, c, '2026-03-03', '2026-03-04')).toBe('missed');
    expect(dayState(weekdays, c, '2026-03-04', '2026-03-04')).toBe('pending');
    expect(dayState(weekdays, c, '2026-03-07', '2026-03-09')).toBe('off');
    expect(dayState(weekdays, c, '2026-03-10', '2026-03-09')).toBe('future');
    expect(dayState(weekdays, c, '2026-02-27', '2026-03-09')).toBe('before');
    expect(missedDays(weekdays, c, '2026-03-01', '2026-03-09', '2026-03-09')).toEqual(['2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06']);
  });
});

describe('check-ins', () => {
  it('toggles and rejects future days', () => {
    let r = toggleCheckin({}, 'h', '2026-03-02', '2026-03-02');
    expect(r.checkins.h).toEqual(['2026-03-02']);
    r = toggleCheckin(r.checkins, 'h', '2026-03-02', '2026-03-02');
    expect(r.checkins.h).toEqual([]);
    expect(toggleCheckin({}, 'h', '2026-03-03', '2026-03-02').error).toBeTruthy();
  });
});

describe('stats', () => {
  it('computes completion rate excluding an unfinished today', () => {
    const c = { h: ['2026-03-01', '2026-03-02'] };
    expect(completionRate(daily, c, '2026-03-04', 30)).toBeCloseTo(2 / 3);
    expect(completionRate({ ...daily, createdAt: '2026-03-04' }, {}, '2026-03-04')).toBeNull();
  });
  it('summarises a week', () => {
    const s = weekSummary([daily, weekdays], { h: ['2026-03-02'], w: ['2026-03-02'] }, '2026-03-02', '2026-03-03');
    expect(s[0]).toMatchObject({ scheduled: 2, done: 2 });
    expect(s[5]).toMatchObject({ scheduled: 1, future: true });
  });
  it('builds a Monday-first month grid', () => {
    const g = monthGrid(2026, 2); // March 2026 starts on Sunday
    expect(g.slice(0, 7)).toEqual([null, null, null, null, null, null, '2026-03-01']);
    expect(g.length % 7).toBe(0);
  });
  it('validates habits', () => {
    expect(validateHabit({ name: '', days: [] }, [])).toEqual({ name: expect.any(String), days: expect.any(String) });
    expect(validateHabit({ name: 'read', days: [1] }, [daily]).name).toMatch(/already/);
    expect(validateHabit({ name: 'Read', days: [1] }, [daily], 'h')).toEqual({});
  });
});
