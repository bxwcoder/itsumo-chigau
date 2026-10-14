import React from 'react';
import { computeAlerts, confirmKey, actualTypeOn, baseTypeOn, reasonText, type Alert } from '../core/engine';
import { itemNames } from '../core/schedule';
import { addDays, formatJa, weekDates, WEEKDAY_NAMES, weekdayOf } from '../core/dates';
import type { AppState, DateStr } from '../core/types';
import { Card, PrimaryButton, SectionTitle, SubButton, TypeBadge } from './common';

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
    <Card className={done ? 'border-teal-300 bg-teal-50' : 'border-amber-300 bg-amber-50'}>
      <p className="text-lg font-bold">{sameDay ? '今日はいつもと違います' : '明日はいつもと違います'}</p>
      {reasons.map((r) => (
        <p key={r} className="mt-1 text-stone-700">
          {r}
        </p>
      ))}
      <p className="mt-3 font-bold">{sameDay ? '今日' : '明日'}の持ち物・行動：</p>
      <ul className="mt-1 space-y-1">
        {items.map((name) => (
          <li key={name} className="text-lg">
            {done ? '☑' : '□'} {name}
          </li>
        ))}
      </ul>
      {done ? (
        <div className="mt-4 flex items-center justify-between">
          <span className="font-bold text-teal-800">✓ 準備しました</span>
          <SubButton onClick={() => onConfirm(alerts, false)}>取り消す</SubButton>
        </div>
      ) : (
        <PrimaryButton className="mt-4 w-full text-lg" onClick={() => onConfirm(alerts, true)}>
          準備した
        </PrimaryButton>
      )}
    </Card>
  );
};

export const Home: React.FC<Props> = ({ state, today, onOpenChange, onConfirm }) => {
  const todayAlerts = computeAlerts(state, today, today);
  const upcoming = computeAlerts(state, addDays(today, 1), addDays(today, 30));
  const week = weekDates(today, state.settings.weekStartsOn);

  return (
    <div className="p-4">
      <PrimaryButton className="w-full text-xl py-4 shadow" onClick={() => onOpenChange()}>
        ＋ 予定変更
      </PrimaryButton>

      <SectionTitle>今日 {formatJa(today)}</SectionTitle>
      {todayAlerts.length > 0 ? (
        <div className="space-y-3">
          {groupByTiming(todayAlerts).map((g) => (
            <AlertCard key={g[0].timing} state={state} alerts={g} onConfirm={onConfirm} />
          ))}
        </div>
      ) : (
        <Card>
          <p className="text-lg font-bold text-stone-700">今日はいつもどおりです</p>
          <p className="mt-1 text-stone-500 flex items-center gap-2">
            今日の予定： <TypeBadge state={state} typeId={actualTypeOn(state, today)} />
          </p>
          <p className="mt-1 text-sm text-stone-500">いつもと違う準備が必要な日だけ、ここに表示してお知らせします。</p>
        </Card>
      )}

      <SectionTitle>今週の予定</SectionTitle>
      <Card className="p-2">
        <div className="grid grid-cols-7 gap-1 text-center">
          {week.map((d) => {
            const changed = actualTypeOn(state, d) !== baseTypeOn(state.pattern, d);
            const weekday = weekdayOf(d);
            return (
              <button
                key={d}
                onClick={() => onOpenChange(d)}
                className={`rounded-lg py-1 ${d === today ? 'bg-stone-100 ring-2 ring-teal-600' : ''}`}
              >
                <div className={`text-xs ${weekday === 0 ? 'text-rose-600' : weekday === 6 ? 'text-sky-700' : 'text-stone-500'}`}>
                  {WEEKDAY_NAMES[weekday]}
                </div>
                <div className="text-sm font-semibold">{Number(d.slice(8))}</div>
                <TypeBadge state={state} typeId={actualTypeOn(state, d)} small />
                <div className="h-4 text-[10px] font-bold text-amber-700">{changed ? '変更' : ''}</div>
              </button>
            );
          })}
        </div>
      </Card>

      <SectionTitle>これからの「いつもと違う日」（30日先まで）</SectionTitle>
      {upcoming.length === 0 ? (
        <Card>
          <p className="text-stone-500">今のところありません。</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {upcoming.map((a) => (
            <Card key={`${a.ruleId}|${a.targetDate}`} className="py-3">
              <p className="font-bold">
                {formatJa(a.notifyDate)}
                <span className="ml-2 text-sm font-normal text-stone-500">
                  {a.timing === 'sameDay' ? `朝 ${state.settings.sameDayTime}` : `夜 ${state.settings.dayBeforeTime}（前日）`}
                </span>
              </p>
              <p className="text-sm text-stone-600 mt-1">{reasonText(a.cause, formatJa(a.targetDate), a.conditionLabel)}</p>
              <p className="text-sm mt-1">持ち物・行動：{itemNames(state, a.itemIds).join('、')}</p>
              {state.confirmed[confirmKey(a)] && <p className="text-sm font-bold text-teal-800 mt-1">✓ 準備済み</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
