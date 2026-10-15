import { describe, expect, it } from 'vitest';
import { planAll, planChecks } from './schedule';
import { createDefaultState } from './defaults';
import type { AppState } from './types';

const withChecks = (patch: Partial<AppState['settings']['checkReminders']>): AppState => {
  const s = createDefaultState();
  s.settings.checkReminders = { ...s.settings.checkReminders, ...patch };
  return s;
};

// 2026-10-14 は水曜日
const NOW = new Date(2026, 9, 14, 12, 0);

describe('入力わすれ防止の確認お知らせ', () => {
  it('最初はすべてオフ', () => {
    expect(planChecks(createDefaultState(), NOW)).toEqual([]);
  });

  it('毎日：設定した時刻に「明日は予定の変更はありませんか？」', () => {
    const plan = planChecks(withChecks({ daily: { enabled: true, time: '20:30' } }), NOW, 3);
    expect(plan.map((p) => p.at)).toEqual([
      new Date(2026, 9, 14, 20, 30),
      new Date(2026, 9, 15, 20, 30),
      new Date(2026, 9, 16, 20, 30),
    ]);
    expect(plan[0].title).toBe('明日は予定の変更はありませんか？');
    expect(plan[0].kind).toBe('check');
  });

  it('時刻を過ぎた今日の分は予約しない', () => {
    const plan = planChecks(withChecks({ daily: { enabled: true, time: '08:00' } }), NOW, 2);
    expect(plan.map((p) => p.at)).toEqual([new Date(2026, 9, 15, 8, 0)]);
  });

  it('毎週：選んだ曜日だけ', () => {
    // 月曜（1）07:00
    const plan = planChecks(withChecks({ weekly: { enabled: true, weekday: 1, time: '07:00' } }), NOW, 14);
    expect(plan.map((p) => p.at)).toEqual([new Date(2026, 9, 19, 7, 0), new Date(2026, 9, 26, 7, 0)]);
    expect(plan[0].title).toBe('今週は予定の変更はありませんか？');
  });

  it('毎月：選んだ日だけ', () => {
    const plan = planChecks(withChecks({ monthly: { enabled: true, day: 1, time: '20:00' } }), NOW, 60);
    expect(plan.map((p) => p.at)).toEqual([new Date(2026, 10, 1, 20, 0), new Date(2026, 11, 1, 20, 0)]);
    expect(plan[0].title).toBe('今月は予定の変更はありませんか？');
  });

  it('毎月「月末」：月ごとの最後の日', () => {
    const plan = planChecks(withChecks({ monthly: { enabled: true, day: 0, time: '20:00' } }), NOW, 60);
    expect(plan.map((p) => p.at)).toEqual([new Date(2026, 9, 31, 20, 0), new Date(2026, 10, 30, 20, 0)]);
  });

  it('同じ日に毎日・毎週が重なっても、別々のお知らせになる（番号がぶつからない）', () => {
    const state = withChecks({
      daily: { enabled: true, time: '20:00' },
      weekly: { enabled: true, weekday: 3, time: '20:00' },
    });
    const plan = planChecks(state, new Date(2026, 9, 14, 6, 0), 1);
    expect(plan.map((p) => p.checkKind)).toEqual(['daily', 'weekly']);
    expect(new Set(plan.map((p) => p.id)).size).toBe(2);
  });

  it('いつもと違う日のお知らせと一緒に、時刻順に並ぶ', () => {
    const state = withChecks({ daily: { enabled: true, time: '20:00' } });
    state.overrides = { '2026-10-19': { typeId: 'off' } }; // 月曜休み → 火曜 07:00 にお知らせ
    const plan = planAll(state, new Date(2026, 9, 19, 6, 0), 2);
    expect(plan.map((p) => [p.kind, p.at])).toEqual([
      ['check', new Date(2026, 9, 19, 20, 0)],
      ['alert', new Date(2026, 9, 20, 7, 0)],
      ['check', new Date(2026, 9, 20, 20, 0)],
    ]);
    const ids = plan.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
