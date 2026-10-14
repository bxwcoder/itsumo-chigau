import React, { useEffect, useState } from 'react';
import type { AppState, Settings as SettingsT } from '../core/types';
import {
  getExactAlarm,
  getPermission,
  isNativeApp,
  listPending,
  openExactAlarmSetting,
  requestPermission,
  sendTestNotification,
  type PendingInfo,
  type PermissionState,
  type SyncResult,
} from '../lib/notify';
import { Card, SectionTitle, SubButton } from './common';

interface Props {
  state: AppState;
  syncResult: SyncResult;
  update: (fn: (s: AppState) => AppState) => void;
  onReset: () => void;
}

const PERMISSION_LABEL: Record<PermissionState, string> = {
  granted: '許可されています',
  denied: '許可されていません（スマホの設定アプリから許可してください）',
  prompt: 'まだ確認していません',
  unsupported: 'ブラウザ版のため通知は届きません',
};

export const Settings: React.FC<Props> = ({ state, syncResult, update, onReset }) => {
  const [permission, setPermission] = useState<PermissionState>('unsupported');
  const [exact, setExact] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<PendingInfo[]>([]);

  const refresh = async () => {
    setPermission(await getPermission());
    setExact(await getExactAlarm());
    setPending(await listPending());
  };

  // 予約し直したら一覧も読み直す
  useEffect(() => {
    listPending().then(setPending);
  }, [syncResult]);

  useEffect(() => {
    refresh();
    // 設定アプリから戻ってきたら状態を読み直す
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const set = (patch: Partial<SettingsT>) => update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  const s = state.settings;

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

      {isNativeApp() && (
        <>
          <SectionTitle>予約中のお知らせ（60日先まで）</SectionTitle>
          <Card className="space-y-2">
            {syncResult.error && <p className="text-sm font-bold text-rose-700">予約に失敗しました：{syncResult.error}</p>}
            {syncResult.skipped && <p className="text-sm font-bold text-amber-700">予約していません：{syncResult.skipped}</p>}
            {syncResult.inexact && syncResult.count > 0 && (
              <p className="text-sm text-amber-700">「時間ぴったりの通知」がオフのため、数分おくれることがあります。</p>
            )}
            {pending.length === 0 ? (
              <p className="text-stone-500">ありません。</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {pending.map((p) => (
                  <li key={p.id} className="py-2 flex justify-between gap-2">
                    <span className="font-semibold">
                      {p.at ? p.at.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '日時不明'}
                    </span>
                    <span className="text-stone-600 text-sm">{p.title}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-stone-500">
              お知らせ時刻をすでに過ぎた分は予約しません。今日のお知らせを試すときは、時刻を先に数分後にしてから予定を変更してください。
            </p>
          </Card>
        </>
      )}

      <SectionTitle>スマホの通知の許可</SectionTitle>
      <Card className="space-y-3">
        <p>
          通知：<span className="font-semibold">{PERMISSION_LABEL[permission]}</span>
        </p>
        {permission === 'prompt' && (
          <SubButton
            onClick={async () => {
              setPermission(await requestPermission());
              update((st) => ({ ...st })); // 許可されたら予約し直す
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
                setMessage('2分後にテスト通知が届きます。アプリを閉じて（ホームボタンで戻って）、画面を消して待ってください。');
              }}
            >
              テスト通知（2分後）
            </SubButton>
          </div>
        )}
        {message && <p className="text-sm text-teal-800">{message}</p>}
      </Card>

      <SectionTitle>カレンダー</SectionTitle>
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
