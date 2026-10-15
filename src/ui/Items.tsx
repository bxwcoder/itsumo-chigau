import React, { useState } from 'react';
import type { AppState, Item } from '../core/types';
import { Card, SectionTitle, SubButton, fieldClass, newId } from './common';

interface Props {
  state: AppState;
  update: (fn: (s: AppState) => AppState) => void;
}

const KIND_LABEL: Record<Item['kind'], string> = { item: '持ち物', action: '行動' };

export const Items: React.FC<Props> = ({ state, update }) => {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Item['kind']>('item');

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    update((s) => ({ ...s, items: [...s.items, { id: newId('item'), name: trimmed, kind }] }));
    setName('');
  };

  const remove = (item: Item) => {
    const used = state.rules.filter((r) => r.itemIds.includes(item.id)).length;
    const message = used > 0 ? `「${item.name}」を消しますか？\n${used}件のルールからも外れます。` : `「${item.name}」を消しますか？`;
    if (!window.confirm(message)) return;
    update((s) => ({
      ...s,
      items: s.items.filter((i) => i.id !== item.id),
      rules: s.rules.map((r) => ({ ...r, itemIds: r.itemIds.filter((id) => id !== item.id) })),
    }));
  };

  return (
    <div className="p-4">
      <p className="text-sm text-ink-2 px-1">
        ここで登録したものを、「ルール」で「いつ必要か」と結びつけます。
      </p>

      <SectionTitle>登録した持ち物・行動</SectionTitle>
      <Card className="p-0">
        {state.items.length === 0 && <p className="p-4 text-ink-2">まだありません。</p>}
        <ul className="divide-y divide-line">
          {state.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between px-4 py-3">
              <span>
                <span className={`text-xs font-semibold rounded px-1.5 py-0.5 mr-2 ${item.kind === 'item' ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-ink'}`}>
                  {KIND_LABEL[item.kind]}
                </span>
                <span className="text-lg">{item.name}</span>
              </span>
              <button onClick={() => remove(item)} className="text-ink-2 px-2 py-1" aria-label={`${item.name}を消す`}>
                消す
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <SectionTitle>新しく追加</SectionTitle>
      <Card>
        <div className="flex gap-2 mb-3">
          {(['item', 'action'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`flex-1 py-2 rounded-full border font-semibold ${kind === k ? 'bg-primary text-on-primary border-primary' : 'bg-surface border-line'}`}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder={kind === 'item' ? '例：弁当、体操服、診察券' : '例：洗濯する、荷物を準備する'}
            className={`flex-1 ${fieldClass} min-w-0`}
          />
          <SubButton onClick={add}>追加</SubButton>
        </div>
      </Card>
    </div>
  );
};
