// 最初の案内で選ぶ「ひな形」。選んだ生活に合わせて、予定・持ち物・ルールを最初から入れておく。
import { addDays, formatJa, startOfWeek, weekdayOf } from './dates';
import { computeAlerts } from './engine';
import { itemNames } from './schedule';
import type { AppState, DateStr, Item, Rule, ScheduleType, SchedulePattern } from './types';

export type TemplateId = 'office' | 'shift' | 'school' | 'free';

interface TemplateItem extends Item {
  /** 最初からチェックを入れておくか */
  preset: boolean;
}

export interface Template {
  id: TemplateId;
  label: string;
  description: string;
  types: ScheduleType[];
  pattern: (today: DateStr) => SchedulePattern;
  items: TemplateItem[];
  rules: Rule[];
}

const T = {
  work: { id: 'work', name: '出勤', color: 'teal' },
  off: { id: 'off', name: '休み', color: 'slate' },
  paid: { id: 'paid', name: '有給', color: 'amber' },
  night: { id: 'night', name: '夜勤', color: 'indigo' },
  remote: { id: 'remote', name: '在宅勤務', color: 'sky' },
  school: { id: 'school', name: '学校', color: 'lime' },
  hospital: { id: 'hospital', name: '病院', color: 'rose' },
} satisfies Record<string, ScheduleType>;

const rule = (id: string, kind: Rule['condition']['kind'], typeIds: string[], itemIds: string[], timing: Rule['timing'] = 'sameDay'): Rule => ({
  id,
  condition: { kind, typeIds },
  itemIds,
  timing,
  enabled: true,
});

const weekly = (weekdayType: string, weekendType: string): SchedulePattern => ({
  kind: 'weekly',
  byWeekday: [weekendType, weekdayType, weekdayType, weekdayType, weekdayType, weekdayType, weekendType],
});

export const TEMPLATES: Template[] = [
  {
    id: 'office',
    label: '平日に出勤',
    description: '月〜金に出勤、土日が休み（会社員など）',
    types: [T.work, T.off, T.paid, T.remote],
    pattern: () => weekly('work', 'off'),
    items: [
      { id: 'uniform', name: '作業服', kind: 'item', preset: true },
      { id: 'idcard', name: '社員証', kind: 'item', preset: true },
      { id: 'takehome', name: '作業服を持ち帰る', kind: 'action', preset: true },
    ],
    rules: [
      rule('first-workday', 'firstOfWeek', ['work'], ['uniform', 'idcard']),
      rule('last-workday', 'lastOfWeek', ['work'], ['takehome']),
    ],
  },
  {
    id: 'shift',
    label: 'シフト勤務',
    description: '出勤と休みをくり返す（あとで「予定」で直せます）',
    types: [T.work, T.night, T.off, T.paid],
    pattern: (today) => ({ kind: 'cycle', cycle: ['work', 'work', 'off', 'off'], startDate: today }),
    items: [
      { id: 'uniform', name: '制服', kind: 'item', preset: true },
      { id: 'idcard', name: '社員証', kind: 'item', preset: true },
      { id: 'lunch', name: '弁当', kind: 'item', preset: false },
    ],
    rules: [rule('every-workday', 'every', ['work', 'night'], ['uniform', 'idcard', 'lunch'], 'dayBefore')],
  },
  {
    id: 'school',
    label: '子どもの学校',
    description: '月〜金に登校、土日が休み',
    types: [T.school, T.off],
    pattern: () => weekly('school', 'off'),
    items: [
      { id: 'uwabaki', name: '上履き', kind: 'item', preset: true },
      { id: 'kyushoku', name: '給食袋', kind: 'item', preset: true },
      { id: 'uwabaki-home', name: '上履きを持ち帰る', kind: 'action', preset: true },
    ],
    rules: [
      rule('first-schoolday', 'firstOfWeek', ['school'], ['uwabaki', 'kyushoku'], 'dayBefore'),
      rule('last-schoolday', 'lastOfWeek', ['school'], ['uwabaki-home']),
    ],
  },
  {
    id: 'free',
    label: '決まった予定はない',
    description: '主婦・主夫、自営業など。予定がある日だけ登録',
    types: [T.off],
    pattern: () => weekly('off', 'off'),
    items: [],
    rules: [],
  },
];

/** どのひな形にも足せる「通院」 */
export const HOSPITAL_ADDON = {
  type: T.hospital,
  items: [
    { id: 'shinsatsuken', name: '診察券', kind: 'item', preset: true },
    { id: 'hokensho', name: '保険証', kind: 'item', preset: true },
  ] satisfies TemplateItem[],
  rule: rule('hospital-day', 'every', ['hospital'], ['shinsatsuken', 'hokensho'], 'dayBefore'),
};

export const templateById = (id: TemplateId) => TEMPLATES.find((t) => t.id === id)!;

/** ひな形で選べる持ち物（通院を足すならその分も） */
export const templateItems = (id: TemplateId, hospital: boolean): TemplateItem[] => [
  ...templateById(id).items,
  ...(hospital ? HOSPITAL_ADDON.items : []),
];

/** ひな形を今のデータにあてはめる（設定はそのまま。予定変更などは消える） */
export const applyTemplate = (
  state: AppState,
  id: TemplateId,
  selectedItemIds: string[],
  hospital: boolean,
  today: DateStr,
): AppState => {
  const t = templateById(id);
  const selected = new Set(selectedItemIds);
  const items = templateItems(id, hospital)
    .filter((i) => selected.has(i.id))
    .map(({ preset: _preset, ...item }) => item);
  const rules = [...t.rules, ...(hospital ? [HOSPITAL_ADDON.rule] : [])]
    .map((r) => ({ ...r, itemIds: r.itemIds.filter((i) => selected.has(i)) }))
    .filter((r) => r.itemIds.length > 0);
  const types = [...t.types, ...(hospital ? [HOSPITAL_ADDON.type] : [])];
  return { ...state, types, pattern: t.pattern(today), items, rules, overrides: {}, confirmed: {} };
};

export interface Demo {
  /** 「来週の月曜日（10月19日）が休みになったら…」 */
  change: string;
  /** その結果のお知らせの日付 */
  resultDate: string;
  reason: string;
  items: string[];
}

/**
 * 「試しに予定を変えてみると…」の見本。保存はしない。
 * 来週のどこかを変えて、お知らせがどう出るかを計算する。
 */
export const buildDemo = (state: AppState, today: DateStr): Demo | null => {
  const nextWeek = addDays(startOfWeek(today, state.settings.weekStartsOn), 7);
  const from = addDays(nextWeek, -1);
  const to = addDays(nextWeek, 13);
  const typeName = (id: string) => state.types.find((x) => x.id === id)?.name ?? id;
  const hasType = (id: string) => state.types.some((x) => x.id === id);

  // 試す変更の候補：①いつもの日を「休み」に ②休みの日を別の予定に
  const candidates: [DateStr, string][] = [];
  for (let i = 0; i < 14; i++) {
    const d = addDays(nextWeek, i);
    const usual = state.pattern.kind === 'weekly' ? state.pattern.byWeekday[weekdayOf(d)] : null;
    if (usual && usual !== 'off' && hasType('off')) candidates.push([d, 'off']);
  }
  for (let i = 0; i < 14; i++) {
    const d = addDays(nextWeek, i);
    for (const t of ['work', 'hospital']) if (hasType(t)) candidates.push([d, t]);
  }

  for (const [date, typeId] of candidates) {
    const changed = { ...state, overrides: { [date]: { typeId } } };
    const alerts = computeAlerts(changed, from, to);
    if (alerts.length === 0) continue;
    const a = alerts[0];
    return {
      change: `${formatJa(date)}が「${typeName(typeId)}」になったら…`,
      resultDate: formatJa(a.notifyDate) + (a.timing === 'dayBefore' ? 'の夜' : 'の朝'),
      reason: a.cause
        ? `${a.cause}になったため、${formatJa(a.targetDate)}は${a.conditionLabel}です。`
        : `${formatJa(a.targetDate)}は${a.conditionLabel}です。`,
      items: itemNames(changed, a.itemIds),
    };
  }
  return null;
};
