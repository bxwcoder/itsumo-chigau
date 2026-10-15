// データをスマホの中に保存する（サーバーには送らない）
import { createDefaultState } from '../core/defaults';
import type { AppState } from '../core/types';

const KEY = 'itsumo-chigau:v1';

export const loadState = (): AppState => {
  const defaults = createDefaultState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults;
    const saved = JSON.parse(raw) as Partial<AppState>;
    // 新しい設定項目が増えても壊れないよう、足りない部分は初期値で埋める
    const savedChecks: Partial<AppState['settings']['checkReminders']> = saved.settings?.checkReminders ?? {};
    return {
      ...defaults,
      ...saved,
      settings: {
        ...defaults.settings,
        ...saved.settings,
        checkReminders: { ...defaults.settings.checkReminders, ...savedChecks },
      },
    };
  } catch {
    return defaults;
  }
};

export const saveState = (state: AppState) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 保存できなくてもアプリは動かし続ける
  }
};

export const clearState = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 何もしない
  }
};
