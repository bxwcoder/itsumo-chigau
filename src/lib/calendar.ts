// スマホのカレンダーとのつなぎ役（中身は android/.../CalendarPlugin.java）
import { registerPlugin, type PermissionState } from '@capacitor/core';

export interface CalendarEvent {
  title: string;
  description: string;
  /** 開始時刻（ミリ秒）。この時刻ちょうどにカレンダーが通知する */
  start: number;
}

export interface CalendarInfo {
  id: number;
  name: string;
  account: string;
  isOwn: boolean;
}

interface ItsumoCalendarPlugin {
  checkPermissions(): Promise<{ calendar: PermissionState }>;
  requestPermissions(): Promise<{ calendar: PermissionState }>;
  listCalendars(): Promise<{ calendars: CalendarInfo[] }>;
  sync(options: { events: CalendarEvent[]; calendarId?: number }): Promise<{ count: number; added: number; removed: number; calendarId: number }>;
  clear(): Promise<void>;
  listRecent(options: { from: number; to: number }): Promise<{ events: WrittenEvent[] }>;
}

export interface WrittenEvent {
  title: string;
  start: number;
  /** fired: 通知した / dismissed: 通知して閉じた / scheduled: まだ / none: 通知の予約がない */
  state: 'fired' | 'dismissed' | 'scheduled' | 'none';
}

export const ItsumoCalendar = registerPlugin<ItsumoCalendarPlugin>('ItsumoCalendar');
