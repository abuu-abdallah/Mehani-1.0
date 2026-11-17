package com.mehani.sudan;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.webkit.CookieManager;
import android.webkit.WebSettings;

import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;

import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@CapacitorPlugin(name = "MehaniBackgroundSync")
public class MehaniBackgroundSyncPlugin extends Plugin {

    public static final String PERIODIC_WORK_NAME = "mehani_bg_notif_poll";
    private static final String IMMEDIATE_WORK_NAME = "mehani_bg_notif_immediate";
    private static final int MAX_STORED_KEYS = 200;

    @PluginMethod
    public void saveSession(PluginCall call) {
        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(
            MehaniNotificationWorker.PREFS_NAME,
            Context.MODE_PRIVATE
        );

        String token = call.getString("token", "");
        String userId = call.getString("userId", "");
        String role = call.getString("role", "customer");
        String language = call.getString("language", "ar");
        String apiUrl = call.getString("apiUrl", "https://mehani.gt.tc/api.php");
        String snapshotJson = call.getString("snapshotJson", "");
        JSArray notifiedKeys = call.getArray("notifiedKeys");

        if (token == null || token.isEmpty() || userId == null || userId.isEmpty()) {
            clearSession(call);
            return;
        }

        SharedPreferences.Editor editor = prefs.edit();
        editor.putString(MehaniNotificationWorker.KEY_TOKEN, token);
        editor.putString(MehaniNotificationWorker.KEY_USER_ID, userId);
        editor.putString(MehaniNotificationWorker.KEY_ROLE, role);
        editor.putString(MehaniNotificationWorker.KEY_LANGUAGE, language);
        editor.putString(MehaniNotificationWorker.KEY_API_URL, apiUrl);

        try {
            String cookies = CookieManager.getInstance().getCookie(apiUrl);
            if (cookies != null && !cookies.isEmpty()) {
                editor.putString(MehaniNotificationWorker.KEY_COOKIE, cookies);
            }
        } catch (Exception ignored) {
        }

        try {
            String ua = WebSettings.getDefaultUserAgent(context);
            if (ua != null && !ua.isEmpty()) {
                editor.putString(MehaniNotificationWorker.KEY_USER_AGENT, ua);
            }
        } catch (Exception ignored) {
        }

        if (snapshotJson != null && snapshotJson.startsWith("{")) {
            editor.putString(MehaniNotificationWorker.KEY_SNAPSHOT_PREFIX + userId, snapshotJson);
        }

        if (notifiedKeys != null) {
            mergeNotifiedKeys(prefs, editor, userId, notifiedKeys);
        }

        editor.apply();

        MehaniNotificationWorker.ensureNotificationChannels(context);
        enqueuePeriodicPolling(context, ExistingPeriodicWorkPolicy.UPDATE);

        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void syncNotifiedKeys(PluginCall call) {
        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(
            MehaniNotificationWorker.PREFS_NAME,
            Context.MODE_PRIVATE
        );

        String userId = call.getString("userId", prefs.getString(MehaniNotificationWorker.KEY_USER_ID, ""));
        JSArray keys = call.getArray("notifiedKeys");
        String snapshotJson = call.getString("snapshotJson", "");

        if (userId != null && !userId.isEmpty()) {
            SharedPreferences.Editor editor = prefs.edit();
            if (keys != null) {
                mergeNotifiedKeys(prefs, editor, userId, keys);
            }
            if (snapshotJson != null && snapshotJson.startsWith("{")) {
                editor.putString(MehaniNotificationWorker.KEY_SNAPSHOT_PREFIX + userId, snapshotJson);
            }
            editor.apply();
        }

        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void scheduleImmediatePoll(PluginCall call) {
        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(
            MehaniNotificationWorker.PREFS_NAME,
            Context.MODE_PRIVATE
        );
        String token = prefs.getString(MehaniNotificationWorker.KEY_TOKEN, "");
        if (token != null && !token.isEmpty()) {
            Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();

            OneTimeWorkRequest immediate = new OneTimeWorkRequest.Builder(MehaniNotificationWorker.class)
                .setConstraints(constraints)
                .setInitialDelay(20, TimeUnit.SECONDS)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build();

            WorkManager.getInstance(context).enqueueUniqueWork(
                IMMEDIATE_WORK_NAME,
                ExistingWorkPolicy.REPLACE,
                immediate
            );
        }

        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void clearSession(PluginCall call) {
        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(
            MehaniNotificationWorker.PREFS_NAME,
            Context.MODE_PRIVATE
        );
        prefs.edit()
            .remove(MehaniNotificationWorker.KEY_TOKEN)
            .remove(MehaniNotificationWorker.KEY_USER_ID)
            .remove(MehaniNotificationWorker.KEY_ROLE)
            .apply();

        WorkManager.getInstance(context).cancelUniqueWork(PERIODIC_WORK_NAME);
        WorkManager.getInstance(context).cancelUniqueWork(IMMEDIATE_WORK_NAME);

        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void consumePendingTab(PluginCall call) {
        String targetTab = null;
        if (getActivity() != null && getActivity().getIntent() != null) {
            Intent intent = getActivity().getIntent();
            if (intent.hasExtra("targetTab")) {
                targetTab = intent.getStringExtra("targetTab");
                intent.removeExtra("targetTab");
            }
        }
        JSObject ret = new JSObject();
        ret.put("targetTab", targetTab);
        call.resolve(ret);
    }

    public static void enqueuePeriodicPolling(Context context, ExistingPeriodicWorkPolicy policy) {
        Constraints constraints = new Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build();

        PeriodicWorkRequest periodic = new PeriodicWorkRequest.Builder(
            MehaniNotificationWorker.class,
            15,
            TimeUnit.MINUTES
        )
            .setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
            .build();

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            PERIODIC_WORK_NAME,
            policy,
            periodic
        );
    }

    private void mergeNotifiedKeys(
        SharedPreferences prefs,
        SharedPreferences.Editor editor,
        String userId,
        JSArray newKeys
    ) {
        String key = MehaniNotificationWorker.KEY_NOTIFIED_PREFIX + userId;
        String rawExisting = prefs.getString(key, "[]");
        JSONArray merged;
        Set<String> seen = new HashSet<>();
        try {
            merged = new JSONArray(rawExisting);
            for (int i = 0; i < merged.length(); i++) {
                String existing = merged.optString(i, "");
                if (!existing.isEmpty()) seen.add(existing);
            }
        } catch (Exception e) {
            merged = new JSONArray();
        }

        for (int i = 0; i < newKeys.length(); i++) {
            String candidate = newKeys.optString(i, "");
            if (!candidate.isEmpty() && !seen.contains(candidate)) {
                seen.add(candidate);
                merged.put(candidate);
            }
        }

        if (merged.length() > MAX_STORED_KEYS) {
            JSONArray trimmed = new JSONArray();
            for (int i = merged.length() - MAX_STORED_KEYS; i < merged.length(); i++) {
                trimmed.put(merged.optString(i));
            }
            merged = trimmed;
        }

        editor.putString(key, merged.toString());
    }
}
