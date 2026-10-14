// お知らせの予定表を作る（いつ・何を知らせるか）。スマホの通知機能には依存しない。

import { computeAlerts, confirmKey, type Alert } from './engine';
import { addDays, parseDate } from './dates';
import type { AppState, DateStr } from './types';

export interface PlannedNotification {
  /** 同じ日・同じ時間帯なら同じ番号（上書き・取り消しに使う） */
  id: number;
  at: Date;
  title: string;
  body: string;
  /** 持ち物・行動の名前 */
  items: string[];
  alerts: Alert[];
}

const atTime = (date: DateStr, hhmm: string): Date => {
  const d = parseDate(date);
  const [h, m] = hhmm.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
};

export const itemNames = (state: AppState, itemIds: string[]): string[] =>
  itemIds.map((id) => state.items.find((i) => i.id === id)?.name).filter((n): n is string => !!n);

export const notificationId = (date: DateStr, timing: Alert['timing']): number =>
  Number(date.replaceAll('-', '')) * 10 + (timing === 'sameDay' ? 1 : 2);

/** 今日から days 日分のお知らせを作る。過ぎた時刻と「準備した」済みのものは除く */
export const planNotifications = (state: AppState, now: Date, days = 60): PlannedNotification[] => {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const alerts = computeAlerts(state, today, addDays(today, days - 1)).filter((a) => !state.confirmed[confirmKey(a)]);

  const groups = new Map<number, Alert[]>();
  for (const a of alerts) {
    const id = notificationId(a.notifyDate, a.timing);
    groups.set(id, [...(groups.get(id) ?? []), a]);
  }

  const planned: PlannedNotification[] = [];
  for (const [id, group] of groups) {
    const { notifyDate, timing } = group[0];
    const at = atTime(notifyDate, timing === 'sameDay' ? state.settings.sameDayTime : state.settings.dayBeforeTime);
    if (at.getTime() <= now.getTime()) continue;
    const items = [...new Set(group.flatMap((a) => itemNames(state, a.itemIds)))];
    const reasons = [...new Set(group.map((a) => a.reason))];
    planned.push({
      id,
      at,
      title: timing === 'sameDay' ? '今日はいつもと違います' : '明日はいつもと違います',
      body: `${reasons.join('\n')}\n${timing === 'sameDay' ? '今日' : '明日'}の持ち物・行動：${items.join('、')}`,
      items,
      alerts: group,
    });
  }
  return planned.sort((a, b) => a.at.getTime() - b.at.getTime());
};
