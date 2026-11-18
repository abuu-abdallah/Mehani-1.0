package com.mehani.sudan;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.OutOfQuotaPolicy;
import androidx.work.WorkManager;

import java.util.concurrent.TimeUnit;

public class MehaniBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action)
            && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            return;
        }

        SharedPreferences prefs = context.getSharedPreferences(
            MehaniNotificationWorker.PREFS_NAME,
            Context.MODE_PRIVATE
        );
        String token = prefs.getString(MehaniNotificationWorker.KEY_TOKEN, "");
        String userId = prefs.getString(MehaniNotificationWorker.KEY_USER_ID, "");

        if (token != null && !token.isEmpty() && userId != null && !userId.isEmpty()) {
            MehaniNotificationWorker.ensureNotificationChannels(context);
            MehaniBackgroundSyncPlugin.enqueuePeriodicPolling(
                context,
                ExistingPeriodicWorkPolicy.KEEP
            );
            try {
                Constraints constraints = new Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build();
                OneTimeWorkRequest bootPoll = new OneTimeWorkRequest.Builder(MehaniNotificationWorker.class)
                    .setConstraints(constraints)
                    .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                    .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.SECONDS)
                    .build();
                WorkManager.getInstance(context).enqueueUniqueWork(
                    "mehani_boot_poll",
                    ExistingWorkPolicy.REPLACE,
                    bootPoll
                );
            } catch (Throwable ignored) {
            }
        }
    }
}
