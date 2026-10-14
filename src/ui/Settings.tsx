import React, { useEffect, useState } from 'react';
import type { AppState, Settings as SettingsT } from '../core/types';
import {
  getCalendarPermission,
  getExactAlarm,
  getPermission,
  isNativeApp,
  listCalendars,
  openExactAlarmSetting,
  requestCalendarPermission,
  requestPermission,
  sendCalendarTest,
  sendTestNotification,
  type PermissionState,
  type SyncResult,
} from '../lib/notify';
import type { CalendarInfo } from '../lib/calendar';
import { Card, SectionTitle, SubButton } from './common';

interface Props {
  state: AppState;
  syncResult: SyncResult;
  onSyncResult: (r: SyncResult) => void;
  update: (fn: (s: AppState) => AppState) => void;
  onReset: () => void;
}

const PERMISSION_LABEL: Record<PermissionState, string> = {
  granted: '許可されています',
  denied: '許可されていません（スマホの「設定」→「アプリ」→「いつもと違う日」→「権限」から許可してください）',
  prompt: 'まだ許可していません',
  unsupported: 'ブラウザ版のため使えません',
};

const METHODS: [SettingsT['notifyMethod'], string, string][] = [
  ['calendar', 'カレンダーで知らせる（おすすめ）', 'スマホのカレンダーに予定を書き込み、カレンダーが通知します。アプリを閉じても届きます。'],
  ['app', 'このアプリで知らせる', '機種によっては、アプリを閉じると届きません。'],
  ['both', '両方', '同じお知らせが2回届きます。'],
];

const formatAt = (d: Date) =>
  d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });

export const Settings: React.FC<Props> = ({ state, syncResult, onSyncResult, update, onReset }) => {
  const [permission, setPermission] = useState<PermissionState>('unsupported');
  const [calendarPermission, setCalendarPermission] = useState<PermissionState>('unsupported');
  const [calendars, setCalendars] = useState<CalendarInfo[]>([]);
  const [exact, setExact] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');

  const refresh = async () => {
    setPermission(await getPermission());
    setCalendarPermission(await getCalendarPermission());
    setCalendars(await listCalendars().catch(() => []));
    setExact(await getExactAlarm());
  };

  useEffect(() => {
    refresh();
    // スマホの設定アプリから戻ってきたら状態を読み直す
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const set = (patch: Partial<SettingsT>) => update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  const resync = () => update((s) => ({ ...s }));
  const s = state.settings;
  const useCalendar = s.notifyMethod !== 'app';
  const useApp = s.notifyMethod !== 'calendar';
  const errors = [syncResult.calendar.error, syncResult.app.error].filter(Boolean);
  const skipped = [useCalendar && syncResult.calendar.skipped, useApp && syncResult.app.skipped].filter(Boolean);

  return (
    <div className="p-4">
      <SectionTitle>お知らせ</SectionTitle>
      <Card className="space-y-4">
        <label className="flex items-center justify-between">
          <span className="font-semibold">お知らせを使う</span>
          <input
            type="checkbox"
            className="w-6 h-6 accent-teal-700"
            checked={s.notificationsEnabled}
            onChange={(e) => set({ notificationsEnabled: e.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between">
          <span>
            <span className="font-semibold block">当日のお知らせ時刻</span>
            <span className="text-xs text-stone-500">「その日の朝」のルール</span>
          </span>
          <input
            type="time"
            value={s.sameDayTime}
            onChange={(e) => e.target.value && set({ sameDayTime: e.target.value })}
            className="border border-stone-300 rounded-lg px-2 py-2 bg-white"
          />
        </label>
        <label className="flex items-center justify-between">
          <span>
            <span className="font-semibold block">前日のお知らせ時刻</span>
            <span className="text-xs text-stone-500">「前日の夜」のルール</span>
          </span>
          <input
            type="time"
            value={s.dayBeforeTime}
            onChange={(e) => e.target.value && set({ dayBeforeTime: e.target.value })}
            className="border border-stone-300 rounded-lg px-2 py-2 bg-white"
          />
        </label>
      </Card>

      <SectionTitle>知らせ方</SectionTitle>
      <Card className="space-y-2">
        {METHODS.map(([id, label, note]) => (
          <button
            key={id}
            onClick={() => set({ notifyMethod: id })}
            className={`w-full text-left rounded-xl border px-3 py-2 ${s.notifyMethod === id ? 'border-teal-700 bg-teal-50 ring-2 ring-teal-600/30' : 'border-stone-300 bg-white'}`}
          >
            <span className="font-semibold block">
              {s.notifyMethod === id ? '◉ ' : '○ '}
              {label}
            </span>
            <span className="text-xs text-stone-600">{note}</span>
          </button>
        ))}
      </Card>

      {isNativeApp() && useCalendar && (
        <>
          <SectionTitle>カレンダー</SectionTitle>
          <Card className="space-y-3">
            <p>
              カレンダーへのアクセス：<span className="font-semibold">{PERMISSION_LABEL[calendarPermission]}</span>
            </p>
            {calendarPermission !== 'granted' && (
              <SubButton
                onClick={async () => {
                  setCalendarPermission(await requestCalendarPermission());
                  setCalendars(await listCalendars().catch(() => []));
                  resync();
                }}
              >
                カレンダーへのアクセスを許可する
              </SubButton>
            )}
            {calendarPermission === 'granted' && (
              <>
                <label className="block">
                  <span className="font-semibold block mb-1">書き込み先</span>
                  <select
                    value={s.calendarId}
                    onChange={(e) => set({ calendarId: Number(e.target.value) })}
                    className="w-full border border-stone-300 rounded-lg px-2 py-2 bg-white"
                  >
                    <option value={0}>専用カレンダー「いつもと違う日」（おすすめ）</option>
                    {calendars
                      .filter((c) => !c.isOwn)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}（{c.account}）
                        </option>
                      ))}
                  </select>
                  <span className="text-xs text-stone-500 block mt-1">
                    専用カレンダーで通知が来ないときは、ふだん使っているカレンダーを選んでください。
                  </span>
                </label>
                <SubButton
                  onClick={async () => {
                    onSyncResult(await sendCalendarTest(state));
                    setMessage('2分後にカレンダーからテスト通知が届きます。アプリを閉じて（はじいて消してもOK）待ってください。');
                  }}
                >
                  カレンダーでテスト（2分後）
                </SubButton>
              </>
            )}
          </Card>
        </>
      )}

      {isNativeApp() && useApp && (
        <>
          <SectionTitle>アプリの通知</SectionTitle>
          <Card className="space-y-3">
            <p>
              通知：<span className="font-semibold">{PERMISSION_LABEL[permission]}</span>
            </p>
            {permission === 'prompt' && (
              <SubButton
                onClick={async () => {
                  setPermission(await requestPermission());
                  resync();
                }}
              >
                通知を許可する
              </SubButton>
            )}
            {exact !== null && (
              <>
                <p>
                  時間ぴったりの通知：<span className="font-semibold">{exact ? 'オン' : 'オフ（数分おくれることがあります）'}</span>
                </p>
                {!exact && <SubButton onClick={openExactAlarmSetting}>オンにする（設定画面が開きます）</SubButton>}
              </>
            )}
            {permission === 'granted' && (
              <div className="flex flex-wrap gap-2">
                <SubButton
                  onClick={async () => {
                    await sendTestNotification(5);
                    setMessage('5秒後にテスト通知が届きます。');
                  }}
                >
                  テスト通知（5秒後）
                </SubButton>
                <SubButton
                  onClick={async () => {
                    await sendTestNotification(120);
                    setMessage('2分後にテスト通知が届きます。アプリを閉じて待ってください。');
                  }}
                >
                  テスト通知（2分後）
                </SubButton>
              </div>
            )}
          </Card>
        </>
      )}
      {message && <p className="text-sm text-teal-800 mt-2 px-1">{message}</p>}

      {isNativeApp() && (
        <>
          <SectionTitle>予約中のお知らせ（60日先まで）</SectionTitle>
          <Card className="space-y-2">
            {errors.map((e) => (
              <p key={e} className="text-sm font-bold text-rose-700">
                予約に失敗しました：{e}
              </p>
            ))}
            {skipped.map((e) => (
              <p key={String(e)} className="text-sm font-bold text-amber-700">
                予約していません：{e}
              </p>
            ))}
            {useApp && syncResult.app.inexact && syncResult.app.count > 0 && (
              <p className="text-sm text-amber-700">「時間ぴったりの通知」がオフのため、アプリの通知は数分おくれることがあります。</p>
            )}
            {useCalendar && syncResult.calendar.count > 0 && (
              <p className="text-sm text-teal-800">カレンダーに {syncResult.calendar.count} 件書き込みました。</p>
            )}
            {syncResult.planned.length === 0 ? (
              <p className="text-stone-500">ありません。</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {syncResult.planned.map((p) => (
                  <li key={p.id} className="py-2">
                    <span className="font-semibold block">{formatAt(p.at)}</span>
                    <span className="text-stone-600 text-sm">{p.items.join('・')}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-stone-500">
              お知らせ時刻をすでに過ぎた分は予約しません。今日のお知らせを試すときは、予定を変更してから時刻を数分後にしてください。
            </p>
          </Card>
        </>
      )}

      <SectionTitle>カレンダーの数え方</SectionTitle>
      <Card>
        <label className="flex items-center justify-between">
          <span>
            <span className="font-semibold block">週の始まり</span>
            <span className="text-xs text-stone-500">「今週最初の」の数え方が変わります</span>
          </span>
          <select
            value={s.weekStartsOn}
            onChange={(e) => set({ weekStartsOn: Number(e.target.value) as 0 | 1 })}
            className="border border-stone-300 rounded-lg px-2 py-2 bg-white"
          >
            <option value={1}>月曜日</option>
            <option value={0}>日曜日</option>
          </select>
        </label>
      </Card>

      <SectionTitle>データ</SectionTitle>
      <Card>
        <p className="text-sm text-stone-600 mb-3">データはこのスマホの中だけに保存しています。</p>
        <SubButton
          onClick={() => window.confirm('すべてのデータを消して、最初の状態に戻しますか？') && onReset()}
          className="text-rose-700 border-rose-300"
        >
          最初の状態に戻す
        </SubButton>
      </Card>
    </div>
  );
};
