// お知らせの予定表を作る（いつ・何を知らせるか）。スマホの通知機能には依存しない。

import { computeAlerts, confirmKey, type Alert } from './engine';
import { addDays, parseDate, toDateStr, weekdayOf } from './dates';
import type { AppState, DateStr } from './types';

export type CheckKind = 'daily' | 'weekly' | 'monthly';

export interface PlannedNotification {
  /** alert: いつもと違う日のお知らせ / check: 予定変更がないかの確認 */
  kind: 'alert' | 'check';
  checkKind?: CheckKind;
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
  const today = toDateStr(now);
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
      kind: 'alert',
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

export const CHECK_MESSAGES: Record<CheckKind, string> = {
  daily: '明日は予定の変更はありませんか？',
  weekly: '今週は予定の変更はありませんか？',
  monthly: '今月は予定の変更はありませんか？',
};

const CHECK_ID_OFFSET: Record<CheckKind, number> = { daily: 3, weekly: 4, monthly: 5 };

/** その月の最後の日 */
const lastDayOfMonth = (date: DateStr): number => {
  const d = parseDate(date);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
};

/** 入力わすれ防止の確認お知らせを、今日から days 日分つくる */
export const planChecks = (state: AppState, now: Date, days = 60): PlannedNotification[] => {
  const { daily, weekly, monthly } = state.settings.checkReminders;
  const today = toDateStr(now);
  const planned: PlannedNotification[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const day = Number(date.slice(8));
    const hits: [CheckKind, string][] = [];
    if (daily.enabled) hits.push(['daily', daily.time]);
    if (weekly.enabled && weekdayOf(date) === weekly.weekday) hits.push(['weekly', weekly.time]);
    if (monthly.enabled && day === (monthly.day === 0 ? lastDayOfMonth(date) : monthly.day)) hits.push(['monthly', monthly.time]);
    for (const [checkKind, time] of hits) {
      const at = atTime(date, time);
      if (at.getTime() <= now.getTime()) continue;
      planned.push({
        kind: 'check',
        checkKind,
        id: Number(date.replaceAll('-', '')) * 10 + CHECK_ID_OFFSET[checkKind],
        at,
        title: CHECK_MESSAGES[checkKind],
        body: '変更があれば、アプリの「＋予定変更」から登録してください。',
        items: [],
        alerts: [],
      });
    }
  }
  return planned;
};

/** いつもと違う日のお知らせと、確認のお知らせを全部まとめる */
export const planAll = (state: AppState, now: Date, days = 60): PlannedNotification[] =>
  [...planNotifications(state, now, days), ...planChecks(state, now, days)].sort((a, b) => a.at.getTime() - b.at.getTime());
