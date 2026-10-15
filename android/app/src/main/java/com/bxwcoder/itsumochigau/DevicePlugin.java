package com.bxwcoder.itsumochigau;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.CalendarContract;
import android.provider.Settings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** 機種別の案内のために、メーカー名や通知を出すアプリを調べ、設定画面を開く */
@CapacitorPlugin(name = "ItsumoDevice")
public class DevicePlugin extends Plugin {

    @PluginMethod
    public void getInfo(PluginCall call) {
        JSObject result = new JSObject();
        result.put("manufacturer", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER);
        result.put("brand", Build.BRAND == null ? "" : Build.BRAND);
        result.put("model", Build.MODEL == null ? "" : Build.MODEL);
        result.put("sdk", Build.VERSION.SDK_INT);
        call.resolve(result);
    }

    /** カレンダーの予定の時刻に通知を出すアプリ（Google カレンダー、TimeTree など） */
    @PluginMethod
    public void getReminderApps(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        Intent intent = new Intent(CalendarContract.ACTION_EVENT_REMINDER, Uri.parse("content://com.android.calendar/0"));
        List<ResolveInfo> receivers = pm.queryBroadcastReceivers(intent, 0);
        JSArray apps = new JSArray();
        Set<String> seen = new HashSet<>();
        for (ResolveInfo info : receivers) {
            if (info.activityInfo == null) continue;
            String pkg = info.activityInfo.packageName;
            if (pkg == null || !seen.add(pkg)) continue;
            JSObject app = new JSObject();
            app.put("packageName", pkg);
            app.put("label", String.valueOf(info.activityInfo.applicationInfo.loadLabel(pm)));
            apps.put(app);
        }
        JSObject result = new JSObject();
        result.put("apps", apps);
        call.resolve(result);
    }

    /** アプリ情報の画面を開く（packageName を省略するとこのアプリ） */
    @PluginMethod
    public void openAppSettings(PluginCall call) {
        String pkg = call.getString("packageName", getContext().getPackageName());
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception ex) {
            call.reject("設定画面を開けませんでした: " + ex.getMessage(), ex);
        }
    }
}
