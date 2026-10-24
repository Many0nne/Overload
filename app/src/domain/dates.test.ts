import { describe, expect, it } from 'vitest';
import { calendarDaysBetween } from './dates';

describe('jours calendaires (§F7.6)', () => {
  it('compte les jours calendaires locaux, même juste après minuit', () => {
    const now = new Date(2026, 9, 25, 0, 30).getTime();
    expect(calendarDaysBetween(new Date(2026, 9, 24, 23, 50).getTime(), now)).toBe(1);
    expect(calendarDaysBetween(new Date(2026, 9, 25, 0, 5).getTime(), now)).toBe(0);
    expect(calendarDaysBetween(new Date(2026, 8, 25, 12).getTime(), now)).toBe(30);
  });
});
