import React, { useCallback, useEffect, useState } from 'react';
import { baseTypeOn, confirmKey, type Alert } from './core/engine';
import { createDefaultState } from './core/defaults';
import { toDateStr } from './core/dates';
import type { AppState, DateStr } from './core/types';
import { clearState, loadState, saveState } from './lib/storage';
import { syncNotifications } from './lib/notify';
import { Home } from './ui/Home';
import { Schedule } from './ui/Schedule';
import { Items } from './ui/Items';
import { Rules } from './ui/Rules';
import { Settings } from './ui/Settings';
import { ChangeSheet } from './ui/ChangeSheet';

type Tab = 'home' | 'schedule' | 'items' | 'rules' | 'settings';

const TABS: [Tab, string, string][] = [
  ['home', 'ホーム', '🏠'],
  ['schedule', '予定', '📅'],
  ['items', '持ち物', '🎒'],
  ['rules', 'ルール', '🔁'],
  ['settings', '設定', '⚙️'],
];

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(loadState);
  const [tab, setTab] = useState<Tab>('home');
  const [today, setToday] = useState<DateStr>(() => toDateStr(new Date()));
  const [changeDate, setChangeDate] = useState<DateStr | undefined | null>(null);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [toast, setToast] = useState('');

  const update = useCallback((fn: (s: AppState) => AppState) => setState(fn), []);

  // データが変わったら保存して、お知らせを予約し直す
  useEffect(() => {
    saveState(state);
    const timer = setTimeout(() => {
      syncNotifications(state)
        .then(setScheduledCount)
        .catch((e) => console.error('通知の予約に失敗しました', e));
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
    <div className="min-h-screen flex flex-col">
      <header className="bg-teal-700 text-white pt-safe sticky top-0 z-20 shadow">
        <h1 className="max-w-md mx-auto h-12 flex items-center justify-center font-bold">
          {tab === 'home' ? 'いつもと違う日' : TABS.find((t) => t[0] === tab)![1]}
        </h1>
      </header>

      <main className="flex-1 w-full max-w-md mx-auto pb-24">
        {tab === 'home' && <Home state={state} today={today} onOpenChange={(d) => setChangeDate(d)} onConfirm={confirm} />}
        {tab === 'schedule' && <Schedule state={state} today={today} onOpenChange={(d) => setChangeDate(d)} update={update} />}
        {tab === 'items' && <Items state={state} update={update} />}
        {tab === 'rules' && <Rules state={state} update={update} />}
        {tab === 'settings' && (
          <Settings
            state={state}
            scheduledCount={scheduledCount}
            update={update}
            onReset={() => {
              clearState();
              setState(createDefaultState());
              setToast('最初の状態に戻しました');
            }}
          />
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-stone-200 pb-safe">
        <div className="max-w-md mx-auto grid grid-cols-5">
          {TABS.map(([id, label, icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`py-2 flex flex-col items-center text-xs font-semibold ${tab === id ? 'text-teal-700' : 'text-stone-500'}`}
              aria-current={tab === id ? 'page' : undefined}
            >
              <span className="text-xl leading-6" aria-hidden>
                {icon}
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
        <div className="fixed bottom-24 inset-x-0 z-40 flex justify-center pointer-events-none">
          <div className="bg-stone-800 text-white rounded-full px-4 py-2 shadow-lg">{toast}</div>
        </div>
      )}
    </div>
  );
};

export default App;
