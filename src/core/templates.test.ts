import { describe, expect, it } from 'vitest';
import { applyTemplate, buildDemo, templateItems, TEMPLATES } from './templates';
import { createDefaultState } from './defaults';
import { computeAlerts } from './engine';
import { itemNames } from './schedule';

const TODAY = '2026-10-14'; // 水曜日
const all = (id: Parameters<typeof templateItems>[0], hospital = false) => templateItems(id, hospital).map((i) => i.id);

describe('ひな形', () => {
  it('平日に出勤：月曜休みで火曜に作業服・社員証、金曜休みで木曜に持ち帰り', () => {
    const s = applyTemplate(createDefaultState(), 'office', all('office'), false, TODAY);
    const changed = { ...s, overrides: { '2026-10-19': { typeId: 'off' }, '2026-10-23': { typeId: 'paid' } } };
    const alerts = computeAlerts(changed, '2026-10-19', '2026-10-25');
    expect(alerts.map((a) => [a.targetDate, itemNames(s, a.itemIds)])).toEqual([
      ['2026-10-20', ['作業服', '社員証']],
      ['2026-10-22', ['作業服を持ち帰る']],
    ]);
  });

  it('普段どおりの週は、どのひな形でもお知らせなし', () => {
    for (const t of TEMPLATES) {
      const s = applyTemplate(createDefaultState(), t.id, all(t.id, true), true, TODAY);
      expect(computeAlerts(s, TODAY, '2026-11-30')).toEqual([]);
    }
  });

  it('シフト勤務：休みの日が出勤になったら、前日に制服を知らせる', () => {
    const s = applyTemplate(createDefaultState(), 'shift', ['uniform'], false, TODAY);
    // 10/14 出勤, 15 出勤, 16 休み, 17 休み
    const alerts = computeAlerts({ ...s, overrides: { '2026-10-16': { typeId: 'work' } } }, TODAY, '2026-10-31');
    expect(alerts.map((a) => [a.notifyDate, a.targetDate, itemNames(s, a.itemIds)])).toEqual([['2026-10-15', '2026-10-16', ['制服']]]);
  });

  it('子どもの学校：月曜が休みなら、月曜の夜（火曜の前日）に上履き・給食袋', () => {
    const s = applyTemplate(createDefaultState(), 'school', all('school'), false, TODAY);
    const alerts = computeAlerts({ ...s, overrides: { '2026-10-19': { typeId: 'off' } } }, '2026-10-18', '2026-10-25');
    expect(alerts.map((a) => [a.notifyDate, itemNames(s, a.itemIds)])).toEqual([['2026-10-19', ['上履き', '給食袋']]]);
  });

  it('通院：病院の日の前日に診察券・保険証', () => {
    const s = applyTemplate(createDefaultState(), 'free', all('free', true), true, TODAY);
    const alerts = computeAlerts({ ...s, overrides: { '2026-10-21': { typeId: 'hospital' } } }, TODAY, '2026-10-31');
    expect(alerts.map((a) => [a.notifyDate, itemNames(s, a.itemIds)])).toEqual([['2026-10-20', ['診察券', '保険証']]]);
  });

  it('チェックを外した持ち物は入らず、持ち物がなくなったルールも消える', () => {
    const s = applyTemplate(createDefaultState(), 'office', ['uniform'], false, TODAY);
    expect(s.items.map((i) => i.name)).toEqual(['作業服']);
    expect(s.rules.map((r) => r.id)).toEqual(['first-workday']);
  });

  it('お試し：平日に出勤なら「来週の月曜が休みになったら火曜に作業服」', () => {
    const s = applyTemplate(createDefaultState(), 'office', all('office'), false, TODAY);
    expect(buildDemo(s, TODAY)).toEqual({
      change: '10月19日（月）が「休み」になったら…',
      resultDate: '10月20日（火）の朝',
      reason: '月曜日が休みになったため、10月20日（火）は今週最初の出勤日です。',
      items: ['作業服', '社員証'],
    });
  });

  it('お試し：持ち物を何も選ばなかったら見本なし', () => {
    const s = applyTemplate(createDefaultState(), 'free', [], false, TODAY);
    expect(buildDemo(s, TODAY)).toBeNull();
  });
});
