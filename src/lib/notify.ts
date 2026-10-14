// お知らせを届ける部分。
//  - カレンダー方式：スマホのカレンダーに予定を書き込み、カレンダーに通知してもらう（アプリを閉じても届く）
//  - アプリ方式　　：このアプリ自身が通知を予約する（機種によってはアプリを閉じると消される）
// ブラウザで動かしているときは何もしない（画面の表示だけで確認する）。
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { planNotifications, type PlannedNotification } from '../core/schedule';
import type { AppState } from '../core/types';
import { ItsumoCalendar, type CalendarEvent, type CalendarInfo } from './calendar';

const CHANNEL_ID = 'changes';
const TEST_ID = 1;

export const isNativeApp = () => Capacitor.isNativePlatform();

export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

const toState = (s: string): PermissionState => (s === 'granted' ? 'granted' : s === 'denied' ? 'denied' : 'prompt');

// ---------- 許可 ----------

export const getPermission = async (): Promise<PermissionState> => {
  if (!isNativeApp()) return 'unsupported';
  return toState((await LocalNotifications.checkPermissions()).display);
};

export const requestPermission = async (): Promise<PermissionState> => {
  if (!isNativeApp()) return 'unsupported';
  return toState((await LocalNotifications.requestPermissions()).display);
};

export const getCalendarPermission = async (): Promise<PermissionState> => {
  if (!isNativeApp()) return 'unsupported';
  return toState((await ItsumoCalendar.checkPermissions()).calendar);
};

export const requestCalendarPermission = async (): Promise<PermissionState> => {
  if (!isNativeApp()) return 'unsupported';
  return toState((await ItsumoCalendar.requestPermissions()).calendar);
};

export const listCalendars = async (): Promise<CalendarInfo[]> => {
  if (!isNativeApp() || (await getCalendarPermission()) !== 'granted') return [];
  return (await ItsumoCalendar.listCalendars()).calendars;
};

/** 時間ぴったりに通知できるか（Android 12以降は設定でオフにできる） */
export const getExactAlarm = async (): Promise<boolean | null> => {
  if (!isNativeApp()) return null;
  try {
    const { exact_alarm } = await LocalNotifications.checkExactNotificationSetting();
    return exact_alarm === 'granted';
  } catch {
    return null;
  }
};

export const openExactAlarmSetting = async () => {
  if (!isNativeApp()) return;
  await LocalNotifications.changeExactNotificationSetting();
};

/** お知らせを届けるために、まだ許可が足りないか */
export const needsSetup = async (state: AppState): Promise<boolean> => {
  if (!isNativeApp() || !state.settings.notificationsEnabled) return false;
  const method = state.settings.notifyMethod;
  if (method !== 'app' && (await getCalendarPermission()) !== 'granted') return true;
  if (method !== 'calendar' && (await getPermission()) !== 'granted') return true;
  return false;
};

// ---------- 予約 ----------

let channelReady = false;
const ensureChannel = async () => {
  if (channelReady) return;
  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: 'いつもと違う日のお知らせ',
    description: '予定変更で持ち物や行動が変わった日に知らせます',
    importance: 4,
  });
  channelReady = true;
};

export interface MethodResult {
  count: number;
  error?: string;
  /** 予約しなかった理由（オフ・未許可など） */
  skipped?: string;
}

export interface SyncResult {
  app: MethodResult & { inexact: boolean };
  calendar: MethodResult;
  planned: PlannedNotification[];
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

const toCalendarEvent = (p: PlannedNotification): CalendarEvent => ({
  title: `🔔 ${p.items.join('・')}（いつもと違う日）`,
  description: `${p.title}\n${p.body}`,
  start: p.at.getTime(),
});

const syncCalendar = async (state: AppState, planned: PlannedNotification[], extra: CalendarEvent[] = []): Promise<MethodResult> => {
  const use = state.settings.notificationsEnabled && state.settings.notifyMethod !== 'app';
  if ((await getCalendarPermission()) !== 'granted') {
    return { count: 0, skipped: use ? 'カレンダーへのアクセスが許可されていません' : undefined };
  }
  if (!use) {
    await ItsumoCalendar.clear();
    return { count: 0 };
  }
  const events = [...planned.map(toCalendarEvent), ...extra];
  const { count } = await ItsumoCalendar.sync({ events, calendarId: state.settings.calendarId || undefined });
  return { count };
};

const syncApp = async (state: AppState, planned: PlannedNotification[]): Promise<MethodResult & { inexact: boolean }> => {
  const pending = await LocalNotifications.getPending();
  const ours = pending.notifications.filter((n) => n.id !== TEST_ID);
  if (ours.length > 0) {
    await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
  }
  if (!state.settings.notificationsEnabled) return { count: 0, inexact: false, skipped: 'お知らせがオフです' };
  if (state.settings.notifyMethod === 'calendar') return { count: 0, inexact: false };
  if ((await getPermission()) !== 'granted') return { count: 0, inexact: false, skipped: '通知が許可されていません' };
  if (planned.length === 0) return { count: 0, inexact: false };

  // 時間ぴったりの通知がオフだと、プラグインが毎回設定画面を開いてしまうので、
  // その場合は最初から「数分おくれてもよい」通知として予約する
  const exact = (await getExactAlarm()) !== false;
  await ensureChannel();
  await LocalNotifications.schedule({
    notifications: planned.map((p) => ({
      id: p.id,
      title: p.title,
      body: p.body,
      largeBody: p.body,
      channelId: CHANNEL_ID,
      schedule: { at: p.at, allowWhileIdle: true },
      isExactNotification: exact,
    })),
  });
  return { count: planned.length, inexact: !exact };
};

const doSync = async (state: AppState, extraCalendar: CalendarEvent[] = []): Promise<SyncResult> => {
  const planned = planNotifications(state, new Date());
  const [app, calendar] = await Promise.all([
    syncApp(state, planned).catch((e) => ({ count: 0, inexact: false, error: errorText(e) })),
    syncCalendar(state, planned, extraCalendar).catch((e) => ({ count: 0, error: errorText(e) })),
  ]);
  return { app, calendar, planned };
};

export const EMPTY_SYNC: SyncResult = { app: { count: 0, inexact: false }, calendar: { count: 0 }, planned: [] };

let queue: Promise<unknown> = Promise.resolve();
const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
  const run = queue.then(fn);
  queue = run.catch(() => undefined);
  return run;
};

/**
 * 予約を全部取り消して、今のデータで予約し直す。
 * 予定や設定を変えるたびに呼ぶ。同時に2回動かないよう、順番に実行する。
 */
export const syncNotifications = (state: AppState): Promise<SyncResult> => {
  if (!isNativeApp()) return Promise.resolve(EMPTY_SYNC);
  return enqueue(() => doSync(state));
};

// ---------- テスト ----------

/** アプリ方式のテスト通知 */
export const sendTestNotification = async (seconds: number) => {
  if (!isNativeApp()) return;
  await ensureChannel();
  await LocalNotifications.schedule({
    notifications: [
      {
        id: TEST_ID,
        title: 'テスト通知',
        body: 'この通知が見えていれば、アプリからのお知らせは届きます。',
        channelId: CHANNEL_ID,
        schedule: { at: new Date(Date.now() + seconds * 1000), allowWhileIdle: true },
        isExactNotification: (await getExactAlarm()) !== false,
      },
    ],
  });
};

/** カレンダー方式のテスト：2分後の予定を1件だけ足して書き込む（次に予約し直すと消える） */
export const sendCalendarTest = (state: AppState): Promise<SyncResult> =>
  enqueue(() =>
    doSync(state, [
      {
        title: '🔔 テスト（いつもと違う日）',
        description: 'この通知が見えていれば、カレンダーからのお知らせは届きます。',
        start: Date.now() + 120_000,
      },
    ]),
  );
