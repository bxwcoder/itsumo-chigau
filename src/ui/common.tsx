import React from 'react';
import type { AppState } from '../core/types';

// Tailwind は文字列を組み立てるとクラスを見つけられないので、全部書いておく
const COLOR_CLASSES: Record<string, string> = {
  teal: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/50 dark:text-teal-100 dark:border-teal-700',
  slate: 'bg-stone-200 text-stone-700 border-stone-300 dark:bg-stone-800 dark:text-stone-200 dark:border-stone-600',
  amber: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-100 dark:border-amber-700',
  indigo: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/50 dark:text-indigo-100 dark:border-indigo-700',
  sky: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/50 dark:text-sky-100 dark:border-sky-700',
  rose: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/50 dark:text-rose-100 dark:border-rose-700',
  lime: 'bg-lime-100 text-lime-800 border-lime-300 dark:bg-lime-900/50 dark:text-lime-100 dark:border-lime-700',
  violet: 'bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-900/50 dark:text-violet-100 dark:border-violet-700',
};

export const TYPE_COLORS = Object.keys(COLOR_CLASSES);

export const colorClass = (color: string) => COLOR_CLASSES[color] ?? COLOR_CLASSES.slate;

export const typeById = (state: AppState, id: string) => state.types.find((t) => t.id === id);

export const TypeBadge: React.FC<{ state: AppState; typeId: string; small?: boolean }> = ({ state, typeId, small }) => {
  const type = typeById(state, typeId);
  return (
    <span
      className={`inline-block border rounded-md font-semibold ${small ? 'text-[11px] px-1 leading-4' : 'text-sm px-2 py-0.5'} ${colorClass(type?.color ?? 'slate')}`}
    >
      {type?.name ?? '？'}
    </span>
  );
};

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-surface rounded-3xl border border-line p-4 ${className}`}>{children}</div>
);

export const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-sm font-semibold text-ink-2 mt-7 mb-2 px-1">{children}</h2>
);

export const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', ...props }) => (
  <button
    {...props}
    className={`bg-primary text-on-primary font-bold rounded-full px-5 py-3 active:opacity-90 disabled:bg-surface-2 disabled:text-ink-2 ${className}`}
  />
);

export const SubButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', ...props }) => (
  <button
    {...props}
    className={`bg-surface text-primary font-semibold border border-line rounded-full px-4 py-2 active:bg-surface-2 ${className}`}
  />
);

/** 選択肢のボタン（選ばれていると色がつく） */
export const chipClass = (active: boolean) =>
  `px-4 py-2 rounded-full border font-semibold ${active ? 'bg-primary text-on-primary border-primary' : 'bg-surface border-line'}`;

/** 画面の下から出てくるパネル */
export const Sheet: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({
  title,
  onClose,
  children,
}) => (
  <div className="fixed inset-0 z-30 flex flex-col justify-end bg-black/50" onClick={onClose}>
    <div
      className="bg-bg rounded-t-[28px] max-h-[90vh] overflow-y-auto pb-safe"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-label={title}
    >
      <div className="sticky top-0 bg-bg px-4 pt-2 pb-2">
        <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-line" aria-hidden />
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="w-10 h-10 rounded-full text-2xl text-ink-2 active:bg-surface-2" aria-label="閉じる">
            ×
          </button>
        </div>
      </div>
      <div className="px-4 pb-6">{children}</div>
    </div>
  </div>
);

/** 文字を入れる欄・選ぶ欄の見た目 */
export const fieldClass = 'border border-line rounded-xl px-3 py-2 bg-surface text-ink';

let counter = 0;
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;
