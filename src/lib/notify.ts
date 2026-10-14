// スマホ（Android）の通知機能とのつなぎ役。
// ブラウザで動かしているときは何もしない（画面の表示だけで確認する）。
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { planNotifications } from '../core/schedule';
import type { AppState } from '../core/types';

const CHANNEL_ID = 'changes';

export const isNativeApp = () => Capacitor.isNativePlatform();

export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

export const getPermission = async (): Promise<PermissionState> => {
  if (!isNativeApp()) return 'unsupported';
  const { display } = await LocalNotifications.checkPermissions();
  return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt';
};

export const requestPermission = async (): Promise<PermissionState> => {
  if (!isNativeApp()) return 'unsupported';
  const { display } = await LocalNotifications.requestPermissions();
  return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt';
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

export interface SyncResult {
  count: number;
  /** 時間ぴったりにできず、数分おくれる可能性がある */
  inexact: boolean;
  error?: string;
  /** 通知が予約されなかった理由（オフ・未許可など） */
  skipped?: string;
}

const doSync = async (state: AppState): Promise<SyncResult> => {
  const pending = await LocalNotifications.getPending();
  const ours = pending.notifications.filter((n) => n.id !== TEST_ID);
  if (ours.length > 0) {
    await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
  }
  if (!state.settings.notificationsEnabled) return { count: 0, inexact: false, skipped: 'お知らせがオフです' };
  if ((await getPermission()) !== 'granted') return { count: 0, inexact: false, skipped: '通知が許可されていません' };

  const planned = planNotifications(state, new Date());
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

let queue: Promise<unknown> = Promise.resolve();

/**
 * 予約中のお知らせを全部取り消して、今のデータで予約し直す。
 * 予定や設定を変えるたびに呼ぶ。同時に2回動かないよう、順番に実行する。
 */
export const syncNotifications = (state: AppState): Promise<SyncResult> => {
  if (!isNativeApp()) return Promise.resolve({ count: 0, inexact: false });
  const run = queue.then(() =>
    doSync(state).catch((e: unknown) => ({
      count: 0,
      inexact: false,
      error: e instanceof Error ? e.message : String(e),
    })),
  );
  queue = run;
  return run;
};

export interface PendingInfo {
  id: number;
  title: string;
  at?: Date;
}

/** スマホに実際に予約されているお知らせ（確認用） */
export const listPending = async (): Promise<PendingInfo[]> => {
  if (!isNativeApp()) return [];
  const { notifications } = await LocalNotifications.getPending();
  return notifications
    .map((n) => ({ id: n.id, title: n.title, at: n.schedule?.at ? new Date(n.schedule.at) : undefined }))
    .sort((a, b) => (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0));
};

const TEST_ID = 1;

/** 通知が届くか試すため、指定した秒数後にテスト通知を出す */
export const sendTestNotification = async (seconds: number) => {
  if (!isNativeApp()) return;
  await ensureChannel();
  await LocalNotifications.schedule({
    notifications: [
      {
        id: TEST_ID,
        title: 'テスト通知',
        body: 'この通知が見えていれば、お知らせは正しく届きます。',
        channelId: CHANNEL_ID,
        schedule: { at: new Date(Date.now() + seconds * 1000), allowWhileIdle: true },
        isExactNotification: (await getExactAlarm()) !== false,
      },
    ],
  });
};
