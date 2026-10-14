import { describe, expect, it } from 'vitest';
import { planNotifications } from './schedule';
import { createDefaultState } from './defaults';
import { confirmKey } from './engine';

const monOff = () => ({ ...createDefaultState(), overrides: { '2026-10-12': { typeId: 'off' } } });

describe('お知らせの予定表', () => {
  it('通常どおりなら、お知らせは1件もない', () => {
    expect(planNotifications(createDefaultState(), new Date(2026, 9, 11, 12, 0))).toEqual([]);
  });

  it('月曜休みなら、火曜の朝7時（設定した時刻）に理由つきで知らせる', () => {
    const [n, ...rest] = planNotifications(monOff(), new Date(2026, 9, 11, 12, 0));
    expect(rest).toEqual([]);
    expect(n.at).toEqual(new Date(2026, 9, 13, 7, 0));
    expect(n.title).toBe('今日はいつもと違います');
    expect(n.body).toBe('月曜日が休みになったため、今日は今週最初の出勤日です。\n今日の持ち物・行動：作業服、社員証');
  });

  it('お知らせの時刻を変えると、その時刻になる', () => {
    const state = monOff();
    state.settings.sameDayTime = '06:15';
    expect(planNotifications(state, new Date(2026, 9, 11, 12, 0))[0].at).toEqual(new Date(2026, 9, 13, 6, 15));
  });

  it('前日ルールは前日の夜（設定した時刻）に知らせる', () => {
    const state = monOff();
    state.rules = state.rules.map((r) => ({ ...r, timing: 'dayBefore' as const }));
    const [n] = planNotifications(state, new Date(2026, 9, 11, 12, 0));
    expect(n.at).toEqual(new Date(2026, 9, 12, 21, 0));
    expect(n.title).toBe('明日はいつもと違います');
  });

  it('時刻を過ぎたお知らせは予約しない', () => {
    expect(planNotifications(monOff(), new Date(2026, 9, 13, 7, 30))).toEqual([]);
  });

  it('「準備した」を押したら、そのお知らせは予約しない', () => {
    const state = monOff();
    state.confirmed[confirmKey({ ruleId: 'first-workday', targetDate: '2026-10-13' })] = true;
    expect(planNotifications(state, new Date(2026, 9, 11, 12, 0))).toEqual([]);
  });
});
