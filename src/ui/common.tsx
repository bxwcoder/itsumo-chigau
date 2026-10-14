import React from 'react';
import type { AppState } from '../core/types';

// Tailwind は文字列を組み立てるとクラスを見つけられないので、全部書いておく
const COLOR_CLASSES: Record<string, string> = {
  teal: 'bg-teal-100 text-teal-800 border-teal-300',
  slate: 'bg-stone-200 text-stone-700 border-stone-300',
  amber: 'bg-amber-100 text-amber-800 border-amber-300',
  indigo: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  sky: 'bg-sky-100 text-sky-800 border-sky-300',
  rose: 'bg-rose-100 text-rose-800 border-rose-300',
  lime: 'bg-lime-100 text-lime-800 border-lime-300',
  violet: 'bg-violet-100 text-violet-800 border-violet-300',
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
  <div className={`bg-white rounded-2xl border border-stone-200 shadow-sm p-4 ${className}`}>{children}</div>
);

export const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-sm font-bold text-stone-500 mt-6 mb-2 px-1">{children}</h2>
);

export const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', ...props }) => (
  <button
    {...props}
    className={`bg-teal-700 text-white font-bold rounded-xl px-4 py-3 active:bg-teal-800 disabled:bg-stone-300 disabled:text-stone-500 ${className}`}
  />
);

export const SubButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', ...props }) => (
  <button
    {...props}
    className={`bg-white text-stone-700 font-semibold border border-stone-300 rounded-xl px-4 py-2 active:bg-stone-100 ${className}`}
  />
);

/** 画面の下から出てくるパネル */
export const Sheet: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({
  title,
  onClose,
  children,
}) => (
  <div className="fixed inset-0 z-30 flex flex-col justify-end bg-black/40" onClick={onClose}>
    <div
      className="bg-stone-50 rounded-t-3xl max-h-[90vh] overflow-y-auto pb-safe"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-label={title}
    >
      <div className="sticky top-0 bg-stone-50 flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="text-lg font-bold">{title}</h2>
        <button onClick={onClose} className="w-10 h-10 rounded-full text-2xl text-stone-500 active:bg-stone-200" aria-label="閉じる">
          ×
        </button>
      </div>
      <div className="px-4 pb-6">{children}</div>
    </div>
  </div>
);

let counter = 0;
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;
