package com.bxwcoder.itsumochigau;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;
import org.json.JSONObject;

/**
 * スマホのカレンダーに「いつもと違う日」の予定を書き込む。
 * 通知はカレンダー（Android の中心部品）が出すので、このアプリが止められても届く。
 */
@CapacitorPlugin(
    name = "ItsumoCalendar",
    permissions = {
        @Permission(alias = "calendar", strings = { Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR })
    }
)
public class CalendarPlugin extends Plugin {

    private static final String ACCOUNT_NAME = "いつもと違う日";
    private static final String PREFS = "itsumo_calendar";
    private static final String KEY_EVENT_IDS = "event_ids";
    private static final int EVENT_MINUTES = 15;
    private static final int HISTORY_DAYS = 7;

    private boolean hasPermission() {
        return getPermissionState("calendar") == PermissionState.GRANTED;
    }

    /** 書き込める既存のカレンダー一覧（専用カレンダーで通知が出ない機種のための予備） */
    @PluginMethod
    public void listCalendars(PluginCall call) {
        if (!hasPermission()) {
            call.reject("カレンダーへのアクセスが許可されていません", "NO_PERMISSION");
            return;
        }
        JSArray list = new JSArray();
        String[] projection = {
            CalendarContract.Calendars._ID,
            CalendarContract.Calendars.CALENDAR_DISPLAY_NAME,
            CalendarContract.Calendars.ACCOUNT_NAME,
            CalendarContract.Calendars.ACCOUNT_TYPE,
        };
        String selection = CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL + " >= ?";
        String[] args = { String.valueOf(CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR) };
        try (Cursor c = resolver().query(CalendarContract.Calendars.CONTENT_URI, projection, selection, args, null)) {
            while (c != null && c.moveToNext()) {
                JSObject item = new JSObject();
                item.put("id", c.getLong(0));
                item.put("name", c.getString(1));
                item.put("account", c.getString(2));
                item.put("isOwn", ACCOUNT_NAME.equals(c.getString(2)) && CalendarContract.ACCOUNT_TYPE_LOCAL.equals(c.getString(3)));
                list.put(item);
            }
        }
        JSObject result = new JSObject();
        result.put("calendars", list);
        call.resolve(result);
    }

    /**
     * 渡された予定と、すでに書き込んである予定を見比べて、違うところだけ直す。
     * 変わっていない予定はそのまま残すので、スマホ側の通知の予約が安定する。
     * 時刻を過ぎた予定は、通知できたかを後で確かめられるよう 7 日間残す。
     * events: [{ title, description, start(ミリ秒) }]
     * calendarId: 書き込み先（省略時は専用カレンダー）
     */
    @PluginMethod
    public void sync(PluginCall call) {
        if (!hasPermission()) {
            call.reject("カレンダーへのアクセスが許可されていません", "NO_PERMISSION");
            return;
        }
        try {
            long ownId = ensureOwnCalendar();
            Long requested = call.getLong("calendarId");
            long calendarId = requested != null && requested > 0 ? requested : ownId;
            long now = System.currentTimeMillis();

            // 書き込みたい予定
            JSArray events = call.getArray("events", new JSArray());
            Map<String, JSONObject> wanted = new LinkedHashMap<>();
            for (int i = 0; i < events.length(); i++) {
                JSONObject e = events.getJSONObject(i);
                wanted.put(key(calendarId, e.getLong("start"), e.getString("title"), e.optString("description", "")), e);
            }

            // すでにある予定のうち、同じものは残し、いらないものは消す
            Set<String> ids = new HashSet<>();
            int kept = 0;
            int removed = 0;
            for (Written w : findWritten(ownId)) {
                String k = key(w.calendarId, w.start, w.title, w.description);
                if (wanted.containsKey(k)) {
                    wanted.remove(k);
                    ids.add(String.valueOf(w.id));
                    kept++;
                } else if (w.start > now || w.start < now - HISTORY_DAYS * 86_400_000L) {
                    deleteEvent(w, ownId);
                    removed++;
                } else {
                    ids.add(String.valueOf(w.id)); // 時刻を過ぎた予定は記録として残す
                }
            }

            // 新しい予定だけ書き込む
            String tz = TimeZone.getDefault().getID();
            int added = 0;
            for (JSONObject e : wanted.values()) {
                long start = e.getLong("start");
                ContentValues ev = new ContentValues();
                ev.put(CalendarContract.Events.CALENDAR_ID, calendarId);
                ev.put(CalendarContract.Events.TITLE, e.getString("title"));
                ev.put(CalendarContract.Events.DESCRIPTION, e.optString("description", ""));
                ev.put(CalendarContract.Events.DTSTART, start);
                ev.put(CalendarContract.Events.DTEND, start + EVENT_MINUTES * 60_000L);
                ev.put(CalendarContract.Events.EVENT_TIMEZONE, tz);
                ev.put(CalendarContract.Events.HAS_ALARM, 1);
                ev.put(CalendarContract.Events.AVAILABILITY, CalendarContract.Events.AVAILABILITY_FREE);
                Uri uri = resolver().insert(CalendarContract.Events.CONTENT_URI, ev);
                if (uri == null) continue;
                long eventId = ContentUris.parseId(uri);
                ids.add(String.valueOf(eventId));

                // 予定の開始時刻ちょうどに通知する
                ContentValues rem = new ContentValues();
                rem.put(CalendarContract.Reminders.EVENT_ID, eventId);
                rem.put(CalendarContract.Reminders.MINUTES, 0);
                rem.put(CalendarContract.Reminders.METHOD, CalendarContract.Reminders.METHOD_ALERT);
                resolver().insert(CalendarContract.Reminders.CONTENT_URI, rem);
                added++;
            }
            prefs().edit().putStringSet(KEY_EVENT_IDS, ids).apply();

            JSObject result = new JSObject();
            result.put("count", kept + added);
            result.put("added", added);
            result.put("removed", removed);
            result.put("calendarId", calendarId);
            call.resolve(result);
        } catch (Exception ex) {
            call.reject("カレンダーへの書き込みに失敗しました: " + ex.getMessage(), ex);
        }
    }

    /**
     * 書き込んだ予定のうち from〜to のものと、スマホがそれを通知したかどうか。
     * state: fired（通知した）/ dismissed（通知して閉じた）/ scheduled（まだ）/ none（通知の予約がない）
     */
    @PluginMethod
    public void listRecent(PluginCall call) {
        if (!hasPermission()) {
            call.reject("カレンダーへのアクセスが許可されていません", "NO_PERMISSION");
            return;
        }
        long from = call.getLong("from", 0L);
        long to = call.getLong("to", Long.MAX_VALUE);
        JSArray list = new JSArray();
        for (Written w : findWritten(findOwnCalendar())) {
            if (w.start < from || w.start > to) continue;
            JSObject item = new JSObject();
            item.put("title", w.title);
            item.put("start", w.start);
            item.put("state", alertState(w.id));
            list.put(item);
        }
        JSObject result = new JSObject();
        result.put("events", list);
        call.resolve(result);
    }

    private String alertState(long eventId) {
        String state = "none";
        try (
            Cursor c = resolver().query(
                CalendarContract.CalendarAlerts.CONTENT_URI,
                new String[] { CalendarContract.CalendarAlerts.STATE },
                CalendarContract.CalendarAlerts.EVENT_ID + " = ?",
                new String[] { String.valueOf(eventId) },
                null
            )
        ) {
            while (c != null && c.moveToNext()) {
                int s = c.getInt(0);
                if (s == CalendarContract.CalendarAlerts.STATE_FIRED) return "fired";
                if (s == CalendarContract.CalendarAlerts.STATE_DISMISSED) state = "dismissed";
                else if (s == CalendarContract.CalendarAlerts.STATE_SCHEDULED && !"dismissed".equals(state)) state = "scheduled";
            }
        } catch (Exception ignored) {
            // 機種によっては読めないことがある
        }
        return state;
    }

    private static String key(long calendarId, long start, String title, String description) {
        return calendarId + "|" + start + "|" + title + "|" + description;
    }

    private static class Written {
        long id;
        long calendarId;
        long start;
        String title;
        String description;
    }

    /** このアプリが書き込んだ予定（専用カレンダーの中身と、他のカレンダーに書いた分） */
    private List<Written> findWritten(long ownId) {
        Set<String> stored = prefs().getStringSet(KEY_EVENT_IDS, new HashSet<>());
        StringBuilder sel = new StringBuilder("(" + CalendarContract.Events.CALENDAR_ID + " = ?");
        List<String> args = new ArrayList<>();
        args.add(String.valueOf(ownId));
        if (!stored.isEmpty()) {
            sel.append(" OR ").append(CalendarContract.Events._ID).append(" IN (");
            int i = 0;
            for (String id : stored) {
                sel.append(i++ == 0 ? "?" : ",?");
                args.add(id);
            }
            sel.append(")");
        }
        sel.append(") AND ").append(CalendarContract.Events.DELETED).append(" = 0");
        String[] projection = {
            CalendarContract.Events._ID,
            CalendarContract.Events.CALENDAR_ID,
            CalendarContract.Events.DTSTART,
            CalendarContract.Events.TITLE,
            CalendarContract.Events.DESCRIPTION,
        };
        List<Written> list = new ArrayList<>();
        try (Cursor c = resolver().query(CalendarContract.Events.CONTENT_URI, projection, sel.toString(), args.toArray(new String[0]), CalendarContract.Events.DTSTART)) {
            while (c != null && c.moveToNext()) {
                Written w = new Written();
                w.id = c.getLong(0);
                w.calendarId = c.getLong(1);
                w.start = c.getLong(2);
                w.title = c.getString(3) == null ? "" : c.getString(3);
                w.description = c.getString(4) == null ? "" : c.getString(4);
                list.add(w);
            }
        }
        return list;
    }

    private void deleteEvent(Written w, long ownId) {
        Uri base = w.calendarId == ownId ? asSyncAdapter(CalendarContract.Events.CONTENT_URI) : CalendarContract.Events.CONTENT_URI;
        resolver().delete(ContentUris.withAppendedId(base, w.id), null, null);
    }

    /** このアプリが書き込んだ予定を全部消す */
    @PluginMethod
    public void clear(PluginCall call) {
        if (!hasPermission()) {
            call.resolve();
            return;
        }
        try {
            deleteWrittenEvents(findOwnCalendar());
            prefs().edit().remove(KEY_EVENT_IDS).apply();
            call.resolve();
        } catch (Exception ex) {
            call.reject("カレンダーの予定を消せませんでした: " + ex.getMessage(), ex);
        }
    }

    private void deleteWrittenEvents(long ownId) {
        // 他のカレンダーに書いた分は、覚えておいた番号で消す
        Set<String> ids = prefs().getStringSet(KEY_EVENT_IDS, new HashSet<>());
        for (String id : ids) {
            resolver().delete(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, Long.parseLong(id)), null, null);
        }
        // 専用カレンダーの中身は全部このアプリのものなので、完全に消す
        if (ownId > 0) {
            resolver().delete(
                asSyncAdapter(CalendarContract.Events.CONTENT_URI),
                CalendarContract.Events.CALENDAR_ID + " = ?",
                new String[] { String.valueOf(ownId) }
            );
        }
    }

    private long findOwnCalendar() {
        String selection = CalendarContract.Calendars.ACCOUNT_NAME + " = ? AND " + CalendarContract.Calendars.ACCOUNT_TYPE + " = ?";
        String[] args = { ACCOUNT_NAME, CalendarContract.ACCOUNT_TYPE_LOCAL };
        try (
            Cursor c = resolver().query(
                CalendarContract.Calendars.CONTENT_URI,
                new String[] { CalendarContract.Calendars._ID },
                selection,
                args,
                null
            )
        ) {
            if (c != null && c.moveToFirst()) return c.getLong(0);
        }
        return -1;
    }

    /** 専用カレンダー「いつもと違う日」がなければ作る（このスマホの中だけのカレンダー） */
    private long ensureOwnCalendar() {
        long id = findOwnCalendar();
        if (id > 0) return id;
        ContentValues v = new ContentValues();
        v.put(CalendarContract.Calendars.ACCOUNT_NAME, ACCOUNT_NAME);
        v.put(CalendarContract.Calendars.ACCOUNT_TYPE, CalendarContract.ACCOUNT_TYPE_LOCAL);
        v.put(CalendarContract.Calendars.NAME, ACCOUNT_NAME);
        v.put(CalendarContract.Calendars.CALENDAR_DISPLAY_NAME, ACCOUNT_NAME);
        v.put(CalendarContract.Calendars.CALENDAR_COLOR, 0xFF0F766E);
        v.put(CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL, CalendarContract.Calendars.CAL_ACCESS_OWNER);
        v.put(CalendarContract.Calendars.OWNER_ACCOUNT, ACCOUNT_NAME);
        v.put(CalendarContract.Calendars.VISIBLE, 1);
        v.put(CalendarContract.Calendars.SYNC_EVENTS, 1);
        v.put(CalendarContract.Calendars.CALENDAR_TIME_ZONE, TimeZone.getDefault().getID());
        Uri uri = resolver().insert(asSyncAdapter(CalendarContract.Calendars.CONTENT_URI), v);
        return uri == null ? -1 : ContentUris.parseId(uri);
    }

    private Uri asSyncAdapter(Uri uri) {
        return uri
            .buildUpon()
            .appendQueryParameter(CalendarContract.CALLER_IS_SYNCADAPTER, "true")
            .appendQueryParameter(CalendarContract.Calendars.ACCOUNT_NAME, ACCOUNT_NAME)
            .appendQueryParameter(CalendarContract.Calendars.ACCOUNT_TYPE, CalendarContract.ACCOUNT_TYPE_LOCAL)
            .build();
    }

    private ContentResolver resolver() {
        return getContext().getContentResolver();
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE);
    }
}
