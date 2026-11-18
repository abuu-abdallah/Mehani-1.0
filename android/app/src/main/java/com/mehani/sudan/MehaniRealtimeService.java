package com.mehani.sudan;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Build;
import android.os.IBinder;
import android.os.SystemClock;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;
import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.OutOfQuotaPolicy;
import androidx.work.WorkManager;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class MehaniRealtimeService extends Service {

    private static final String CHANNEL_BG_SERVICE = "mehani_bg_service_v1";
    private static final int SERVICE_NOTIF_ID = 9001001;
    private static final int RESTART_ALARM_REQ_CODE = 9001002;
    private static final long POLL_INTERVAL_SECONDS = 15L;

    private ScheduledExecutorService scheduler;

    public static void startIfLoggedIn(Context context) {
        if (context == null) return;
        SharedPreferences prefs = context.getSharedPreferences(
            MehaniNotificationWorker.PREFS_NAME,
            Context.MODE_PRIVATE
        );
        String token = prefs.getString(MehaniNotificationWorker.KEY_TOKEN, "");
        String userId = prefs.getString(MehaniNotificationWorker.KEY_USER_ID, "");
        if (token == null || token.isEmpty() || userId == null || userId.isEmpty()) {
            return;
        }
        try {
            Intent intent = new Intent(context, MehaniRealtimeService.class);
            ContextCompat.startForegroundService(context, intent);
        } catch (Throwable ignored) {
            // Fall back cleanly to WorkManager if OS restricts FGS start in this state
        }
    }

    public static void stopService(Context context) {
        if (context == null) return;
        try {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am != null) {
                Intent restartIntent = new Intent(context, MehaniRestartReceiver.class);
                PendingIntent pi = PendingIntent.getBroadcast(
                    context,
                    RESTART_ALARM_REQ_CODE,
                    restartIntent,
                    PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
                );
                if (pi != null) {
                    am.cancel(pi);
                    pi.cancel();
                }
            }
        } catch (Throwable ignored) {
        }
        try {
            context.stopService(new Intent(context, MehaniRealtimeService.class));
        } catch (Throwable ignored) {
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        MehaniNotificationWorker.ensureNotificationChannels(this);
        ensureServiceChannel(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        SharedPreferences prefs = getSharedPreferences(
            MehaniNotificationWorker.PREFS_NAME,
            Context.MODE_PRIVATE
        );
        String token = prefs.getString(MehaniNotificationWorker.KEY_TOKEN, "");
        String userId = prefs.getString(MehaniNotificationWorker.KEY_USER_ID, "");
        String language = prefs.getString(MehaniNotificationWorker.KEY_LANGUAGE, "ar");

        if (token == null || token.isEmpty() || userId == null || userId.isEmpty()) {
            stopSelf();
            return START_NOT_STICKY;
        }

        try {
            Notification notification = buildServiceNotification(language);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                ServiceCompat.startForeground(
                    this,
                    SERVICE_NOTIF_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING
                );
            } else {
                startForeground(SERVICE_NOTIF_ID, notification);
            }
        } catch (Throwable e) {
            stopSelf();
            return START_NOT_STICKY;
        }

        startPollingLoop();
        return START_STICKY;
    }

    private synchronized void startPollingLoop() {
        if (scheduler != null && !scheduler.isShutdown()) {
            return;
        }
        scheduler = Executors.newSingleThreadScheduledExecutor();
        scheduler.scheduleWithFixedDelay(() -> {
            try {
                SharedPreferences prefs = getSharedPreferences(
                    MehaniNotificationWorker.PREFS_NAME,
                    Context.MODE_PRIVATE
                );
                String token = prefs.getString(MehaniNotificationWorker.KEY_TOKEN, "");
                if (token == null || token.isEmpty()) {
                    stopSelf();
                    return;
                }
                if (!isNetworkAvailable(getApplicationContext())) {
                    return;
                }
                MehaniNotificationWorker.pollFeedNow(getApplicationContext());
            } catch (Throwable ignored) {
            }
        }, 1L, POLL_INTERVAL_SECONDS, TimeUnit.SECONDS);
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        SharedPreferences prefs = getSharedPreferences(
            MehaniNotificationWorker.PREFS_NAME,
            Context.MODE_PRIVATE
        );
        String token = prefs.getString(MehaniNotificationWorker.KEY_TOKEN, "");
        String userId = prefs.getString(MehaniNotificationWorker.KEY_USER_ID, "");
        if (token == null || token.isEmpty() || userId == null || userId.isEmpty()) {
            return;
        }

        // Schedule immediate restart via AlarmManager when user swipes the app away from Recents
        try {
            Intent restartIntent = new Intent(getApplicationContext(), MehaniRestartReceiver.class);
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                getApplicationContext(),
                RESTART_ALARM_REQ_CODE,
                restartIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            AlarmManager alarmManager = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (alarmManager != null) {
                long triggerAt = SystemClock.elapsedRealtime() + 3000L;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setAndAllowWhileIdle(
                        AlarmManager.ELAPSED_REALTIME_WAKEUP,
                        triggerAt,
                        pendingIntent
                    );
                } else {
                    alarmManager.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pendingIntent);
                }
            }
        } catch (Throwable ignored) {
        }

        // Also enqueue expedited WorkManager job as backup on restrictive OEMs (MIUI/HyperOS)
        try {
            Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();
            OneTimeWorkRequest backup = new OneTimeWorkRequest.Builder(MehaniNotificationWorker.class)
                .setConstraints(constraints)
                .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.SECONDS)
                .build();
            WorkManager.getInstance(getApplicationContext()).enqueueUniqueWork(
                "mehani_task_removed_poll",
                ExistingWorkPolicy.REPLACE,
                backup
            );
        } catch (Throwable ignored) {
        }
    }

    @Override
    public void onDestroy() {
        if (scheduler != null) {
            scheduler.shutdownNow();
            scheduler = null;
        }
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private Notification buildServiceNotification(String language) {
        boolean isAr = !"en".equalsIgnoreCase(language);

        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
            this,
            SERVICE_NOTIF_ID,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String title = isAr ? "مهني — الإشعارات الفورية نشطة" : "Mehani — Real-time alerts active";
        String text = isAr
            ? "متصل لاستقبال تنبيهات الطلبات والعمولات فوراً"
            : "Connected for instant booking & commission alerts";

        return new NotificationCompat.Builder(this, CHANNEL_BG_SERVICE)
            .setSmallIcon(R.drawable.ic_stat_mehani)
            .setContentTitle(title)
            .setContentText(text)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setOngoing(true)
            .setSilent(true)
            .setShowWhen(false)
            .setContentIntent(contentIntent)
            .build();
    }

    private static void ensureServiceChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        if (manager.getNotificationChannel(CHANNEL_BG_SERVICE) != null) return;

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_BG_SERVICE,
            "خدمة الإشعارات الفورية | Real-Time Alerts Service",
            NotificationManager.IMPORTANCE_MIN
        );
        channel.setDescription("تتيح استلام إشعارات الطلبات الفورية حتى عند إغلاق التطبيق");
        channel.setShowBadge(false);
        channel.setSound(null, null);
        channel.enableVibration(false);
        manager.createNotificationChannel(channel);
    }

    private static boolean isNetworkAvailable(Context context) {
        try {
            ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Network network = cm.getActiveNetwork();
                if (network == null) return false;
                NetworkCapabilities caps = cm.getNetworkCapabilities(network);
                return caps != null && (
                    caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
                    || caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)
                    || caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
                );
            }
            return cm.getActiveNetworkInfo() != null && cm.getActiveNetworkInfo().isConnected();
        } catch (Throwable ignored) {
            return true;
        }
    }
}
