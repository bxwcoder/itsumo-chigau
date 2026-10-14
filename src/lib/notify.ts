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

/**
 * 予約中のお知らせを全部取り消して、今のデータで予約し直す。
 * 予定や設定を変えるたびに呼ぶ。
 */
export const syncNotifications = async (state: AppState): Promise<number> => {
  if (!isNativeApp()) return 0;
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  }
  if (!state.settings.notificationsEnabled) return 0;
  if ((await getPermission()) !== 'granted') return 0;

  await ensureChannel();
  const planned = planNotifications(state, new Date());
  if (planned.length === 0) return 0;
  await LocalNotifications.schedule({
    notifications: planned.map((p) => ({
      id: p.id,
      title: p.title,
      body: p.body,
      largeBody: p.body,
      channelId: CHANNEL_ID,
      schedule: { at: p.at, allowWhileIdle: true },
    })),
  });
  return planned.length;
};

/** 通知が届くか試すため、5秒後にテスト通知を出す */
export const sendTestNotification = async () => {
  if (!isNativeApp()) return;
  await ensureChannel();
  await LocalNotifications.schedule({
    notifications: [
      {
        id: 1,
        title: 'テスト通知',
        body: 'この通知が見えていれば、お知らせは正しく届きます。',
        channelId: CHANNEL_ID,
        schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
      },
    ],
  });
};
