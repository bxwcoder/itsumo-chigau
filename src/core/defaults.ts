import type { AppState } from './types';

/** 最初に入っているデータ（指示書の「最初に実現する具体例」） */
export const createDefaultState = (): AppState => ({
  version: 1,
  types: [
    { id: 'work', name: '出勤', color: 'teal' },
    { id: 'off', name: '休み', color: 'slate' },
    { id: 'paid', name: '有給', color: 'amber' },
    { id: 'night', name: '夜勤', color: 'indigo' },
    { id: 'remote', name: '在宅勤務', color: 'sky' },
  ],
  pattern: {
    kind: 'weekly',
    //            日     月      火      水      木      金      土
    byWeekday: ['off', 'work', 'work', 'work', 'work', 'work', 'off'],
  },
  overrides: {},
  items: [
    { id: 'uniform', name: '作業服', kind: 'item' },
    { id: 'idcard', name: '社員証', kind: 'item' },
  ],
  rules: [
    {
      id: 'first-workday',
      condition: { kind: 'firstOfWeek', typeIds: ['work'] },
      itemIds: ['uniform', 'idcard'],
      timing: 'sameDay',
      enabled: true,
    },
  ],
  settings: {
    sameDayTime: '07:00',
    dayBeforeTime: '21:00',
    weekStartsOn: 1,
    notificationsEnabled: true,
    notifyMethod: 'calendar',
    calendarId: 0,
    checkReminders: {
      daily: { enabled: false, time: '20:00' },
      weekly: { enabled: false, weekday: 1, time: '07:00' },
      monthly: { enabled: false, day: 1, time: '20:00' },
    },
  },
  confirmed: {},
  onboarded: false,
});
