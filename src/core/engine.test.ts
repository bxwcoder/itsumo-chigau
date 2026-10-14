import { describe, expect, it } from 'vitest';
import { computeAlerts } from './engine';
import { createDefaultState } from './defaults';
import type { AppState } from './types';

// 2026-10-12 は月曜日
const MON = '2026-10-12';
const TUE = '2026-10-13';
const SUN = '2026-10-18';

const withOverrides = (overrides: AppState['overrides'], patch: Partial<AppState> = {}): AppState => ({
  ...createDefaultState(),
  overrides,
  ...patch,
});

describe('指示書の具体例：月曜日を休みに変更', () => {
  it('通常どおりの週には、お知らせが出ない', () => {
    expect(computeAlerts(withOverrides({}), MON, SUN)).toEqual([]);
  });

  it('月曜が休みになると、火曜日に作業服と社員証が必要と判断する', () => {
    const alerts = computeAlerts(withOverrides({ [MON]: { typeId: 'off' } }), MON, SUN);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      targetDate: TUE,
      notifyDate: TUE,
      itemIds: ['uniform', 'idcard'],
    });
    expect(alerts[0].reason).toBe('月曜日が休みになったため、今日は今週最初の出勤日です。');
  });

  it('予定変更を元に戻すと、お知らせも消える', () => {
    const state = withOverrides({ [MON]: { typeId: 'off' } });
    expect(computeAlerts(state, MON, SUN)).toHaveLength(1);
    const { [MON]: _removed, ...rest } = state.overrides;
    expect(computeAlerts({ ...state, overrides: rest }, MON, SUN)).toEqual([]);
  });

  it('有給でも同じように判断する', () => {
    const alerts = computeAlerts(withOverrides({ [MON]: { typeId: 'paid' } }), MON, SUN);
    expect(alerts.map((a) => a.targetDate)).toEqual([TUE]);
    expect(alerts[0].reason).toContain('月曜日が有給になった');
  });

  it('予定変更しても中身が通常と同じなら、お知らせは出ない', () => {
    expect(computeAlerts(withOverrides({ [MON]: { typeId: 'work' } }), MON, SUN)).toEqual([]);
  });
});

describe('いろいろなケース', () => {
  it('月・火が休みなら水曜日が今週最初の出勤日', () => {
    const alerts = computeAlerts(withOverrides({ [MON]: { typeId: 'off' }, [TUE]: { typeId: 'off' } }), MON, SUN);
    expect(alerts.map((a) => a.targetDate)).toEqual(['2026-10-14']);
    expect(alerts[0].reason).toBe('月曜日が休み、火曜日が休みになったため、今日は今週最初の出勤日です。');
  });

  it('1週間ずっと休みなら、お知らせはない', () => {
    const overrides = Object.fromEntries(
      ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'].map((d) => [d, { typeId: 'off' }]),
    );
    expect(computeAlerts(withOverrides(overrides), MON, SUN)).toEqual([]);
  });

  it('前日に知らせるルールでは、新しい出勤日の前日にお知らせする', () => {
    const base = createDefaultState();
    const rules = base.rules.map((r) => ({ ...r, timing: 'dayBefore' as const }));
    // 普段は日曜の夜にお知らせ → 通常どおりなので出ない
    expect(computeAlerts(withOverrides({}, { rules }), '2026-10-11', SUN)).toEqual([]);

    const alerts = computeAlerts(withOverrides({ [MON]: { typeId: 'off' } }, { rules }), '2026-10-11', SUN);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ targetDate: TUE, notifyDate: MON, timing: 'dayBefore' });
    expect(alerts[0].reason).toBe('月曜日が休みになったため、明日（10月13日（火））は今週最初の出勤日です。');
  });

  it('期間の最後の日が「翌週最初の出勤日の前日」でも見落とさない', () => {
    const base = createDefaultState();
    const rules = base.rules.map((r) => ({ ...r, timing: 'dayBefore' as const }));
    // 翌週の月曜(10/19)が休み → 火曜(10/20)の前日 = 10/19 にお知らせ
    const alerts = computeAlerts(withOverrides({ '2026-10-19': { typeId: 'off' } }, { rules }), MON, '2026-10-19');
    expect(alerts.map((a) => a.notifyDate)).toEqual(['2026-10-19']);
  });

  it('「出勤の日すべて」ルール：休みの土曜が出勤になった日だけ知らせる', () => {
    const state = withOverrides(
      { '2026-10-17': { typeId: 'work' } },
      {
        items: [{ id: 'lunch', name: '弁当', kind: 'item' }],
        rules: [
          {
            id: 'lunch',
            condition: { kind: 'every', typeIds: ['work'] },
            itemIds: ['lunch'],
            timing: 'sameDay',
            enabled: true,
          },
        ],
      },
    );
    const alerts = computeAlerts(state, MON, SUN);
    expect(alerts.map((a) => a.targetDate)).toEqual(['2026-10-17']);
    expect(alerts[0].reason).toBe('土曜日が出勤になったため、今日は出勤日です。');
  });

  it('「今週最後の出勤日」ルール：金曜が休みなら木曜日に持ち帰る', () => {
    const state = withOverrides(
      { '2026-10-16': { typeId: 'paid' } },
      {
        rules: [
          {
            id: 'take-home',
            condition: { kind: 'lastOfWeek', typeIds: ['work'] },
            itemIds: ['uniform'],
            timing: 'sameDay',
            enabled: true,
          },
        ],
      },
    );
    expect(computeAlerts(state, MON, SUN).map((a) => a.targetDate)).toEqual(['2026-10-15']);
  });

  it('シフト（3日周期：出勤・出勤・休み）でも判断できる', () => {
    const state = withOverrides(
      {},
      { pattern: { kind: 'cycle', cycle: ['work', 'work', 'off'], startDate: '2026-10-11' } },
    );
    // 10/11(日)出勤 は前の週。今週: 月=出勤 火=休み 水=出勤 …
    expect(computeAlerts(state, MON, SUN)).toEqual([]);
    const changed = { ...state, overrides: { [MON]: { typeId: 'off' } } };
    expect(computeAlerts(changed, MON, SUN).map((a) => a.targetDate)).toEqual(['2026-10-14']);
  });

  it('止めているルールでは知らせない', () => {
    const base = createDefaultState();
    const rules = base.rules.map((r) => ({ ...r, enabled: false }));
    expect(computeAlerts(withOverrides({ [MON]: { typeId: 'off' } }, { rules }), MON, SUN)).toEqual([]);
  });
});
