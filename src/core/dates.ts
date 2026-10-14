import type { DateStr } from './types';

export const WEEKDAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

export const toDateStr = (d: Date): DateStr => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const parseDate = (s: DateStr): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (s: DateStr, n: number): DateStr => {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
};

export const weekdayOf = (s: DateStr): number => parseDate(s).getDay();

/** 2つの日付の差（日数） */
export const diffDays = (a: DateStr, b: DateStr): number =>
  Math.round((parseDate(a).getTime() - parseDate(b).getTime()) / 86_400_000);

/** その日が含まれる週の最初の日 */
export const startOfWeek = (s: DateStr, weekStartsOn: 0 | 1): DateStr =>
  addDays(s, -((weekdayOf(s) - weekStartsOn + 7) % 7));

export const weekDates = (s: DateStr, weekStartsOn: 0 | 1): DateStr[] => {
  const start = startOfWeek(s, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

/** 「10月13日（火）」 */
export const formatJa = (s: DateStr): string => {
  const d = parseDate(s);
  return `${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAY_NAMES[d.getDay()]}）`;
};

/** 「火曜日」 */
export const weekdayJa = (s: DateStr): string => `${WEEKDAY_NAMES[weekdayOf(s)]}曜日`;
