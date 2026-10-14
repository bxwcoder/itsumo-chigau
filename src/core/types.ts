// アプリで扱うデータの形をまとめたファイル

/** 日付は "2026-10-12" のような文字列で扱う（時差のずれを防ぐため） */
export type DateStr = string;

/** 予定の種類（出勤・休み・有給など） */
export interface ScheduleType {
  id: string;
  name: string;
  /** 画面で使う色（Tailwind のクラス名の一部） */
  color: string;
}

/** 通常の予定パターン */
export type SchedulePattern =
  | {
      kind: 'weekly';
      /** 0=日曜 ... 6=土曜 の予定の種類ID */
      byWeekday: string[];
    }
  | {
      kind: 'cycle';
      /** 例: ["work","work","off"] を startDate から繰り返す */
      cycle: string[];
      startDate: DateStr;
    };

/** 日付ごとの予定変更 */
export interface Override {
  typeId: string;
  memo?: string;
}

/** 持ち物・行動 */
export interface Item {
  id: string;
  name: string;
  kind: 'item' | 'action';
}

/** ルールの「いつ必要か」の条件 */
export interface RuleCondition {
  /**
   * firstOfWeek: 今週最初の○○の日
   * lastOfWeek : 今週最後の○○の日
   * every      : ○○の日すべて
   */
  kind: 'firstOfWeek' | 'lastOfWeek' | 'every';
  /** ○○にあたる予定の種類（例: 出勤と夜勤） */
  typeIds: string[];
}

/** ルール：条件に合う日に、持ち物・行動が必要 */
export interface Rule {
  id: string;
  condition: RuleCondition;
  itemIds: string[];
  /** sameDay: その日の朝に知らせる / dayBefore: 前日の夜に知らせる */
  timing: 'sameDay' | 'dayBefore';
  enabled: boolean;
}

export interface Settings {
  /** 当日のお知らせ時刻 "07:00" */
  sameDayTime: string;
  /** 前日のお知らせ時刻 "21:00" */
  dayBeforeTime: string;
  /** 週の始まり 0=日曜 1=月曜 */
  weekStartsOn: 0 | 1;
  notificationsEnabled: boolean;
  /**
   * calendar: スマホのカレンダーに書き込んで、カレンダーに通知してもらう（アプリを閉じても届く）
   * app     : このアプリ自身が通知する（機種によってはアプリを閉じると届かない）
   * both    : 両方
   */
  notifyMethod: 'calendar' | 'app' | 'both';
  /** カレンダーの書き込み先。0 は専用の「いつもと違う日」カレンダー */
  calendarId: number;
}

export interface AppState {
  version: 1;
  types: ScheduleType[];
  pattern: SchedulePattern;
  overrides: Record<DateStr, Override>;
  items: Item[];
  rules: Rule[];
  settings: Settings;
  /** 「準備した」を押したお知らせのキー */
  confirmed: Record<string, true>;
}
