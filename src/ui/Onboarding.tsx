import React, { useMemo, useState } from 'react';
import { applyTemplate, buildDemo, TEMPLATES, templateItems, type TemplateId } from '../core/templates';
import type { AppState, DateStr } from '../core/types';
import {
  isNativeApp,
  requestCalendarPermission,
  requestPermission,
  sendCalendarTest,
  sendTestNotification,
  type PermissionState,
} from '../lib/notify';
import { Icon } from './icons';

interface Props {
  state: AppState;
  today: DateStr;
  onFinish: (next: AppState) => void;
}

type Step = 'welcome' | 'template' | 'items' | 'demo' | 'notify' | 'done';
const STEPS: Step[] = ['welcome', 'template', 'items', 'demo', 'notify', 'done'];

const Choice: React.FC<{ active: boolean; onClick: () => void; title: string; note?: string }> = ({ active, onClick, title, note }) => (
  <button
    onClick={onClick}
    className={`w-full text-left rounded-2xl border-2 px-4 py-3 ${active ? 'border-primary bg-primary-soft' : 'border-line bg-surface'}`}
    aria-pressed={active}
  >
    <span className="flex items-center gap-3">
      <span
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${active ? 'border-primary bg-primary text-on-primary' : 'border-ink-2'}`}
      >
        {active && <Icon name="check" className="w-4 h-4" />}
      </span>
      <span>
        <span className="block text-lg font-bold">{title}</span>
        {note && <span className="block text-sm text-ink-2">{note}</span>}
      </span>
    </span>
  </button>
);

const PERMISSION_RESULT: Record<PermissionState, string> = {
  granted: '許可されました',
  denied: '許可されませんでした。あとで「設定」から許可できます',
  prompt: 'まだ許可されていません。あとで「設定」から許可できます',
  unsupported: 'この画面（ブラウザ）では通知は届きません。Android アプリで使ってください',
};

export const Onboarding: React.FC<Props> = ({ state, today, onFinish }) => {
  const [step, setStep] = useState<Step>('welcome');
  const [templateId, setTemplateId] = useState<TemplateId>('office');
  const [hospital, setHospital] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [calendarResult, setCalendarResult] = useState<PermissionState | null>(null);
  const [appResult, setAppResult] = useState<PermissionState | null>(null);
  const [testSent, setTestSent] = useState(false);

  const items = templateItems(templateId, hospital);
  const draft = useMemo(
    () => ({ ...applyTemplate(state, templateId, [...selected], hospital, today), onboarded: true }),
    [state, templateId, selected, hospital, today],
  );
  const demo = useMemo(() => buildDemo(draft, today), [draft, today]);

  const chooseTemplate = (id: TemplateId) => {
    setTemplateId(id);
    setSelected(new Set(templateItems(id, hospital).filter((i) => i.preset).map((i) => i.id)));
  };
  const toggleHospital = () => {
    const next = !hospital;
    setHospital(next);
    setSelected((cur) => {
      const s = new Set(cur);
      for (const i of templateItems(templateId, true)) {
        if (!templateItems(templateId, false).some((x) => x.id === i.id)) {
          if (next && i.preset) s.add(i.id);
          if (!next) s.delete(i.id);
        }
      }
      return s;
    });
  };
  const toggleItem = (id: string) =>
    setSelected((cur) => {
      const s = new Set(cur);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  const go = (s: Step) => setStep(s);
  const index = STEPS.indexOf(step);

  const askCalendar = async () => {
    const result = await requestCalendarPermission();
    setCalendarResult(result);
    // カレンダーがだめなら、アプリの通知で代わりに知らせる
    if (result !== 'granted') setAppResult(await requestPermission());
  };

  const sendTest = async () => {
    if (calendarResult === 'granted') await sendCalendarTest(draft);
    else await sendTestNotification(120);
    setTestSent(true);
  };

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col pt-safe pb-safe">
      <div className="max-w-md w-full mx-auto flex-1 flex flex-col px-5 pt-6 pb-6">
        {step !== 'welcome' && (
          <div className="flex gap-1.5 mb-6" aria-label={`${index} / ${STEPS.length - 1}`}>
            {STEPS.slice(1).map((s, i) => (
              <span key={s} className={`h-1.5 flex-1 rounded-full ${i < index ? 'bg-primary' : 'bg-line'}`} />
            ))}
          </div>
        )}

        {step === 'welcome' && (
          <div className="flex-1 flex flex-col justify-center">
            <span className="w-16 h-16 rounded-3xl bg-alert-strong text-white flex items-center justify-center mb-6">
              <Icon name="bell" className="w-9 h-9" />
            </span>
            <h1 className="text-3xl font-bold leading-tight">いつもと違う日だけ、教えます。</h1>
            <p className="mt-4 text-lg leading-relaxed text-ink-2">
              休みや予定が変わると、持ち物が必要な日もずれます。
              <br />
              このアプリが自動で計算して、<span className="font-bold text-ink">その日だけ</span>お知らせします。
            </p>
            <p className="mt-3 text-ink-2">ふだんどおりの日は、何も知らせません。</p>
          </div>
        )}

        {step === 'template' && (
          <div className="flex-1">
            <h1 className="text-2xl font-bold">いつもの予定は、どれに近いですか？</h1>
            <p className="mt-2 text-ink-2">あとから自由に変えられます。</p>
            <div className="mt-5 space-y-3">
              {TEMPLATES.map((t) => (
                <Choice key={t.id} active={templateId === t.id} onClick={() => chooseTemplate(t.id)} title={t.label} note={t.description} />
              ))}
            </div>
          </div>
        )}

        {step === 'items' && (
          <div className="flex-1">
            <h1 className="text-2xl font-bold">忘れたくない持ち物は？</h1>
            <p className="mt-2 text-ink-2">選んだものを、必要な日にお知らせします。あとで追加もできます。</p>
            <div className="mt-5 space-y-3">
              {items.map((i) => (
                <Choice key={i.id} active={selected.has(i.id)} onClick={() => toggleItem(i.id)} title={i.name} />
              ))}
            </div>
            <div className="mt-6">
              <Choice active={hospital} onClick={toggleHospital} title="病院に行くことがある" note="病院の日の前日に、診察券・保険証をお知らせ" />
            </div>
          </div>
        )}

        {step === 'demo' && (
          <div className="flex-1">
            <h1 className="text-2xl font-bold">試しに、予定を変えてみます</h1>
            {demo ? (
              <>
                <p className="mt-3 text-lg">{demo.change}</p>
                <div className="mt-4 rounded-3xl border border-alert-line bg-alert-soft p-5">
                  <p className="text-sm text-ink-2">{demo.resultDate}に、こうお知らせします</p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="w-9 h-9 rounded-full bg-alert-strong text-white flex items-center justify-center shrink-0">
                      <Icon name="alert" className="w-5 h-5" />
                    </span>
                    <p className="text-lg font-bold text-alert">いつもと違います</p>
                  </div>
                  <p className="mt-3 leading-relaxed">{demo.reason}</p>
                  <ul className="mt-3 space-y-2">
                    {demo.items.map((name) => (
                      <li key={name} className="rounded-2xl bg-surface px-4 py-3 text-lg font-semibold">
                        □ {name}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="mt-4 text-ink-2">曜日を決めて登録しなくても、予定の変更から自動で計算します。</p>
              </>
            ) : (
              <p className="mt-4 text-lg leading-relaxed text-ink-2">
                病院などの予定ができたら、ホームの「＋予定変更」から登録してください。必要な持ち物を前日にお知らせします。
              </p>
            )}
          </div>
        )}

        {step === 'notify' && (
          <div className="flex-1">
            <h1 className="text-2xl font-bold">お知らせの準備</h1>
            <div className="mt-4 rounded-3xl bg-surface border border-line p-5 space-y-3 leading-relaxed">
              <p>
                確実にお知らせを届けるため、<span className="font-bold">このアプリ専用のカレンダー</span>を作り、いつもと違う日だけ予定を書き込みます。
              </p>
              <p>予定の時刻になると、お使いのカレンダーアプリ（Google カレンダーなど）から通知が届きます。アプリを閉じていても届きます。</p>
              <p className="text-sm text-ink-2">あなたの予定を外部に送ることはありません。データはこのスマホの中だけに保存します。</p>
            </div>

            {calendarResult === null ? (
              <button onClick={askCalendar} className="mt-5 w-full rounded-full bg-primary text-on-primary py-4 text-lg font-bold">
                カレンダーを使って知らせる
              </button>
            ) : (
              <div className="mt-5 space-y-2">
                <p className={`font-semibold ${calendarResult === 'granted' ? 'text-ok' : 'text-ink-2'}`}>カレンダー：{PERMISSION_RESULT[calendarResult]}</p>
                {appResult && calendarResult !== 'granted' && (
                  <p className={`font-semibold ${appResult === 'granted' ? 'text-ok' : 'text-ink-2'}`}>
                    代わりにアプリの通知で知らせます：{PERMISSION_RESULT[appResult]}
                  </p>
                )}
                {isNativeApp() && (calendarResult === 'granted' || appResult === 'granted') && (
                  <button
                    onClick={sendTest}
                    disabled={testSent}
                    className="w-full rounded-full border border-line bg-surface text-primary py-3 font-semibold disabled:text-ink-2"
                  >
                    {testSent ? '2分後にテストのお知らせが届きます' : '試しに2分後にお知らせする'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {step === 'done' && (
          <div className="flex-1 flex flex-col justify-center">
            <span className="w-16 h-16 rounded-full bg-ok text-surface flex items-center justify-center mb-6">
              <Icon name="check" className="w-10 h-10" />
            </span>
            <h1 className="text-3xl font-bold">準備ができました</h1>
            <p className="mt-4 text-lg leading-relaxed text-ink-2">
              予定が変わったら、ホームの<span className="font-bold text-ink">「＋予定変更」</span>から登録してください。
            </p>
            <p className="mt-3 text-ink-2">入力を忘れないよう、「設定」で「予定の変更はありませんか？」と聞くお知らせも出せます。</p>
          </div>
        )}

        <div className="mt-8 flex gap-3">
          {index > 0 && step !== 'done' && (
            <button onClick={() => go(STEPS[index - 1])} className="rounded-full border border-line bg-surface px-6 py-4 font-semibold">
              戻る
            </button>
          )}
          {step === 'done' ? (
            <button onClick={() => onFinish(draft)} className="flex-1 rounded-full bg-primary text-on-primary py-4 text-lg font-bold">
              はじめる
            </button>
          ) : (
            <button
              onClick={() => {
                if (step === 'welcome' && selected.size === 0) chooseTemplate(templateId);
                go(STEPS[index + 1]);
              }}
              className="flex-1 rounded-full bg-primary text-on-primary py-4 text-lg font-bold"
            >
              {step === 'welcome' ? 'はじめる' : step === 'notify' && calendarResult === null ? 'あとで設定する' : '次へ'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
