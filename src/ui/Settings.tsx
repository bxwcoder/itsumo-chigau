import React, { useEffect, useState } from 'react';
import type { AppState, CheckReminders, Settings as SettingsT } from '../core/types';
import { CHECK_MESSAGES } from '../core/schedule';
import { WEEKDAY_NAMES } from '../core/dates';
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
import { getDeviceInfo, getReminderApps, guideFor, openAppSettings, type DeviceInfo } from '../lib/device';
import { Card, SectionTitle, SubButton, fieldClass } from './common';

interface Props {
  state: AppState;
  syncResult: SyncResult;
  onSyncResult: (r: SyncResult) => void;
  update: (fn: (s: AppState) => AppState) => void;
  onReset: () => void;
  onRestartOnboarding: () => void;
}

/** 通知が届かないときの、機種別の案内 */
const TroubleGuide: React.FC<{ useCalendar: boolean }> = ({ useCalendar }) => {
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [reminderApps, setReminderApps] = useState<{ packageName: string; label: string }[]>([]);
  useEffect(() => {
    getDeviceInfo().then(setDevice).catch(() => undefined);
    getReminderApps().then(setReminderApps).catch(() => undefined);
  }, []);
  const guide = guideFor(device?.maker);

  return (
    <Card className="space-y-3">
      <p className="text-sm text-ink-2">
        スマホの省電力機能が、通知を止めてしまうことがあります。
        {device && `お使いの機種（${guide.name}）では、次の設定を試してください。`}
      </p>
      {useCalendar && reminderApps.length > 0 && (
        <div className="rounded-2xl bg-surface-2 p-3 space-y-2">
          <p className="text-sm">
            カレンダーのお知らせは「<span className="font-bold">{reminderApps.map((a) => a.label).join('」「')}</span>」から届きます。
            そのアプリの通知がオンか、下の省電力の設定もあわせて確認してください。
          </p>
          <div className="flex flex-wrap gap-2">
            {reminderApps.map((a) => (
              <SubButton key={a.packageName} onClick={() => openAppSettings(a.packageName)}>
                {a.label} の設定を開く
              </SubButton>
            ))}
          </div>
        </div>
      )}
      <ol className="list-decimal pl-5 space-y-1 text-sm">
        {guide.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <SubButton onClick={() => openAppSettings()}>このアプリの「アプリ情報」を開く</SubButton>
    </Card>
  );
};

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

const CheckRow: React.FC<{
  label: string;
  message: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}> = ({ label, message, enabled, onToggle, children }) => (
  <div className="py-3">
    <label className="flex items-center justify-between">
      <span className="font-semibold">{label}</span>
      <input type="checkbox" className="w-6 h-6 accent-[var(--color-primary)]" checked={enabled} onChange={(e) => onToggle(e.target.checked)} />
    </label>
    <p className="text-sm text-ink-2 mt-0.5">「{message}」</p>
    {enabled && <div className="flex flex-wrap items-center gap-2 mt-2">{children}</div>}
  </div>
);

const formatAt = (d: Date) =>
  d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });

export const Settings: React.FC<Props> = ({ state, syncResult, onSyncResult, update, onReset, onRestartOnboarding }) => {
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
  const setCheck = <K extends keyof CheckReminders>(key: K, patch: Partial<CheckReminders[K]>) =>
    update((st) => ({
      ...st,
      settings: {
        ...st.settings,
        checkReminders: { ...st.settings.checkReminders, [key]: { ...st.settings.checkReminders[key], ...patch } },
      },
    }));
  const checks = state.settings.checkReminders;
  const timeInput = (value: string, onChange: (v: string) => void, label: string) => (
    <input type="time" aria-label={label} value={value} onChange={(e) => e.target.value && onChange(e.target.value)} className={fieldClass} />
  );
  const resync = () => update((s) => ({ ...s }));
  const s = state.settings;
  const useCalendar = s.notifyMethod !== 'app';
  // カレンダーが許可されていないときは、代わりにアプリの通知を使う
  const useApp = s.notifyMethod !== 'calendar' || syncResult.fallback;
  const errors = [syncResult.calendar.error, syncResult.app.error].filter(Boolean);
  const skipped = [useCalendar && syncResult.calendar.skipped, useApp && syncResult.app.skipped].filter(Boolean);

  return (
    <div className="p-4">
      <SectionTitle>いつもと違う日のお知らせ</SectionTitle>
      <Card className="space-y-4">
        <label className="flex items-center justify-between">
          <span className="font-semibold">お知らせを使う（すべて）</span>
          <input
            type="checkbox"
            className="w-6 h-6 accent-[var(--color-primary)]"
            checked={s.notificationsEnabled}
            onChange={(e) => set({ notificationsEnabled: e.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between">
          <span>
            <span className="font-semibold block">当日のお知らせ時刻</span>
            <span className="text-xs text-ink-2">「その日の朝」のルール</span>
          </span>
          <input
            type="time"
            value={s.sameDayTime}
            onChange={(e) => e.target.value && set({ sameDayTime: e.target.value })}
            className={`${fieldClass}`}
          />
        </label>
        <label className="flex items-center justify-between">
          <span>
            <span className="font-semibold block">前日のお知らせ時刻</span>
            <span className="text-xs text-ink-2">「前日の夜」のルール</span>
          </span>
          <input
            type="time"
            value={s.dayBeforeTime}
            onChange={(e) => e.target.value && set({ dayBeforeTime: e.target.value })}
            className={`${fieldClass}`}
          />
        </label>
      </Card>

      <SectionTitle>入力わすれ防止</SectionTitle>
      <Card className="py-1">
        <p className="text-sm text-ink-2 pt-3">予定が変わったのに入力を忘れないよう、決まった時に確認のお知らせを出します。</p>
        <div className="divide-y divide-line">
          <CheckRow
            label="毎日"
            message={CHECK_MESSAGES.daily}
            enabled={checks.daily.enabled}
            onToggle={(enabled) => setCheck('daily', { enabled })}
          >
            {timeInput(checks.daily.time, (time) => setCheck('daily', { time }), '毎日の確認の時刻')}
            <span className="text-sm text-ink-2">に知らせる</span>
          </CheckRow>
          <CheckRow
            label="毎週"
            message={CHECK_MESSAGES.weekly}
            enabled={checks.weekly.enabled}
            onToggle={(enabled) => setCheck('weekly', { enabled })}
          >
            <select
              aria-label="毎週の確認の曜日"
              value={checks.weekly.weekday}
              onChange={(e) => setCheck('weekly', { weekday: Number(e.target.value) })}
              className={fieldClass}
            >
              {[1, 2, 3, 4, 5, 6, 0].map((w) => (
                <option key={w} value={w}>
                  {WEEKDAY_NAMES[w]}曜日
                </option>
              ))}
            </select>
            {timeInput(checks.weekly.time, (time) => setCheck('weekly', { time }), '毎週の確認の時刻')}
            <span className="text-sm text-ink-2">に知らせる</span>
          </CheckRow>
          <CheckRow
            label="毎月"
            message={CHECK_MESSAGES.monthly}
            enabled={checks.monthly.enabled}
            onToggle={(enabled) => setCheck('monthly', { enabled })}
          >
            <select
              aria-label="毎月の確認の日"
              value={checks.monthly.day}
              onChange={(e) => setCheck('monthly', { day: Number(e.target.value) })}
              className={fieldClass}
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}日
                </option>
              ))}
              <option value={0}>月末</option>
            </select>
            {timeInput(checks.monthly.time, (time) => setCheck('monthly', { time }), '毎月の確認の時刻')}
            <span className="text-sm text-ink-2">に知らせる</span>
          </CheckRow>
        </div>
      </Card>

      <SectionTitle>知らせ方</SectionTitle>
      <Card className="space-y-2">
        {METHODS.map(([id, label, note]) => (
          <button
            key={id}
            onClick={() => set({ notifyMethod: id })}
            className={`w-full text-left rounded-2xl border px-4 py-3 ${s.notifyMethod === id ? 'border-primary bg-primary-soft ring-2 ring-primary/30' : 'border-line bg-surface'}`}
          >
            <span className="font-semibold block">
              {s.notifyMethod === id ? '◉ ' : '○ '}
              {label}
            </span>
            <span className="text-xs text-ink-2">{note}</span>
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
            {syncResult.fallback && (
              <p className="text-sm text-alert">カレンダーが許可されていないため、代わりにこのアプリの通知で知らせています。</p>
            )}
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
                    className={`w-full ${fieldClass}`}
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
                  <span className="text-xs text-ink-2 block mt-1">
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
      {message && <p className="text-sm text-primary mt-2 px-1">{message}</p>}

      {isNativeApp() && (
        <>
          <SectionTitle>予約中のお知らせ（60日先まで）</SectionTitle>
          <Card className="space-y-2">
            {errors.map((e) => (
              <p key={e} className="text-sm font-bold text-rose-500">
                予約に失敗しました：{e}
              </p>
            ))}
            {skipped.map((e) => (
              <p key={String(e)} className="text-sm font-bold text-alert">
                予約していません：{e}
              </p>
            ))}
            {useApp && syncResult.app.inexact && syncResult.app.count > 0 && (
              <p className="text-sm text-alert">「時間ぴったりの通知」がオフのため、アプリの通知は数分おくれることがあります。</p>
            )}
            {useCalendar && syncResult.calendar.count > 0 && (
              <p className="text-sm text-primary">カレンダーに {syncResult.calendar.count} 件書き込みました。</p>
            )}
            {syncResult.planned.length === 0 ? (
              <p className="text-ink-2">ありません。</p>
            ) : (
              <ul className="divide-y divide-line">
                {syncResult.planned.map((p) => (
                  <li key={p.id} className="py-2">
                    <span className="font-semibold block">{formatAt(p.at)}</span>
                    <span className="text-ink-2 text-sm">{p.kind === 'check' ? `📝 ${p.title}` : `🔔 ${p.items.join('・')}`}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-ink-2">
              お知らせ時刻をすでに過ぎた分は予約しません。今日のお知らせを試すときは、予定を変更してから時刻を数分後にしてください。
            </p>
          </Card>
        </>
      )}

      {isNativeApp() && (
        <>
          <SectionTitle>通知が届かないとき</SectionTitle>
          <TroubleGuide useCalendar={useCalendar && !syncResult.fallback} />
        </>
      )}

      <SectionTitle>カレンダーの数え方</SectionTitle>
      <Card>
        <label className="flex items-center justify-between">
          <span>
            <span className="font-semibold block">週の始まり</span>
            <span className="text-xs text-ink-2">「今週最初の」の数え方が変わります</span>
          </span>
          <select
            value={s.weekStartsOn}
            onChange={(e) => set({ weekStartsOn: Number(e.target.value) as 0 | 1 })}
            className={`${fieldClass}`}
          >
            <option value={1}>月曜日</option>
            <option value={0}>日曜日</option>
          </select>
        </label>
      </Card>

      <SectionTitle>データ</SectionTitle>
      <Card>
        <p className="text-sm text-ink-2 mb-3">データはこのスマホの中だけに保存しています。</p>
        <SubButton
          className="mb-3"
          onClick={() => window.confirm('最初の案内をもう一度表示しますか？\n選び直すと、今の予定・持ち物・ルールは置きかわります。') && onRestartOnboarding()}
        >
          最初の設定をやり直す
        </SubButton>
        <br />
        <SubButton
          onClick={() => window.confirm('すべてのデータを消して、最初の状態に戻しますか？') && onReset()}
          className="text-rose-500 border-rose-400"
        >
          最初の状態に戻す
        </SubButton>
      </Card>
    </div>
  );
};
