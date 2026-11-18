package com.mehani.sudan;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.webkit.CookieManager;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;

public class MehaniNotificationWorker extends Worker {

    public static final String PREFS_NAME = "mehani_bg_prefs";
    public static final String KEY_TOKEN = "auth_token";
    public static final String KEY_USER_ID = "user_id";
    public static final String KEY_ROLE = "user_role";
    public static final String KEY_LANGUAGE = "user_language";
    public static final String KEY_API_URL = "api_url";
    public static final String KEY_COOKIE = "web_cookie";
    public static final String KEY_USER_AGENT = "web_user_agent";
    public static final String KEY_SNAPSHOT_PREFIX = "bg_snapshot_";
    public static final String KEY_NOTIFIED_PREFIX = "notified_keys_";
    public static final String KEY_LAST_REALTIME_MS_PREFIX = "last_realtime_ms_";

    private static final String CHANNEL_URGENT = "mehani_urgent_v1";
    private static final String CHANNEL_BOOKING = "mehani_booking_v1";
    private static final String CHANNEL_SUCCESS = "mehani_success_v1";
    private static final int MAX_NOTIFIED_KEYS = 200;

    public MehaniNotificationWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        boolean ok = pollFeedNow(getApplicationContext());
        return ok ? Result.success() : Result.retry();
    }

    public static synchronized boolean pollFeedNow(Context context) {
        if (context == null) return true;
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        String token = prefs.getString(KEY_TOKEN, "");
        String userId = prefs.getString(KEY_USER_ID, "");
        String apiUrl = prefs.getString(KEY_API_URL, "https://mehani.gt.tc/api.php");
        String language = prefs.getString(KEY_LANGUAGE, "ar");

        if (token == null || token.isEmpty() || userId == null || userId.isEmpty()) {
            return true;
        }

        boolean isAr = !"en".equalsIgnoreCase(language);
        String cutoffPrefKey = KEY_LAST_REALTIME_MS_PREFIX + userId;
        long lastRealtimeMs = prefs.getLong(cutoffPrefKey, 0L);

        HttpURLConnection conn = null;
        try {
            String feedUrl = apiUrl + (apiUrl.contains("?") ? "&" : "?")
                + "action=notifications_feed&since_ms=" + lastRealtimeMs;
            conn = (HttpURLConnection) new URL(feedUrl).openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(12000);
            conn.setReadTimeout(15000);
            conn.setUseCaches(false);
            conn.setRequestProperty("Accept", "application/json");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("X-Auth-Token", token);

            String cookie = prefs.getString(KEY_COOKIE, "");
            try {
                String liveCookie = CookieManager.getInstance().getCookie(apiUrl);
                if (liveCookie != null && !liveCookie.isEmpty()) {
                    cookie = liveCookie;
                    prefs.edit().putString(KEY_COOKIE, liveCookie).apply();
                }
            } catch (Throwable ignored) {
            }
            if (cookie != null && !cookie.isEmpty()) {
                conn.setRequestProperty("Cookie", cookie);
            }

            String userAgent = prefs.getString(KEY_USER_AGENT, "");
            if (userAgent != null && !userAgent.isEmpty()) {
                conn.setRequestProperty("User-Agent", userAgent);
            }

            int statusCode = conn.getResponseCode();
            if (statusCode == 401 || statusCode == 403) {
                return true;
            }

            InputStream stream = statusCode >= 200 && statusCode < 400
                ? conn.getInputStream()
                : conn.getErrorStream();
            if (stream == null) {
                return false;
            }

            StringBuilder sb = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
            }

            String rawBody = sb.toString().trim();
            if (statusCode < 200 || statusCode >= 300 || !rawBody.startsWith("{")) {
                return false;
            }

            JSONObject feed = new JSONObject(rawBody);
            if (!feed.optBoolean("ok", false)) {
                return true;
            }

            JSONObject user = feed.optJSONObject("user");
            if (user == null || !userId.equals(user.optString("id"))) {
                return true;
            }

            ensureNotificationChannels(context);

            // If no realtime baseline cutoff was stored yet, record server time silently so old notifications stay in the inbox without popping up
            if (lastRealtimeMs <= 0L) {
                long baselineMs = feed.optLong("serverNowMs", System.currentTimeMillis());
                if (baselineMs > 0L) {
                    prefs.edit().putLong(cutoffPrefKey, baselineMs).apply();
                }
                return true;
            }

            JSONArray notifArr = feed.optJSONArray("notifications");
            if (notifArr != null) {
                long maxSeenMs = lastRealtimeMs;
                for (int i = 0; i < notifArr.length(); i++) {
                    JSONObject n = notifArr.optJSONObject(i);
                    if (n == null) continue;

                    long createdAtMs = n.optLong("createdAtMs", 0L);
                    if (createdAtMs > maxSeenMs) {
                        maxSeenMs = createdAtMs;
                    }

                    boolean isRead = n.optBoolean("isRead", false);
                    if (isRead || createdAtMs <= lastRealtimeMs) {
                        continue;
                    }

                    String eventKey = n.optString("eventKey", "");
                    if (eventKey.isEmpty()) {
                        eventKey = "notif:" + n.optString("id", String.valueOf(createdAtMs));
                    }

                    String category = n.optString("category", "booking");
                    String channelId = CHANNEL_BOOKING;
                    if ("urgent".equals(category)) {
                        channelId = CHANNEL_URGENT;
                    } else if ("success".equals(category)) {
                        channelId = CHANNEL_SUCCESS;
                    }

                    String title = isAr
                        ? n.optString("titleAr", n.optString("titleEn", "مهني"))
                        : n.optString("titleEn", n.optString("titleAr", "Mehani"));
                    String body = isAr
                        ? n.optString("bodyAr", n.optString("bodyEn", ""))
                        : n.optString("bodyEn", n.optString("bodyAr", ""));
                    String targetTab = n.optString("targetTab", "home");

                    if (!title.isEmpty() || !body.isEmpty()) {
                        notifyOnce(context, prefs, userId, eventKey, channelId, title, body, targetTab);
                    }
                }

                if (maxSeenMs > lastRealtimeMs) {
                    prefs.edit().putLong(cutoffPrefKey, maxSeenMs).apply();
                }
            }

            return true;
        } catch (Exception e) {
            return false;
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    private static void notifyOnce(
        Context context,
        SharedPreferences prefs,
        String userId,
        String eventKey,
        String channelId,
        String title,
        String body,
        String targetTab
    ) {
        String keysPrefKey = KEY_NOTIFIED_PREFIX + userId;
        String rawKeys = prefs.getString(keysPrefKey, "[]");
        JSONArray arr;
        Set<String> keySet = new HashSet<>();
        try {
            arr = new JSONArray(rawKeys);
            for (int i = 0; i < arr.length(); i++) {
                String k = arr.optString(i, "");
                if (!k.isEmpty()) keySet.add(k);
            }
        } catch (Exception e) {
            arr = new JSONArray();
        }

        if (keySet.contains(eventKey)) {
            return;
        }

        arr.put(eventKey);
        if (arr.length() > MAX_NOTIFIED_KEYS) {
            JSONArray trimmed = new JSONArray();
            for (int i = arr.length() - MAX_NOTIFIED_KEYS; i < arr.length(); i++) {
                trimmed.put(arr.optString(i));
            }
            arr = trimmed;
        }
        prefs.edit().putString(keysPrefKey, arr.toString()).apply();

        if (Build.VERSION.SDK_INT >= 33
            && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra("targetTab", targetTab);

        int notifId = hashToInt32(userId + ":" + eventKey);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            notifId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        int accentColor = CHANNEL_URGENT.equals(channelId)
            ? Color.parseColor("#dc2626")
            : CHANNEL_SUCCESS.equals(channelId)
                ? Color.parseColor("#059669")
                : Color.parseColor("#0f766e");

        Uri soundUri = getSoundUri(context, channelId);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.drawable.ic_stat_mehani)
            .setColor(accentColor)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(CHANNEL_URGENT.equals(channelId) || CHANNEL_BOOKING.equals(channelId)
                ? NotificationCompat.PRIORITY_HIGH
                : NotificationCompat.PRIORITY_DEFAULT)
            .setSound(soundUri)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent);

        NotificationManagerCompat.from(context).notify(notifId, builder.build());
    }

    public static void ensureNotificationChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;

        AudioAttributes attrs = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();

        createChannelIfMissing(
            manager,
            CHANNEL_URGENT,
            "تنبيهات عاجلة وإعادة الرفع | Urgent Alerts",
            "إشعارات إعادة رفع الهوية أو إشعار بنكك وإلغاء الطلبات",
            NotificationManager.IMPORTANCE_HIGH,
            Color.parseColor("#ef4444"),
            getSoundUri(context, CHANNEL_URGENT),
            attrs
        );
        createChannelIfMissing(
            manager,
            CHANNEL_BOOKING,
            "حالة الطلبات والخدمات | Service Updates",
            "طلبات الخدمات الجديدة، بدء التنفيذ، وإنهاء الخدمة",
            NotificationManager.IMPORTANCE_HIGH,
            Color.parseColor("#0f766e"),
            getSoundUri(context, CHANNEL_BOOKING),
            attrs
        );
        createChannelIfMissing(
            manager,
            CHANNEL_SUCCESS,
            "الاعتمادات والتقييمات | Approvals & Ratings",
            "اعتماد الهوية، تأكيد توريد العمولة، وتقييمات العملاء",
            NotificationManager.IMPORTANCE_DEFAULT,
            Color.parseColor("#10b981"),
            getSoundUri(context, CHANNEL_SUCCESS),
            attrs
        );
    }

    private static void createChannelIfMissing(
        NotificationManager manager,
        String id,
        String name,
        String description,
        int importance,
        int lightColor,
        Uri soundUri,
        AudioAttributes attrs
    ) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        if (manager.getNotificationChannel(id) != null) return;
        NotificationChannel ch = new NotificationChannel(id, name, importance);
        ch.setDescription(description);
        ch.enableLights(true);
        ch.setLightColor(lightColor);
        ch.enableVibration(true);
        ch.setSound(soundUri, attrs);
        manager.createNotificationChannel(ch);
    }

    private static Uri getSoundUri(Context context, String channelId) {
        int resId = R.raw.mehani_chime;
        if (CHANNEL_URGENT.equals(channelId)) {
            resId = R.raw.mehani_alert;
        } else if (CHANNEL_SUCCESS.equals(channelId)) {
            resId = R.raw.mehani_success;
        }
        return Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + context.getPackageName() + "/" + resId);
    }

    private static int hashToInt32(String input) {
        int hash = 0x811c9dc5;
        for (int i = 0; i < input.length(); i++) {
            hash ^= input.charAt(i);
            hash *= 0x01000193;
        }
        int positive = Math.abs(hash % 2147483000);
        return positive > 0 ? positive : 1;
    }
}
