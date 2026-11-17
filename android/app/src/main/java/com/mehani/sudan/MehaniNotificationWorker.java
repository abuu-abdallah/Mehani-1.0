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
import java.text.NumberFormat;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
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
        Context context = getApplicationContext();
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        String token = prefs.getString(KEY_TOKEN, "");
        String userId = prefs.getString(KEY_USER_ID, "");
        String apiUrl = prefs.getString(KEY_API_URL, "https://mehani.gt.tc/api.php");
        String language = prefs.getString(KEY_LANGUAGE, "ar");

        if (token == null || token.isEmpty() || userId == null || userId.isEmpty()) {
            return Result.success();
        }

        boolean isAr = !"en".equalsIgnoreCase(language);

        HttpURLConnection conn = null;
        try {
            String feedUrl = apiUrl + (apiUrl.contains("?") ? "&" : "?") + "action=notifications_feed";
            conn = (HttpURLConnection) new URL(feedUrl).openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(20000);
            conn.setRequestProperty("Accept", "application/json");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("X-Auth-Token", token);

            String cookie = prefs.getString(KEY_COOKIE, "");
            if (cookie != null && !cookie.isEmpty()) {
                conn.setRequestProperty("Cookie", cookie);
            }
            String userAgent = prefs.getString(KEY_USER_AGENT, "");
            if (userAgent != null && !userAgent.isEmpty()) {
                conn.setRequestProperty("User-Agent", userAgent);
            }

            int statusCode = conn.getResponseCode();
            if (statusCode == 401 || statusCode == 403) {
                return Result.success();
            }

            InputStream stream = statusCode >= 200 && statusCode < 400
                ? conn.getInputStream()
                : conn.getErrorStream();
            if (stream == null) {
                return Result.retry();
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
                return Result.retry();
            }

            JSONObject feed = new JSONObject(rawBody);
            if (!feed.optBoolean("ok", false)) {
                return Result.success();
            }

            JSONObject user = feed.optJSONObject("user");
            if (user == null || !userId.equals(user.optString("id"))) {
                return Result.success();
            }

            ensureNotificationChannels(context);
            processFeed(context, prefs, userId, isAr, user, feed);
            return Result.success();
        } catch (Exception e) {
            return Result.retry();
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    private void processFeed(
        Context context,
        SharedPreferences prefs,
        String userId,
        boolean isAr,
        JSONObject user,
        JSONObject feed
    ) {
        String role = user.optString("role", prefs.getString(KEY_ROLE, "customer"));
        String nidStatus = user.optString("nidStatus", "");
        String nidRejectionReason = user.optString("nidRejectionReason", "");
        String nidSubmittedAt = user.optString("nidSubmittedAt", "");
        boolean isActive = user.optBoolean("isActive", true);
        String deactivatedReason = user.optString("deactivatedReason", "");
        long dueCommission = user.optLong("pendingCommissionDueSDG", 0);

        JSONArray requestsArr = feed.optJSONArray("requests");
        if (requestsArr == null) requestsArr = new JSONArray();
        JSONArray depositsArr = feed.optJSONArray("deposits");
        if (depositsArr == null) depositsArr = new JSONArray();
        JSONArray suggestionsArr = feed.optJSONArray("suggestions");
        if (suggestionsArr == null) suggestionsArr = new JSONArray();
        JSONArray pendingNidArr = feed.optJSONArray("pendingNidProviders");
        if (pendingNidArr == null) pendingNidArr = new JSONArray();

        String snapKey = KEY_SNAPSHOT_PREFIX + userId;
        String prevRaw = prefs.getString(snapKey, null);
        JSONObject prev = null;
        if (prevRaw != null && prevRaw.startsWith("{")) {
            try {
                prev = new JSONObject(prevRaw);
            } catch (Exception ignored) {
                prev = null;
            }
        }

        // 1. Urgent unresolved notices for providers (always check even before snapshot initialized)
        if ("provider".equals(role)) {
            if ("reupload_requested".equals(nidStatus)) {
                String sig = nidSubmittedAt + ":" + nidRejectionReason;
                String reason = nidRejectionReason.isEmpty()
                    ? (isAr ? "الصورة غير واضحة" : "Unclear photo")
                    : nidRejectionReason;
                notifyOnce(
                    context,
                    prefs,
                    userId,
                    "nid_reupload:" + sig,
                    CHANNEL_URGENT,
                    isAr ? "مطلوب إعادة رفع الرقم الوطني أو جواز السفر" : "ID / Passport Re-upload Required",
                    isAr
                        ? "إدارة مهني: يرجى إعادة رفع صورة الرقم الوطني أو جواز السفر (" + reason + ")."
                        : "Mehani Admin: Please re-upload your National ID or Passport (" + reason + ").",
                    "profile"
                );
            }

            boolean hasPendingDepositVerification = false;
            for (int i = 0; i < depositsArr.length(); i++) {
                JSONObject d = depositsArr.optJSONObject(i);
                if (d == null) continue;
                String depProviderId = d.optString("providerId", "");
                String depStatus = d.optString("status", "");
                if (!userId.equals(depProviderId)) continue;

                if ("pending_verification".equals(depStatus)) {
                    hasPendingDepositVerification = true;
                } else if ("rejected".equals(depStatus)) {
                    String depId = d.optString("id", "");
                    String reviewedAt = d.optString("reviewedAt", "");
                    String depReason = d.optString("rejectionReason", "");
                    long amt = d.optLong("amountSDG", 0);
                    String sig = depId + ":" + reviewedAt + ":" + depReason;
                    String reasonText = depReason.isEmpty()
                        ? (isAr ? "يرجى إرفاق إشعار صحيح" : "Please re-upload valid receipt")
                        : depReason;
                    notifyOnce(
                        context,
                        prefs,
                        userId,
                        "deposit_reupload:" + sig,
                        CHANNEL_URGENT,
                        isAr ? "مطلوب إعادة رفع إشعار العمولة (بنكك)" : "Deposit Proof Re-upload Needed",
                        isAr
                            ? "تم رفض إشعار توريد " + formatNumber(amt) + " ج.س (" + reasonText + ")."
                            : "Your " + formatNumber(amt) + " SDG deposit proof was rejected (" + reasonText + ").",
                        "commission"
                    );
                }
            }

            Calendar cal = Calendar.getInstance();
            if (cal.get(Calendar.DAY_OF_WEEK) == Calendar.THURSDAY && dueCommission > 0 && !hasPendingDepositVerification) {
                String todayKey = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
                notifyOnce(
                    context,
                    prefs,
                    userId,
                    "thursday_due:" + todayKey + ":" + dueCommission,
                    CHANNEL_BOOKING,
                    isAr ? "تذكير توريد عمولات وغرامات الخميس" : "Thursday Commission & Penalty Deposit Due",
                    isAr
                        ? "اليوم الخميس: لديك مبلغ مستحق بقيمة " + formatNumber(dueCommission) + " ج.س (العمولة + الغرامات المحصلة). يرجى التحويل عبر بنكك ورفع الإشعار."
                        : "It's Thursday: You have " + formatNumber(dueCommission) + " SDG due (8% commission + collected penalties). Please deposit via Bankak and upload proof.",
                    "commission"
                );
            }
        }

        // Build next snapshot objects
        JSONObject nextRequestsMap = new JSONObject();
        JSONObject nextDepositsMap = new JSONObject();
        JSONObject nextSuggestionsMap = new JSONObject();
        JSONObject nextAdminNids = new JSONObject();
        JSONObject nextAdminDeps = new JSONObject();
        JSONObject nextAdminSugs = new JSONObject();

        try {
            for (int i = 0; i < requestsArr.length(); i++) {
                JSONObject r = requestsArr.optJSONObject(i);
                if (r == null) continue;
                String id = r.optString("id", "");
                if (id.isEmpty()) continue;
                JSONObject snap = new JSONObject();
                snap.put("status", r.optString("status", ""));
                if (!r.isNull("clientRating")) {
                    snap.put("clientRating", r.optInt("clientRating"));
                }
                nextRequestsMap.put(id, snap);
            }

            for (int i = 0; i < depositsArr.length(); i++) {
                JSONObject d = depositsArr.optJSONObject(i);
                if (d == null) continue;
                String id = d.optString("id", "");
                if (id.isEmpty()) continue;
                JSONObject snap = new JSONObject();
                snap.put("status", d.optString("status", ""));
                nextDepositsMap.put(id, snap);

                if ("admin".equals(role) && "pending_verification".equals(d.optString("status", ""))) {
                    nextAdminDeps.put(id, d.optString("submittedAt", ""));
                }
            }

            for (int i = 0; i < suggestionsArr.length(); i++) {
                JSONObject s = suggestionsArr.optJSONObject(i);
                if (s == null) continue;
                String id = s.optString("id", "");
                if (id.isEmpty()) continue;
                JSONObject snap = new JSONObject();
                snap.put("status", s.optString("status", ""));
                nextSuggestionsMap.put(id, snap);

                if ("admin".equals(role) && "pending".equals(s.optString("status", ""))) {
                    nextAdminSugs.put(id, s.optString("createdAt", ""));
                }
            }

            if ("admin".equals(role)) {
                for (int i = 0; i < pendingNidArr.length(); i++) {
                    JSONObject p = pendingNidArr.optJSONObject(i);
                    if (p == null) continue;
                    String pid = p.optString("id", "");
                    if (pid.isEmpty()) continue;
                    String stamp = p.optString("nidSubmittedAt", "");
                    if (stamp.isEmpty()) stamp = p.optString("createdAt", "");
                    nextAdminNids.put(pid, stamp);
                }
            }
        } catch (Exception ignored) {
        }

        // 2. Compare transitions if prior snapshot exists
        if (prev != null && prev.optBoolean("initialized", false)) {
            JSONObject prevReqMap = prev.optJSONObject("requests");
            if (prevReqMap == null) prevReqMap = new JSONObject();
            JSONObject prevDepMap = prev.optJSONObject("deposits");
            if (prevDepMap == null) prevDepMap = new JSONObject();
            JSONObject prevSugMap = prev.optJSONObject("suggestions");
            if (prevSugMap == null) prevSugMap = new JSONObject();

            if ("provider".equals(role)) {
                String prevNidStatus = prev.optString("nidStatus", "");
                boolean prevActive = prev.optBoolean("isActive", true);

                if ((!"approved".equals(prevNidStatus) && "approved".equals(nidStatus))
                    || (!prevActive && isActive)) {
                    String stamp = nidSubmittedAt.isEmpty() ? String.valueOf(System.currentTimeMillis()) : nidSubmittedAt;
                    notifyOnce(
                        context,
                        prefs,
                        userId,
                        "account_approved:" + stamp,
                        CHANNEL_SUCCESS,
                        isAr ? "تم اعتماد هويتك وتفعيل حسابك!" : "ID Approved & Account Activated!",
                        isAr
                            ? "تهانينا! أصبح ملفك المهني وخدماتك ظاهرين الآن للعملاء لاستقبال الطلبات."
                            : "Congratulations! Your worker profile and services are now live for clients.",
                        "profile"
                    );
                } else if (prevActive && !isActive && !"reupload_requested".equals(nidStatus)) {
                    String reasonBody = !deactivatedReason.isEmpty()
                        ? deactivatedReason
                        : (isAr ? "تم تعليق ظهور ملفك المهني مؤقتاً. راجع إدارة المنصة." : "Your account was deactivated by platform admin.");
                    notifyOnce(
                        context,
                        prefs,
                        userId,
                        "account_deactivated:" + deactivatedReason,
                        CHANNEL_URGENT,
                        isAr ? "تنبيه: تم إيقاف تفعيل الحساب" : "Account Temporarily Deactivated",
                        reasonBody,
                        "profile"
                    );
                }

                for (int i = 0; i < depositsArr.length(); i++) {
                    JSONObject d = depositsArr.optJSONObject(i);
                    if (d == null) continue;
                    String depId = d.optString("id", "");
                    if (!userId.equals(d.optString("providerId", ""))) continue;
                    String status = d.optString("status", "");
                    JSONObject prevDep = prevDepMap.optJSONObject(depId);
                    if ("verified".equals(status) && prevDep != null && !"verified".equals(prevDep.optString("status", ""))) {
                        long amt = d.optLong("amountSDG", 0);
                        String ref = d.optString("bankakReferenceNumber", "");
                        String reviewedAt = d.optString("reviewedAt", "");
                        notifyOnce(
                            context,
                            prefs,
                            userId,
                            "deposit_verified:" + depId + ":" + reviewedAt,
                            CHANNEL_SUCCESS,
                            isAr ? "تم اعتماد توريد العمولة بنجاح" : "Commission Deposit Verified",
                            isAr
                                ? "تم التحقق واعتماد إشعار التوريد بمبلغ " + formatNumber(amt) + " ج.س (مرجع: " + ref + ")."
                                : "Your " + formatNumber(amt) + " SDG deposit (Ref: " + ref + ") has been verified.",
                            "commission"
                        );
                    }
                }

                for (int i = 0; i < suggestionsArr.length(); i++) {
                    JSONObject s = suggestionsArr.optJSONObject(i);
                    if (s == null) continue;
                    String sugId = s.optString("id", "");
                    if (!userId.equals(s.optString("providerId", ""))) continue;
                    String status = s.optString("status", "");
                    JSONObject prevSug = prevSugMap.optJSONObject(sugId);
                    if (prevSug != null && !status.equals(prevSug.optString("status", ""))) {
                        String nameAr = s.optString("nameAr", "");
                        String nameEn = s.optString("nameEn", nameAr);
                        String rejReason = s.optString("rejectionReason", "");
                        if ("approved".equals(status)) {
                            notifyOnce(
                                context,
                                prefs,
                                userId,
                                "suggestion_approved:" + sugId,
                                CHANNEL_SUCCESS,
                                isAr ? "تمت الموافقة على خدمتك المقترحة" : "Suggested Service Approved",
                                isAr
                                    ? "تمت إضافة \"" + nameAr + "\" إلى تصنيفات منصة مهني المعتمدة."
                                    : "\"" + nameEn + "\" has been added to Mehani service categories.",
                                "profile"
                            );
                        } else if ("rejected".equals(status)) {
                            notifyOnce(
                                context,
                                prefs,
                                userId,
                                "suggestion_rejected:" + sugId,
                                CHANNEL_URGENT,
                                isAr ? "تحديث حول مقترح الخدمة" : "Service Suggestion Update",
                                isAr
                                    ? "لم يتم اعتماد مقترح \"" + nameAr + "\"" + (rejReason.isEmpty() ? "." : ": " + rejReason)
                                    : "Suggestion \"" + nameEn + "\" was not approved" + (rejReason.isEmpty() ? "." : ": " + rejReason),
                                "profile"
                            );
                        }
                    }
                }
            }

            // Service Requests (Worker + Hirer)
            for (int i = 0; i < requestsArr.length(); i++) {
                JSONObject r = requestsArr.optJSONObject(i);
                if (r == null) continue;
                String reqId = r.optString("id", "");
                String status = r.optString("status", "");
                String clientId = r.optString("clientId", "");
                String providerId = r.optString("providerId", "");
                String clientName = r.optString("clientName", "");
                String providerName = r.optString("providerName", "");
                long agreedPrice = r.optLong("agreedPriceSDG", 0);
                String cancelReason = r.optString("cancelReason", "");

                boolean isWorker = userId.equals(providerId);
                boolean isHirer = userId.equals(clientId);
                JSONObject prevReq = prevReqMap.optJSONObject(reqId);
                String prevStatus = prevReq != null ? prevReq.optString("status", "") : "";

                if (isWorker && prevReq == null && "pending".equals(status)) {
                    notifyOnce(
                        context,
                        prefs,
                        userId,
                        "req_new:" + reqId,
                        CHANNEL_BOOKING,
                        isAr ? "طلب خدمة جديد!" : "New Service Request!",
                        isAr
                            ? "طلب جديد من " + clientName + " بقيمة " + formatNumber(agreedPrice) + " ج.س."
                            : "New request from " + clientName + " for " + formatNumber(agreedPrice) + " SDG.",
                        "bookings"
                    );
                }

                if (prevReq != null && !status.equals(prevStatus)) {
                    if (isHirer && "accepted".equals(status)) {
                        notifyOnce(
                            context,
                            prefs,
                            userId,
                            "req_accepted:" + reqId,
                            CHANNEL_BOOKING,
                            isAr ? "تم قبول طلب خدمتك" : "Service Request Accepted",
                            isAr
                                ? "قبل المهني " + providerName + " طلبك وجاري التنسيق للموعد."
                                : providerName + " accepted your service request and will coordinate timing.",
                            "bookings"
                        );
                    } else if (isHirer && "in_progress".equals(status)) {
                        notifyOnce(
                            context,
                            prefs,
                            userId,
                            "req_started:" + reqId,
                            CHANNEL_BOOKING,
                            isAr ? "بدأ المهني تنفيذ الخدمة" : "Service Work Started",
                            isAr
                                ? "بدأ " + providerName + " العمل على طلبك رقم #" + reqId + "."
                                : providerName + " has started working on request #" + reqId + ".",
                            "bookings"
                        );
                    } else if (isHirer && "completed".equals(status)) {
                        notifyOnce(
                            context,
                            prefs,
                            userId,
                            "req_completed:" + reqId,
                            CHANNEL_BOOKING,
                            isAr ? "تم إنهاء الخدمة — يرجى التقييم" : "Service Ended — Please Rate",
                            isAr
                                ? "قام المهني " + providerName + " بإنهاء الخدمة وتأكيد السداد (" + formatNumber(agreedPrice) + " ج.س). اضغط لتقييم الخدمة."
                                : providerName + " marked your service (" + formatNumber(agreedPrice) + " SDG) as completed. Tap to rate your worker.",
                            "bookings"
                        );
                    } else if ((isHirer || isWorker) && "cancelled".equals(status)) {
                        String reasonSuffix = cancelReason.isEmpty() ? "" : " (" + cancelReason + ")";
                        notifyOnce(
                            context,
                            prefs,
                            userId,
                            "req_cancelled:" + reqId + ":" + userId,
                            CHANNEL_URGENT,
                            isAr ? "تم إلغاء طلب الخدمة" : "Service Request Cancelled",
                            isWorker
                                ? (isAr
                                    ? "تم إلغاء الطلب #" + reqId + " من العميل " + clientName + reasonSuffix + "."
                                    : "Request #" + reqId + " with client " + clientName + " was cancelled" + reasonSuffix + ".")
                                : (isAr
                                    ? "تم إلغاء طلبك #" + reqId + " مع المهني " + providerName + reasonSuffix + "."
                                    : "Your request #" + reqId + " with " + providerName + " was cancelled" + reasonSuffix + "."),
                            "bookings"
                        );
                    }
                } else if (prevReq == null && "cancelled".equals(status) && (isHirer || isWorker)) {
                    String reasonSuffix = cancelReason.isEmpty() ? "" : " (" + cancelReason + ")";
                    notifyOnce(
                        context,
                        prefs,
                        userId,
                        "req_cancelled:" + reqId + ":" + userId,
                        CHANNEL_URGENT,
                        isAr ? "تم إلغاء طلب الخدمة" : "Service Request Cancelled",
                        isWorker
                            ? (isAr
                                ? "تم إلغاء الطلب #" + reqId + " من العميل " + clientName + reasonSuffix + "."
                                : "Request #" + reqId + " with client " + clientName + " was cancelled" + reasonSuffix + ".")
                            : (isAr
                                ? "تم إلغاء طلبك #" + reqId + " مع المهني " + providerName + reasonSuffix + "."
                                : "Your request #" + reqId + " with " + providerName + " was cancelled" + reasonSuffix + "."),
                        "bookings"
                    );
                } else if (prevReq == null && "completed".equals(status) && isHirer) {
                    notifyOnce(
                        context,
                        prefs,
                        userId,
                        "req_completed:" + reqId,
                        CHANNEL_BOOKING,
                        isAr ? "تم إنهاء الخدمة — يرجى التقييم" : "Service Ended — Please Rate",
                        isAr
                            ? "قام المهني " + providerName + " بإنهاء الخدمة وتأكيد السداد (" + formatNumber(agreedPrice) + " ج.س). اضغط لتقييم الخدمة."
                            : providerName + " marked your service (" + formatNumber(agreedPrice) + " SDG) as completed. Tap to rate your worker.",
                        "bookings"
                    );
                }

                if (isWorker && !r.isNull("clientRating") && (prevReq == null || prevReq.isNull("clientRating"))) {
                    int rating = r.optInt("clientRating", 5);
                    String comment = r.optString("clientReviewComment", "");
                    String commentSuffix = comment.isEmpty() ? "." : ": \"" + comment + "\"";
                    notifyOnce(
                        context,
                        prefs,
                        userId,
                        "req_rated:" + reqId,
                        CHANNEL_SUCCESS,
                        isAr ? "تقييم جديد " + rating + "/5 نجوم ⭐" : "New " + rating + "/5 Star Rating ⭐",
                        isAr
                            ? "قيّم العميل " + clientName + " خدمتك بـ " + rating + " نجوم" + commentSuffix
                            : clientName + " rated your work " + rating + " stars" + commentSuffix,
                        "bookings"
                    );
                }
            }

            // Admin notifications
            if ("admin".equals(role)) {
                JSONObject prevAdminNids = prev.optJSONObject("adminPendingNids");
                if (prevAdminNids == null) prevAdminNids = new JSONObject();
                for (int i = 0; i < pendingNidArr.length(); i++) {
                    JSONObject p = pendingNidArr.optJSONObject(i);
                    if (p == null) continue;
                    String pid = p.optString("id", "");
                    String pname = p.optString("name", pid);
                    String stamp = nextAdminNids.optString(pid, "");
                    if (!stamp.equals(prevAdminNids.optString(pid, ""))) {
                        notifyOnce(
                            context,
                            prefs,
                            userId,
                            "admin_nid:" + pid + ":" + stamp,
                            CHANNEL_BOOKING,
                            isAr ? "طلب مراجعة هوية مهني جديد" : "Provider ID / Passport Pending Review",
                            isAr
                                ? "المهني " + pname + " أرفق الرقم الوطني أو جواز السفر بانتظار المراجعة والتفعيل."
                                : "Provider " + pname + " submitted an ID/Passport for review.",
                            "admin"
                        );
                    }
                }

                JSONObject prevAdminDeps = prev.optJSONObject("adminPendingDeposits");
                if (prevAdminDeps == null) prevAdminDeps = new JSONObject();
                for (int i = 0; i < depositsArr.length(); i++) {
                    JSONObject d = depositsArr.optJSONObject(i);
                    if (d == null) continue;
                    String depId = d.optString("id", "");
                    if (!"pending_verification".equals(d.optString("status", ""))) continue;
                    if (!prevAdminDeps.has(depId)) {
                        String stamp = d.optString("submittedAt", "");
                        String pname = d.optString("providerName", isAr ? "مهني" : "A provider");
                        long amt = d.optLong("amountSDG", 0);
                        notifyOnce(
                            context,
                            prefs,
                            userId,
                            "admin_dep:" + depId + ":" + stamp,
                            CHANNEL_BOOKING,
                            isAr ? "إشعار توريد عمولة جديد (بنكك)" : "New Commission Deposit Proof",
                            isAr
                                ? "رفع " + pname + " إشعاراً بمبلغ " + formatNumber(amt) + " ج.س للمراجعة."
                                : pname + " uploaded a " + formatNumber(amt) + " SDG deposit proof.",
                            "admin"
                        );
                    }
                }

                JSONObject prevAdminSugs = prev.optJSONObject("adminPendingSuggestions");
                if (prevAdminSugs == null) prevAdminSugs = new JSONObject();
                for (int i = 0; i < suggestionsArr.length(); i++) {
                    JSONObject s = suggestionsArr.optJSONObject(i);
                    if (s == null) continue;
                    String sugId = s.optString("id", "");
                    if (!"pending".equals(s.optString("status", ""))) continue;
                    if (!prevAdminSugs.has(sugId)) {
                        String pname = s.optString("providerName", isAr ? "مهني" : "Provider");
                        String sName = isAr ? s.optString("nameAr", "") : s.optString("nameEn", s.optString("nameAr", ""));
                        notifyOnce(
                            context,
                            prefs,
                            userId,
                            "admin_sug:" + sugId,
                            CHANNEL_BOOKING,
                            isAr ? "مقترح خدمة جديدة من مهني" : "New Service Category Suggestion",
                            isAr
                                ? "اقترح " + pname + " خدمة جديدة: " + sName + "."
                                : pname + " suggested a new service: " + sName + ".",
                            "admin"
                        );
                    }
                }
            }
        }

        // Persist updated snapshot
        try {
            JSONObject updated = new JSONObject();
            updated.put("initialized", true);
            updated.put("nidStatus", nidStatus);
            updated.put("isActive", isActive);
            updated.put("requests", nextRequestsMap);
            updated.put("deposits", nextDepositsMap);
            updated.put("suggestions", nextSuggestionsMap);
            if ("admin".equals(role)) {
                updated.put("adminPendingNids", nextAdminNids);
                updated.put("adminPendingDeposits", nextAdminDeps);
                updated.put("adminPendingSuggestions", nextAdminSugs);
            }
            prefs.edit().putString(snapKey, updated.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    private void notifyOnce(
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

    private static String formatNumber(long value) {
        return NumberFormat.getIntegerInstance(Locale.US).format(value);
    }
}
