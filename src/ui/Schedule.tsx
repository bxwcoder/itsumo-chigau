import React, { useState } from 'react';
import { actualTypeOn, baseTypeOn } from '../core/engine';
import { addDays, parseDate, startOfWeek, toDateStr, WEEKDAY_NAMES, weekdayOf } from '../core/dates';
import type { AppState, DateStr, SchedulePattern } from '../core/types';
import { Card, SectionTitle, SubButton, TYPE_COLORS, TypeBadge, colorClass, fieldClass, newId } from './common';

interface Props {
  state: AppState;
  today: DateStr;
  onOpenChange: (date: DateStr) => void;
  update: (fn: (s: AppState) => AppState) => void;
}

const TypeSelect: React.FC<{ state: AppState; value: string; onChange: (id: string) => void; label: string }> = ({
  state,
  value,
  onChange,
  label,
}) => (
  <select
    aria-label={label}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={`${fieldClass}`}
  >
    {state.types.map((t) => (
      <option key={t.id} value={t.id}>
        {t.name}
      </option>
    ))}
  </select>
);

const MonthCalendar: React.FC<Omit<Props, 'update'>> = ({ state, today, onOpenChange }) => {
  const [month, setMonth] = useState(() => today.slice(0, 7) + '-01');
  const first = parseDate(month);
  const last = toDateStr(new Date(first.getFullYear(), first.getMonth() + 1, 0));
  const gridStart = startOfWeek(month, state.settings.weekStartsOn);
  const days: DateStr[] = [];
  for (let d = gridStart; d <= last || days.length % 7 !== 0; d = addDays(d, 1)) days.push(d);
  const headers = Array.from({ length: 7 }, (_, i) => WEEKDAY_NAMES[(i + state.settings.weekStartsOn) % 7]);
  const moveMonth = (n: number) => setMonth(toDateStr(new Date(first.getFullYear(), first.getMonth() + n, 1)));

  return (
    <Card className="p-2">
      <div className="flex items-center justify-between px-1 mb-2">
        <button onClick={() => moveMonth(-1)} className="w-10 h-10 rounded-full active:bg-surface-2 text-xl" aria-label="前の月">
          ‹
        </button>
        <p className="font-bold text-lg">
          {first.getFullYear()}年{first.getMonth() + 1}月
        </p>
        <button onClick={() => moveMonth(1)} className="w-10 h-10 rounded-full active:bg-surface-2 text-xl" aria-label="次の月">
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {headers.map((h) => (
          <div key={h} className="text-xs text-ink-2">
            {h}
          </div>
        ))}
        {days.map((d) => {
          const inMonth = d.slice(0, 7) === month.slice(0, 7);
          const changed = actualTypeOn(state, d) !== baseTypeOn(state.pattern, d);
          const weekday = weekdayOf(d);
          return (
            <button
              key={d}
              onClick={() => onOpenChange(d)}
              className={`rounded-lg py-1 min-h-14 ${inMonth ? '' : 'opacity-35'} ${d === today ? 'ring-2 ring-primary' : ''} ${changed ? 'bg-alert-soft' : ''}`}
            >
              <div className={`text-sm ${weekday === 0 ? 'text-rose-500' : weekday === 6 ? 'text-sky-500' : ''}`}>
                {Number(d.slice(8))}
              </div>
              <TypeBadge state={state} typeId={actualTypeOn(state, d)} small />
              <div className="h-3 text-[9px] font-bold text-alert leading-3">{changed ? '変更' : ''}</div>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-ink-2 mt-2 px-1">日付をタップすると、その日の予定を変更できます。翌月分もまとめて登録できます。</p>
    </Card>
  );
};

const PatternEditor: React.FC<Pick<Props, 'state' | 'today' | 'update'>> = ({ state, today, update }) => {
  const { pattern } = state;
  const setPattern = (p: SchedulePattern) => update((s) => ({ ...s, pattern: p }));
  const orderedWeekdays = Array.from({ length: 7 }, (_, i) => (i + state.settings.weekStartsOn) % 7);

  return (
    <Card>
      <div className="flex gap-2 mb-3">
        {(
          [
            ['weekly', '毎週おなじ'],
            ['cycle', 'シフト（くり返し）'],
          ] as const
        ).map(([kind, label]) => (
          <button
            key={kind}
            onClick={() => {
              if (kind === pattern.kind) return;
              // 「出勤」「休み」が消されていても壊れないよう、なければ最初の種類を使う
              const pick = (id: string) => (state.types.some((t) => t.id === id) ? id : state.types[0].id);
              const [work, off] = [pick('work'), pick('off')];
              if (kind === 'weekly') setPattern({ kind: 'weekly', byWeekday: Array.from({ length: 7 }, (_, w) => (w === 0 || w === 6 ? off : work)) });
              else setPattern({ kind: 'cycle', cycle: [work, work, off], startDate: today });
            }}
            className={`flex-1 py-2 rounded-full border font-semibold ${pattern.kind === kind ? 'bg-primary text-on-primary border-primary' : 'bg-surface border-line'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {pattern.kind === 'weekly' ? (
        <div className="space-y-2">
          {orderedWeekdays.map((w) => (
            <div key={w} className="flex items-center justify-between">
              <span className="font-semibold">{WEEKDAY_NAMES[w]}曜日</span>
              <TypeSelect
                state={state}
                label={`${WEEKDAY_NAMES[w]}曜日の予定`}
                value={pattern.byWeekday[w]}
                onChange={(id) => setPattern({ ...pattern, byWeekday: pattern.byWeekday.map((t, i) => (i === w ? id : t)) })}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-ink-2">「開始日」から、下の順番をくり返します。</p>
          <label className="flex items-center justify-between">
            <span className="font-semibold">開始日（1日目）</span>
            <input
              type="date"
              value={pattern.startDate}
              onChange={(e) => e.target.value && setPattern({ ...pattern, startDate: e.target.value })}
              className={`${fieldClass}`}
            />
          </label>
          {pattern.cycle.map((id, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className="font-semibold w-16">{i + 1}日目</span>
              <TypeSelect
                state={state}
                label={`${i + 1}日目の予定`}
                value={id}
                onChange={(v) => setPattern({ ...pattern, cycle: pattern.cycle.map((t, j) => (j === i ? v : t)) })}
              />
              <button
                disabled={pattern.cycle.length <= 1}
                onClick={() => setPattern({ ...pattern, cycle: pattern.cycle.filter((_, j) => j !== i) })}
                className="text-ink-2 px-2 disabled:opacity-30"
                aria-label={`${i + 1}日目を消す`}
              >
                消す
              </button>
            </div>
          ))}
          <SubButton onClick={() => setPattern({ ...pattern, cycle: [...pattern.cycle, pattern.cycle[pattern.cycle.length - 1]] })}>＋ 1日ふやす</SubButton>
        </div>
      )}
    </Card>
  );
};

const TypesEditor: React.FC<Pick<Props, 'state' | 'update'>> = ({ state, update }) => {
  const [name, setName] = useState('');
  const inUse = (id: string) =>
    (state.pattern.kind === 'weekly' ? state.pattern.byWeekday : state.pattern.cycle).includes(id) ||
    Object.values(state.overrides).some((o) => o.typeId === id) ||
    state.rules.some((r) => r.condition.typeIds.includes(id));

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    update((s) => ({
      ...s,
      types: [...s.types, { id: newId('type'), name: trimmed, color: TYPE_COLORS[s.types.length % TYPE_COLORS.length] }],
    }));
    setName('');
  };

  return (
    <Card>
      <div className="flex flex-wrap gap-2">
        {state.types.map((t) => (
          <span key={t.id} className={`inline-flex items-center gap-1 border rounded-lg px-2 py-1 font-semibold ${colorClass(t.color)}`}>
            {t.name}
            {!inUse(t.id) && (
              <button
                onClick={() => update((s) => ({ ...s, types: s.types.filter((x) => x.id !== t.id) }))}
                className="ml-1 text-ink-2"
                aria-label={`${t.name}を消す`}
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例：学校、病院、出張"
          className={`flex-1 ${fieldClass} min-w-0`}
        />
        <SubButton onClick={add}>追加</SubButton>
      </div>
      <p className="text-xs text-ink-2 mt-2">使っている種類は消せません（×が出ません）。</p>
    </Card>
  );
};

export const Schedule: React.FC<Props> = (props) => (
  <div className="p-4">
    <SectionTitle>カレンダー</SectionTitle>
    <MonthCalendar {...props} />
    <SectionTitle>いつもの予定（通常パターン）</SectionTitle>
    <PatternEditor {...props} />
    <SectionTitle>予定の種類</SectionTitle>
    <TypesEditor {...props} />
  </div>
);
