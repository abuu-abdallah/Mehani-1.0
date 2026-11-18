package com.mehani.sudan;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.OutOfQuotaPolicy;
import androidx.work.WorkManager;

import java.util.concurrent.TimeUnit;

public class MehaniRestartReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
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

        MehaniRealtimeService.startIfLoggedIn(context);

        try {
            Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();
            OneTimeWorkRequest poll = new OneTimeWorkRequest.Builder(MehaniNotificationWorker.class)
                .setConstraints(constraints)
                .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.SECONDS)
                .build();
            WorkManager.getInstance(context).enqueueUniqueWork(
                "mehani_restart_poll",
                ExistingWorkPolicy.REPLACE,
                poll
            );
        } catch (Throwable ignored) {
        }
    }
}
