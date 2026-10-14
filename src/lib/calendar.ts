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
  sync(options: { events: CalendarEvent[]; calendarId?: number }): Promise<{ count: number; calendarId: number }>;
  clear(): Promise<void>;
}

export const ItsumoCalendar = registerPlugin<ItsumoCalendarPlugin>('ItsumoCalendar');
