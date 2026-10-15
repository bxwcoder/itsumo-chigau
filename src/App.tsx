import React, { useCallback, useEffect, useState } from 'react';
import { baseTypeOn, confirmKey, type Alert } from './core/engine';
import { createDefaultState } from './core/defaults';
import { addDays, toDateStr } from './core/dates';
import type { AppState, DateStr } from './core/types';
import { clearState, loadState, saveState } from './lib/storage';
import { EMPTY_SYNC, needsSetup, onNotificationTapped, syncNotifications, type SyncResult } from './lib/notify';
import { Home } from './ui/Home';
import { Schedule } from './ui/Schedule';
import { Items } from './ui/Items';
import { Rules } from './ui/Rules';
import { Settings } from './ui/Settings';
import { ChangeSheet } from './ui/ChangeSheet';
import { Icon, type IconName } from './ui/icons';

type Tab = 'home' | 'schedule' | 'items' | 'rules' | 'settings';

const TABS: [Tab, string, IconName][] = [
  ['home', 'ホーム', 'home'],
  ['schedule', '予定', 'calendar'],
  ['items', '持ち物', 'list'],
  ['rules', 'ルール', 'rule'],
  ['settings', '設定', 'tune'],
];

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(loadState);
  const [tab, setTab] = useState<Tab>('home');
  const [today, setToday] = useState<DateStr>(() => toDateStr(new Date()));
  const [changeDate, setChangeDate] = useState<DateStr | undefined | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult>(EMPTY_SYNC);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [toast, setToast] = useState('');

  const update = useCallback((fn: (s: AppState) => AppState) => setState(fn), []);

  // データが変わったら保存して、お知らせを予約し直す
  useEffect(() => {
    saveState(state);
    const timer = setTimeout(() => {
      syncNotifications(state).then(setSyncResult);
      needsSetup(state).then(setSetupNeeded);
    }, 400);
    return () => clearTimeout(timer);
  }, [state]);

  // アプリに戻ってきたら「今日」を更新し、60日先までの予約を延ばす
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      setToday(toDateStr(new Date()));
      setState((s) => ({ ...s }));
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // 「予定の変更はありませんか？」の通知を押したら、すぐ予定変更を開く
  useEffect(
    () =>
      onNotificationTapped((kind) => {
        setTab('home');
        if (kind === 'check') setChangeDate(addDays(toDateStr(new Date()), 1));
      }),
    [],
  );

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const saveChange = (date: DateStr, typeId: string) => {
    setState((s) => {
      const overrides = { ...s.overrides };
      if (typeId === baseTypeOn(s.pattern, date)) delete overrides[date];
      else overrides[date] = { typeId };
      return { ...s, overrides };
    });
    setChangeDate(null);
    setToast('予定変更を登録しました');
  };

  const confirm = (alerts: Alert[], done: boolean) =>
    setState((s) => {
      const confirmed = { ...s.confirmed };
      for (const a of alerts) {
        if (done) confirmed[confirmKey(a)] = true;
        else delete confirmed[confirmKey(a)];
      }
      return { ...s, confirmed };
    });

  return (
    <div className="min-h-screen flex flex-col bg-bg text-ink">
      <header className="bg-bg pt-safe sticky top-0 z-20">
        <h1 className="max-w-md mx-auto h-14 px-5 flex items-center text-lg font-bold">
          {tab === 'home' ? 'いつもと違う日' : TABS.find((t) => t[0] === tab)![1]}
        </h1>
      </header>

      <main className="flex-1 w-full max-w-md mx-auto pb-40">
        {tab === 'home' && setupNeeded && (
          <div className="mx-4 mb-2 rounded-3xl border border-alert-line bg-alert-soft p-4">
            <p className="font-bold">お知らせを届けるには、許可が必要です</p>
            <p className="text-sm text-ink-2 mt-1">「設定」で、カレンダー（または通知）へのアクセスを許可してください。</p>
            <button onClick={() => setTab('settings')} className="mt-3 bg-primary text-on-primary font-bold rounded-full px-5 py-2">
              設定をひらく
            </button>
          </div>
        )}
        {tab === 'home' && <Home state={state} today={today} onOpenChange={(d) => setChangeDate(d)} onConfirm={confirm} />}
        {tab === 'schedule' && <Schedule state={state} today={today} onOpenChange={(d) => setChangeDate(d)} update={update} />}
        {tab === 'items' && <Items state={state} update={update} />}
        {tab === 'rules' && <Rules state={state} update={update} />}
        {tab === 'settings' && (
          <Settings
            state={state}
            syncResult={syncResult}
            onSyncResult={setSyncResult}
            update={update}
            onReset={() => {
              clearState();
              setState(createDefaultState());
              setToast('最初の状態に戻しました');
            }}
          />
        )}
      </main>

      {tab === 'home' && (
        <button
          onClick={() => setChangeDate(undefined)}
          className="fixed z-20 right-4 bottom-24 flex items-center gap-2 rounded-2xl bg-primary text-on-primary pl-4 pr-5 h-14 text-base font-bold shadow-lg active:opacity-90"
        >
          <Icon name="add" className="w-6 h-6" />
          予定変更
        </button>
      )}

      <nav className="fixed bottom-0 inset-x-0 z-20 bg-surface-2 pb-safe">
        <div className="max-w-md mx-auto grid grid-cols-5 pt-3 pb-4">
          {TABS.map(([id, label, icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex flex-col items-center gap-1 text-xs font-semibold ${tab === id ? 'text-ink' : 'text-ink-2'}`}
              aria-current={tab === id ? 'page' : undefined}
            >
              <span className={`w-16 h-8 rounded-full flex items-center justify-center ${tab === id ? 'bg-primary-soft text-primary' : ''}`}>
                <Icon name={icon} />
              </span>
              {label}
            </button>
          ))}
        </div>
      </nav>

      {changeDate !== null && (
        <ChangeSheet state={state} today={today} initialDate={changeDate} onSave={saveChange} onClose={() => setChangeDate(null)} />
      )}

      {toast && (
        <div className="fixed bottom-40 inset-x-0 z-40 flex justify-center pointer-events-none">
          <div className="bg-ink text-bg rounded-full px-4 py-2 shadow-lg">{toast}</div>
        </div>
      )}
    </div>
  );
};

export default App;
