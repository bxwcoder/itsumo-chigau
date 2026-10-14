import React, { useState } from 'react';
import { describeCondition } from '../core/engine';
import { itemNames } from '../core/schedule';
import type { AppState, Rule } from '../core/types';
import { Card, PrimaryButton, SectionTitle, Sheet, SubButton, newId } from './common';

interface Props {
  state: AppState;
  update: (fn: (s: AppState) => AppState) => void;
}

const CONDITION_OPTIONS: [Rule['condition']['kind'], string][] = [
  ['firstOfWeek', '今週最初の'],
  ['lastOfWeek', '今週最後の'],
  ['every', 'すべての'],
];

const timingLabel = (state: AppState, timing: Rule['timing']) =>
  timing === 'sameDay' ? `その日の朝 ${state.settings.sameDayTime} に知らせる` : `前日の夜 ${state.settings.dayBeforeTime} に知らせる`;

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

const RuleForm: React.FC<{ state: AppState; initial: Rule; onSave: (r: Rule) => void; onClose: () => void }> = ({
  state,
  initial,
  onSave,
  onClose,
}) => {
  const [rule, setRule] = useState<Rule>(initial);
  const valid = rule.condition.typeIds.length > 0 && rule.itemIds.length > 0;
  const chip = (active: boolean) =>
    `px-3 py-2 rounded-xl border font-semibold ${active ? 'bg-teal-700 text-white border-teal-700' : 'bg-white border-stone-300'}`;

  return (
    <Sheet title="ルール" onClose={onClose}>
      <p className="font-bold mb-2">① いつ？</p>
      <div className="flex gap-2 flex-wrap">
        {CONDITION_OPTIONS.map(([kind, label]) => (
          <button key={kind} className={chip(rule.condition.kind === kind)} onClick={() => setRule({ ...rule, condition: { ...rule.condition, kind } })}>
            {label}
          </button>
        ))}
      </div>
      <p className="text-sm text-stone-600 mt-3 mb-2">どの予定の日？（いくつでも選べます）</p>
      <div className="flex gap-2 flex-wrap">
        {state.types.map((t) => (
          <button
            key={t.id}
            className={chip(rule.condition.typeIds.includes(t.id))}
            onClick={() => setRule({ ...rule, condition: { ...rule.condition, typeIds: toggle(rule.condition.typeIds, t.id) } })}
          >
            {t.name}
          </button>
        ))}
      </div>

      <p className="font-bold mt-5 mb-2">② 何が必要？</p>
      {state.items.length === 0 ? (
        <p className="text-stone-500 text-sm">先に「持ち物」画面で登録してください。</p>
      ) : (
        <div className="flex gap-2 flex-wrap">
          {state.items.map((i) => (
            <button key={i.id} className={chip(rule.itemIds.includes(i.id))} onClick={() => setRule({ ...rule, itemIds: toggle(rule.itemIds, i.id) })}>
              {i.name}
            </button>
          ))}
        </div>
      )}

      <p className="font-bold mt-5 mb-2">③ いつ知らせる？</p>
      <div className="flex flex-col gap-2">
        {(['sameDay', 'dayBefore'] as const).map((t) => (
          <button key={t} className={`${chip(rule.timing === t)} text-left`} onClick={() => setRule({ ...rule, timing: t })}>
            {timingLabel(state, t)}
          </button>
        ))}
      </div>
      <p className="text-xs text-stone-500 mt-2">時刻は「設定」画面で変えられます。</p>

      <div className="mt-5 rounded-xl bg-white border border-stone-200 p-3">
        <p className="text-sm text-stone-500">このルールの意味</p>
        <p className="font-bold">
          {valid ? `${describeCondition(state, rule)}に、${itemNames(state, rule.itemIds).join('・')}が必要` : '①と②を選んでください'}
        </p>
      </div>

      <PrimaryButton className="w-full mt-5 text-lg" disabled={!valid} onClick={() => onSave(rule)}>
        保存
      </PrimaryButton>
    </Sheet>
  );
};

export const Rules: React.FC<Props> = ({ state, update }) => {
  const [editing, setEditing] = useState<Rule | null>(null);

  const save = (rule: Rule) => {
    update((s) => ({
      ...s,
      rules: s.rules.some((r) => r.id === rule.id) ? s.rules.map((r) => (r.id === rule.id ? rule : r)) : [...s.rules, rule],
    }));
    setEditing(null);
  };

  const remove = (rule: Rule) => {
    if (!window.confirm('このルールを消しますか？')) return;
    update((s) => ({ ...s, rules: s.rules.filter((r) => r.id !== rule.id) }));
  };

  return (
    <div className="p-4">
      <p className="text-sm text-stone-600 px-1">
        曜日ではなく「条件」で決めます。予定が変わって条件に合う日がずれたときだけ、お知らせします。
      </p>

      <SectionTitle>ルール一覧</SectionTitle>
      <div className="space-y-2">
        {state.rules.length === 0 && (
          <Card>
            <p className="text-stone-500">まだありません。</p>
          </Card>
        )}
        {state.rules.map((rule) => (
          <Card key={rule.id} className={rule.enabled ? '' : 'opacity-60'}>
            <p className="font-bold text-lg">
              {describeCondition(state, rule)}に
              <br />
              {itemNames(state, rule.itemIds).join('・') || '（持ち物なし）'}が必要
            </p>
            <p className="text-sm text-stone-600 mt-1">{timingLabel(state, rule.timing)}</p>
            <div className="flex gap-2 mt-3">
              <SubButton onClick={() => setEditing(rule)}>編集</SubButton>
              <SubButton onClick={() => update((s) => ({ ...s, rules: s.rules.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)) }))}>
                {rule.enabled ? '止める' : '使う'}
              </SubButton>
              <SubButton onClick={() => remove(rule)}>消す</SubButton>
            </div>
          </Card>
        ))}
      </div>

      <PrimaryButton
        className="w-full mt-4"
        onClick={() =>
          setEditing({
            id: newId('rule'),
            condition: { kind: 'firstOfWeek', typeIds: state.types.some((t) => t.id === 'work') ? ['work'] : [] },
            itemIds: [],
            timing: 'sameDay',
            enabled: true,
          })
        }
      >
        ＋ ルールを追加
      </PrimaryButton>

      {editing && <RuleForm state={state} initial={editing} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
};
