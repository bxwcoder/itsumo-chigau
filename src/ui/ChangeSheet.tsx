import React, { useState } from 'react';
import { baseTypeOn, actualTypeOn, computeAlerts } from '../core/engine';
import { itemNames } from '../core/schedule';
import { addDays, formatJa } from '../core/dates';
import type { AppState, DateStr } from '../core/types';
import { PrimaryButton, Sheet, chipClass, colorClass, fieldClass } from './common';

interface Props {
  state: AppState;
  today: DateStr;
  initialDate?: DateStr;
  onSave: (date: DateStr, typeId: string) => void;
  onClose: () => void;
}

/** 予定を変えたら、お知らせがどう変わるかを先に見せる */
const previewChanges = (state: AppState, date: DateStr, typeId: string, today: DateStr) => {
  const overrides = { ...state.overrides };
  if (typeId === baseTypeOn(state.pattern, date)) delete overrides[date];
  else overrides[date] = { typeId };
  const next = { ...state, overrides };
  const from = addDays(date, -7) < today ? today : addDays(date, -7);
  const to = addDays(date, 14);
  const key = (a: { ruleId: string; targetDate: string }) => `${a.ruleId}|${a.targetDate}`;
  const before = new Set(computeAlerts(state, from, to).map(key));
  const after = computeAlerts(next, from, to);
  const afterKeys = new Set(after.map(key));
  return {
    added: after.filter((a) => !before.has(key(a))),
    removedCount: [...before].filter((k) => !afterKeys.has(k)).length,
  };
};

export const ChangeSheet: React.FC<Props> = ({ state, today, initialDate, onSave, onClose }) => {
  const [date, setDate] = useState<DateStr>(initialDate ?? addDays(today, 1));
  const current = actualTypeOn(state, date);
  const usual = baseTypeOn(state.pattern, date);
  const [typeId, setTypeId] = useState<string>(current);

  const changeDate = (d: DateStr) => {
    setDate(d);
    setTypeId(actualTypeOn(state, d));
  };

  const preview = typeId !== current ? previewChanges(state, date, typeId, today) : null;
  const quickDates: [string, DateStr][] = [
    ['今日', today],
    ['明日', addDays(today, 1)],
    ['あさって', addDays(today, 2)],
  ];

  return (
    <Sheet title="予定変更" onClose={onClose}>
      <p className="font-bold mb-2">① どの日？</p>
      <div className="flex gap-2 flex-wrap">
        {quickDates.map(([label, d]) => (
          <button
            key={label}
            onClick={() => changeDate(d)}
            className={chipClass(date === d)}
          >
            {label}
          </button>
        ))}
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && changeDate(e.target.value)}
          className={`${fieldClass}`}
          aria-label="日付を選ぶ"
        />
      </div>
      <p className="mt-2 text-ink-2">
        {formatJa(date)}　いつもの予定：<span className="font-semibold">{state.types.find((t) => t.id === usual)?.name}</span>
        {current !== usual && (
          <span className="ml-2 text-alert font-semibold">
            （いまは「{state.types.find((t) => t.id === current)?.name}」に変更中）
          </span>
        )}
      </p>

      <p className="font-bold mt-5 mb-2">② 何に変わった？</p>
      <div className="grid grid-cols-3 gap-2">
        {state.types.map((t) => (
          <button
            key={t.id}
            onClick={() => setTypeId(t.id)}
            className={`py-3 rounded-2xl border-2 font-bold ${colorClass(t.color)} ${typeId === t.id ? 'ring-4 ring-primary/40 border-primary' : ''}`}
          >
            {t.name}
            {t.id === usual && <span className="block text-[11px] font-normal">いつもの予定</span>}
          </button>
        ))}
      </div>

      {preview && (
        <div className="mt-5 rounded-2xl bg-surface border border-line p-3 text-sm">
          <p className="font-bold mb-1">この変更でこうなります</p>
          {preview.added.length === 0 && preview.removedCount === 0 && <p className="text-ink-2">お知らせの変化はありません。</p>}
          {preview.added.map((a) => (
            <p key={`${a.ruleId}|${a.targetDate}`}>
              🔔 {formatJa(a.targetDate)}は{a.conditionLabel}：{itemNames(state, a.itemIds).join('、')}
            </p>
          ))}
          {preview.removedCount > 0 && <p className="text-ink-2">いままでのお知らせ {preview.removedCount} 件が不要になります。</p>}
        </div>
      )}

      <PrimaryButton className="w-full mt-5 text-lg" disabled={typeId === current} onClick={() => onSave(date, typeId)}>
        {typeId === usual && current !== usual ? 'いつもどおりに戻す' : 'この内容で登録'}
      </PrimaryButton>
    </Sheet>
  );
};
