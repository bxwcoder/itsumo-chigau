// 予定変更の影響を計算する部分（アプリの頭脳）
//
// 考え方：
//  1. 「変更がなかった場合」と「変更後」の2通りで、必要な日を計算する
//  2. 変更後にだけ出てくる「必要な日」が、いつもと違う日
//  3. いつもと違う日だけをお知らせする

import { addDays, diffDays, startOfWeek, weekDates, weekdayJa, weekdayOf, formatJa } from './dates';
import type { AppState, DateStr, Rule, SchedulePattern } from './types';

/** 通常パターンだけで見た、その日の予定 */
export const baseTypeOn = (pattern: SchedulePattern, date: DateStr): string => {
  if (pattern.kind === 'weekly') {
    return pattern.byWeekday[weekdayOf(date)];
  }
  const len = pattern.cycle.length;
  const offset = diffDays(date, pattern.startDate);
  return pattern.cycle[((offset % len) + len) % len];
};

/** 予定変更も反映した、その日の本当の予定 */
export const actualTypeOn = (state: AppState, date: DateStr): string =>
  state.overrides[date]?.typeId ?? baseTypeOn(state.pattern, date);

type TypeResolver = (date: DateStr) => string;

/** ルールの条件に合う日を、指定した週の中から探す */
const targetDatesInWeek = (rule: Rule, week: DateStr[], typeOn: TypeResolver): DateStr[] => {
  const matches = week.filter((d) => rule.condition.typeIds.includes(typeOn(d)));
  switch (rule.condition.kind) {
    case 'firstOfWeek':
      return matches.slice(0, 1);
    case 'lastOfWeek':
      return matches.slice(-1);
    case 'every':
      return matches;
  }
};

/** 1つの「必要」：どのルールで、何の日に、いつ知らせるか */
export interface Need {
  ruleId: string;
  itemIds: string[];
  /** 持ち物が必要な日 */
  targetDate: DateStr;
  /** お知らせする日（前日のルールなら targetDate の前日） */
  notifyDate: DateStr;
  timing: Rule['timing'];
}

/** from〜to の期間に「必要な日」を全部計算する */
export const computeNeeds = (
  state: AppState,
  from: DateStr,
  to: DateStr,
  typeOn: TypeResolver,
): Need[] => {
  const { weekStartsOn } = state.settings;
  const needs: Need[] = [];
  // 前日ルールでは「翌週の最初の日」の前日が期間の最後に入ることがあるので、to の翌日の週まで見る
  let weekStart = startOfWeek(from, weekStartsOn);
  const last = addDays(to, 1);
  while (diffDays(weekStart, last) <= 0) {
    const week = weekDates(weekStart, weekStartsOn);
    for (const rule of state.rules) {
      if (!rule.enabled || rule.itemIds.length === 0) continue;
      for (const targetDate of targetDatesInWeek(rule, week, typeOn)) {
        const notifyDate = rule.timing === 'dayBefore' ? addDays(targetDate, -1) : targetDate;
        if (diffDays(notifyDate, from) < 0 || diffDays(notifyDate, to) > 0) continue;
        needs.push({ ruleId: rule.id, itemIds: rule.itemIds, targetDate, notifyDate, timing: rule.timing });
      }
    }
    weekStart = addDays(weekStart, 7);
  }
  return needs;
};

const needKey = (n: Pick<Need, 'ruleId' | 'targetDate'>) => `${n.ruleId}|${n.targetDate}`;

/** 「準備した」の記録に使うキー */
export const confirmKey = (n: Pick<Need, 'ruleId' | 'targetDate'>) => needKey(n);

/** いつもと違うために発生した「必要」と、その理由 */
export interface Alert extends Need {
  /** 「月曜日が休み」のような、きっかけになった変更（なければ空） */
  cause: string;
  /** 「今週最初の出勤日」 */
  conditionLabel: string;
  /** お知らせする日から見た理由の文章 */
  reason: string;
}

const CONDITION_LABEL: Record<Rule['condition']['kind'], string> = {
  firstOfWeek: '今週最初の',
  lastOfWeek: '今週最後の',
  every: '',
};

/** 条件の説明文 「今週最初の出勤日」「出勤・夜勤日」 */
export const describeCondition = (state: AppState, rule: Rule): string => {
  const names = rule.condition.typeIds
    .map((id) => state.types.find((t) => t.id === id)?.name)
    .filter(Boolean)
    .join('・');
  return `${CONDITION_LABEL[rule.condition.kind]}${names}日`;
};

const typeName = (state: AppState, id: string) => state.types.find((t) => t.id === id)?.name ?? id;

/** きっかけになった変更：ルールが見ている範囲（週ごとの条件なら同じ週、毎回の条件ならその日）で予定が変わった日 */
const findCause = (state: AppState, rule: Rule, targetDate: DateStr): string => {
  const range =
    rule.condition.kind === 'every' ? [targetDate] : weekDates(targetDate, state.settings.weekStartsOn);
  return range
    .filter((d) => state.overrides[d] && actualTypeOn(state, d) !== baseTypeOn(state.pattern, d))
    .map((d) => `${weekdayJa(d)}が${typeName(state, actualTypeOn(state, d))}`)
    .join('、');
};

/** 理由の文章。dayLabel は「今日」「明日（10月13日（火））」など */
export const reasonText = (cause: string, dayLabel: string, conditionLabel: string): string =>
  cause ? `${cause}になったため、${dayLabel}は${conditionLabel}です。` : `${dayLabel}は${conditionLabel}です。`;

/**
 * from〜to の期間で「いつもと違う」お知らせを計算する。
 * 通常パターンだけでも必要な日（いつもどおりの日）は含めない。
 */
export const computeAlerts = (state: AppState, from: DateStr, to: DateStr): Alert[] => {
  const usual = new Set(computeNeeds(state, from, to, (d) => baseTypeOn(state.pattern, d)).map(needKey));
  const actual = computeNeeds(state, from, to, (d) => actualTypeOn(state, d));
  return actual
    .filter((n) => !usual.has(needKey(n)))
    .map((n) => {
      const rule = state.rules.find((r) => r.id === n.ruleId)!;
      const cause = findCause(state, rule, n.targetDate);
      const conditionLabel = describeCondition(state, rule);
      const dayLabel = n.timing === 'dayBefore' ? `明日（${formatJa(n.targetDate)}）` : '今日';
      return { ...n, cause, conditionLabel, reason: reasonText(cause, dayLabel, conditionLabel) };
    })
    .sort((a, b) => a.notifyDate.localeCompare(b.notifyDate) || a.timing.localeCompare(b.timing));
};
