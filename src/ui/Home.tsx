import React from 'react';
import { computeAlerts, confirmKey, actualTypeOn, baseTypeOn, reasonText, type Alert } from '../core/engine';
import { itemNames } from '../core/schedule';
import { addDays, formatJa, parseDate, weekDates, WEEKDAY_NAMES, weekdayOf } from '../core/dates';
import type { AppState, DateStr } from '../core/types';
import { Icon } from './icons';

interface Props {
  state: AppState;
  today: DateStr;
  onOpenChange: (date?: DateStr) => void;
  onConfirm: (alerts: Alert[], done: boolean) => void;
}

/** 今日見るべきお知らせを「当日分」「明日の準備」に分ける */
const groupByTiming = (alerts: Alert[]) =>
  (['sameDay', 'dayBefore'] as const)
    .map((timing) => alerts.filter((a) => a.timing === timing))
    .filter((g) => g.length > 0);

const typeName = (state: AppState, id: string) => state.types.find((t) => t.id === id)?.name ?? '？';

const Heading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-sm font-semibold text-ink-2 mt-7 mb-2 px-1">{children}</h2>
);

/** スマホへのお知らせがいつ来るか（もう過ぎたか）を書いておく */
const NotifyTimeNote: React.FC<{ state: AppState; sameDay: boolean }> = ({ state, sameDay }) => {
  if (!state.settings.notificationsEnabled) return null;
  const time = sameDay ? state.settings.sameDayTime : state.settings.dayBeforeTime;
  const now = new Date();
  const passed = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` >= time;
  return (
    <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-2">
      <Icon name="bell" className="w-4 h-4 shrink-0" />
      {passed ? `お知らせ時刻（${time}）は過ぎました` : `${time} にスマホへお知らせします`}
    </p>
  );
};

const AlertCard: React.FC<{ state: AppState; alerts: Alert[]; onConfirm: Props['onConfirm'] }> = ({
  state,
  alerts,
  onConfirm,
}) => {
  const sameDay = alerts[0].timing === 'sameDay';
  const items = [...new Set(alerts.flatMap((a) => itemNames(state, a.itemIds)))];
  const reasons = [...new Set(alerts.map((a) => a.reason))];
  const done = alerts.every((a) => state.confirmed[confirmKey(a)]);

  return (
    <section
      className={`rounded-3xl border p-5 ${done ? 'bg-ok-soft border-transparent' : 'bg-alert-soft border-alert-line'}`}
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <span
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${done ? 'bg-ok text-surface' : 'bg-alert-strong text-white'}`}
        >
          <Icon name={done ? 'check' : 'alert'} className="w-6 h-6" />
        </span>
        <p className={`text-xl font-bold ${done ? 'text-ok' : 'text-alert'}`}>
          {done ? '準備できました' : sameDay ? '今日はいつもと違います' : '明日はいつもと違います'}
        </p>
      </div>

      {reasons.map((r) => (
        <p key={r} className="mt-3 text-[15px] leading-relaxed">
          {r}
        </p>
      ))}

      <p className="mt-4 text-sm font-semibold text-ink-2">{sameDay ? '今日' : '明日'}の持ち物・行動</p>
      <ul className="mt-2 space-y-2">
        {items.map((name) => (
          <li key={name} className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3">
            <span
              className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 ${done ? 'bg-ok border-ok text-surface' : 'border-ink-2'}`}
            >
              {done && <Icon name="check" className="w-4 h-4" />}
            </span>
            <span className="text-lg font-semibold">{name}</span>
          </li>
        ))}
      </ul>

      {done ? (
        <button onClick={() => onConfirm(alerts, false)} className="mt-4 w-full rounded-full py-3 font-semibold text-ink-2">
          準備したを取り消す
        </button>
      ) : (
        <>
          <button
            onClick={() => onConfirm(alerts, true)}
            className="mt-4 w-full rounded-full bg-primary text-on-primary py-4 text-lg font-bold shadow-sm active:opacity-90"
          >
            準備した
          </button>
          <NotifyTimeNote state={state} sameDay={sameDay} />
        </>
      )}
    </section>
  );
};

const QuietCard: React.FC<{ state: AppState; today: DateStr }> = ({ state, today }) => (
  <section className="rounded-3xl bg-surface border border-line p-5">
    <div className="flex items-center gap-3">
      <span className="w-10 h-10 rounded-full bg-surface-2 text-ink-2 flex items-center justify-center shrink-0">
        <Icon name="sun" className="w-6 h-6" />
      </span>
      <div>
        <p className="text-xl font-bold">今日はいつもどおりです</p>
        <p className="text-sm text-ink-2">予定：{typeName(state, actualTypeOn(state, today))}</p>
      </div>
    </div>
    <p className="mt-3 text-sm text-ink-2 leading-relaxed">いつもと違う準備が必要な日だけ、ここに表示してお知らせします。</p>
  </section>
);

export const Home: React.FC<Props> = ({ state, today, onOpenChange, onConfirm }) => {
  const todayAlerts = computeAlerts(state, today, today);
  const upcoming = computeAlerts(state, addDays(today, 1), addDays(today, 30));
  const week = weekDates(today, state.settings.weekStartsOn);
  const d = parseDate(today);

  return (
    <div className="px-4 pt-2 pb-8">
      <p className="px-1 text-ink-2 text-sm">今日</p>
      <p className="px-1 text-2xl font-bold mb-4">
        {d.getMonth() + 1}月{d.getDate()}日（{WEEKDAY_NAMES[d.getDay()]}）
      </p>

      {todayAlerts.length > 0 ? (
        <div className="space-y-3">
          {groupByTiming(todayAlerts).map((g) => (
            <AlertCard key={g[0].timing} state={state} alerts={g} onConfirm={onConfirm} />
          ))}
        </div>
      ) : (
        <QuietCard state={state} today={today} />
      )}

      <Heading>今週の予定</Heading>
      <div className="grid grid-cols-7 gap-1 rounded-3xl bg-surface border border-line p-2 text-center">
        {week.map((day) => {
          const changed = actualTypeOn(state, day) !== baseTypeOn(state.pattern, day);
          const weekday = weekdayOf(day);
          const isToday = day === today;
          return (
            <button
              key={day}
              onClick={() => onOpenChange(day)}
              className={`rounded-2xl py-2 ${isToday ? 'bg-primary-soft' : 'active:bg-surface-2'}`}
              aria-label={`${formatJa(day)} ${typeName(state, actualTypeOn(state, day))}${changed ? '（変更あり）' : ''}`}
            >
              <div className={`text-xs ${weekday === 0 ? 'text-rose-500' : weekday === 6 ? 'text-sky-500' : 'text-ink-2'}`}>
                {WEEKDAY_NAMES[weekday]}
              </div>
              <div className={`text-base font-bold ${isToday ? 'text-primary' : ''}`}>{Number(day.slice(8))}</div>
              <div className={`text-[11px] leading-4 ${changed ? 'font-bold text-alert' : 'text-ink-2'}`}>
                {typeName(state, actualTypeOn(state, day))}
              </div>
              <div className="h-2 flex justify-center items-center">
                {changed && <span className="w-1.5 h-1.5 rounded-full bg-alert-strong" />}
              </div>
            </button>
          );
        })}
      </div>

      <Heading>これからの「いつもと違う日」</Heading>
      {upcoming.length === 0 ? (
        <p className="rounded-3xl bg-surface border border-line p-5 text-ink-2">30日先まで、ありません。</p>
      ) : (
        <ul className="rounded-3xl bg-surface border border-line divide-y divide-line overflow-hidden">
          {upcoming.map((a) => {
            const t = parseDate(a.notifyDate);
            return (
              <li key={`${a.ruleId}|${a.targetDate}`} className="flex gap-4 p-4">
                <div className="w-12 shrink-0 text-center">
                  <div className="text-xs text-ink-2">{t.getMonth() + 1}月</div>
                  <div className="text-2xl font-bold leading-7">{t.getDate()}</div>
                  <div className="text-xs text-ink-2">{WEEKDAY_NAMES[t.getDay()]}</div>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold">{itemNames(state, a.itemIds).join('・')}</p>
                  <p className="text-sm text-ink-2 mt-0.5">{reasonText(a.cause, formatJa(a.targetDate), a.conditionLabel)}</p>
                  <p className="text-xs text-ink-2 mt-1 flex items-center gap-1">
                    <Icon name="bell" className="w-3.5 h-3.5" />
                    {a.timing === 'sameDay' ? `当日 ${state.settings.sameDayTime}` : `前日 ${state.settings.dayBeforeTime}`}
                    {state.confirmed[confirmKey(a)] && <span className="ml-2 font-bold text-ok">準備済み</span>}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
