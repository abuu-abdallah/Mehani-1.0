import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { safeStorage } from '../utils/safeStorage';
import {
  dispatchAppNotification,
  requestNativeNotificationPermission,
  syncBackgroundNotificationSnapshot,
} from '../services/nativeNotifications';
import type { ServiceStatus } from '../types';

interface RequestSnap {
  status: ServiceStatus;
  clientRating?: number;
  cancelledBy?: string;
  cancelReason?: string;
}

interface DepositSnap {
  status: 'verified' | 'pending_verification' | 'rejected';
  rejectionReason?: string | null;
  reviewedAt?: string | null;
}

interface SuggestionSnap {
  status: 'pending' | 'approved' | 'rejected';
}

interface UserSnapshot {
  initialized: boolean;
  nidStatus?: string;
  nidRejectionReason?: string;
  nidSubmittedAt?: string;
  isActive?: boolean;
  pendingCommissionDueSDG?: number;
  requests: Record<string, RequestSnap>;
  deposits: Record<string, DepositSnap>;
  suggestions: Record<string, SuggestionSnap>;
  adminPendingNids?: Record<string, string>;
  adminPendingDeposits?: Record<string, string>;
  adminPendingSuggestions?: Record<string, string>;
}

const SNAPSHOT_PREFIX = 'mehani_notif_snapshot_';

export const useAppNotifications = () => {
  const { currentUser, isGuest, allUsers } = useAuth();
  const { requests, deposits, serviceSuggestions } = useApp();
  const { language } = useLanguage();

  useEffect(() => {
    if (!currentUser || isGuest) return;
    void requestNativeNotificationPermission();
  }, [currentUser?.id, isGuest]);

  useEffect(() => {
    if (!currentUser || isGuest) return;

    const userId = currentUser.id;
    const isAr = language === 'ar';
    const snapKey = `${SNAPSHOT_PREFIX}${userId}`;
    const prev = safeStorage.getJSON<UserSnapshot | null>(snapKey, null);

    const relevantRequests = requests.filter(
      (r) => r.clientId === userId || r.providerId === userId || currentUser.role === 'admin'
    );
    const relevantDeposits = deposits.filter(
      (d) => d.providerId === userId || currentUser.role === 'admin'
    );
    const relevantSuggestions = serviceSuggestions.filter(
      (s) => s.providerId === userId || currentUser.role === 'admin'
    );

    const nextRequests: Record<string, RequestSnap> = {};
    for (const r of relevantRequests) {
      nextRequests[r.id] = {
        status: r.status,
        clientRating: r.clientRating,
        cancelledBy: r.cancelledBy,
        cancelReason: r.cancelReason,
      };
    }

    const nextDeposits: Record<string, DepositSnap> = {};
    for (const d of relevantDeposits) {
      nextDeposits[d.id] = {
        status: d.status,
        rejectionReason: d.rejectionReason,
        reviewedAt: d.reviewedAt,
      };
    }

    const nextSuggestions: Record<string, SuggestionSnap> = {};
    for (const s of relevantSuggestions) {
      nextSuggestions[s.id] = { status: s.status };
    }

    const nextAdminPendingNids: Record<string, string> = {};
    const nextAdminPendingDeposits: Record<string, string> = {};
    const nextAdminPendingSuggestions: Record<string, string> = {};

    if (currentUser.role === 'admin') {
      for (const u of allUsers) {
        if (u.role === 'provider' && u.nidStatus === 'pending') {
          nextAdminPendingNids[u.id] = `${u.nidSubmittedAt || u.createdAt}`;
        }
      }
      for (const d of deposits) {
        if (d.status === 'pending_verification') {
          nextAdminPendingDeposits[d.id] = d.submittedAt;
        }
      }
      for (const s of serviceSuggestions) {
        if (s.status === 'pending') {
          nextAdminPendingSuggestions[s.id] = s.createdAt;
        }
      }
    }

    // 1. Always surface active unresolved re-upload notices (even on first run of APK)
    if (currentUser.role === 'provider') {
      if (currentUser.nidStatus === 'reupload_requested') {
        const nidSignature = `${currentUser.nidSubmittedAt || ''}:${currentUser.nidRejectionReason || ''}`;
        void dispatchAppNotification({
          userId,
          eventKey: `nid_reupload:${nidSignature}`,
          category: 'urgent',
          title: isAr ? 'مطلوب إعادة رفع الرقم الوطني أو جواز السفر' : 'ID / Passport Re-upload Required',
          body: isAr
            ? `إدارة مهني: يرجى إعادة رفع صورة الرقم الوطني أو جواز السفر (${currentUser.nidRejectionReason || 'الصورة غير واضحة'}).`
            : `Mehani Admin: Please re-upload your National ID or Passport (${currentUser.nidRejectionReason || 'Unclear photo'}).`,
          targetTab: 'profile',
        });
      }

      for (const d of relevantDeposits) {
        if (d.providerId === userId && d.status === 'rejected') {
          const depSignature = `${d.id}:${d.reviewedAt || ''}:${d.rejectionReason || ''}`;
          void dispatchAppNotification({
            userId,
            eventKey: `deposit_reupload:${depSignature}`,
            category: 'urgent',
            title: isAr ? 'مطلوب إعادة رفع إشعار العمولة (بنكك)' : 'Deposit Proof Re-upload Needed',
            body: isAr
              ? `تم رفض إشعار توريد ${d.amountSDG.toLocaleString()} ج.س (${d.rejectionReason || 'يرجى إرفاق إشعار صحيح'}).`
              : `Your ${d.amountSDG.toLocaleString()} SDG deposit proof was rejected (${d.rejectionReason || 'Please re-upload valid receipt'}).`,
            targetTab: 'commission',
          });
        }
      }

      // Thursday commission weekly reminder if today is Thursday and provider has pending due without a pending receipt
      const isThursday = new Date().getDay() === 4;
      const dueAmount = currentUser.pendingCommissionDueSDG || 0;
      const hasPendingVerification = relevantDeposits.some(
        (d) => d.providerId === userId && d.status === 'pending_verification'
      );
      if (isThursday && dueAmount > 0 && !hasPendingVerification) {
        const todayKey = new Date().toISOString().split('T')[0];
        void dispatchAppNotification({
          userId,
          eventKey: `thursday_due:${todayKey}:${dueAmount}`,
          category: 'booking',
          title: isAr ? 'تذكير توريد عمولات وغرامات الخميس' : 'Thursday Commission & Penalty Deposit Due',
          body: isAr
            ? `اليوم الخميس: لديك مبلغ مستحق بقيمة ${dueAmount.toLocaleString()} ج.س (العمولة + الغرامات المحصلة). يرجى التحويل عبر بنكك ورفع الإشعار.`
            : `It's Thursday: You have ${dueAmount.toLocaleString()} SDG due (8% commission + collected penalties). Please deposit via Bankak and upload proof.`,
          targetTab: 'commission',
        });
      }
    }

    // 2. Compare transitions when we already have a prior snapshot
    if (prev && prev.initialized) {
      // Provider NID Approval / Activation / Deactivation
      if (currentUser.role === 'provider') {
        if (
          (prev.nidStatus !== 'approved' && currentUser.nidStatus === 'approved') ||
          (prev.isActive === false && currentUser.isActive === true)
        ) {
          void dispatchAppNotification({
            userId,
            eventKey: `account_approved:${currentUser.nidSubmittedAt || Date.now()}`,
            category: 'success',
            title: isAr ? 'تم اعتماد هويتك وتفعيل حسابك!' : 'ID Approved & Account Activated!',
            body: isAr
              ? 'تهانينا! أصبح ملفك المهني وخدماتك ظاهرين الآن للعملاء لاستقبال الطلبات.'
              : 'Congratulations! Your worker profile and services are now live for clients.',
            targetTab: 'profile',
          });
        } else if (
          prev.isActive !== false &&
          currentUser.isActive === false &&
          currentUser.nidStatus !== 'reupload_requested'
        ) {
          void dispatchAppNotification({
            userId,
            eventKey: `account_deactivated:${currentUser.deactivatedReason || ''}:${Date.now()}`,
            category: 'urgent',
            title: isAr ? 'تنبيه: تم إيقاف تفعيل الحساب' : 'Account Temporarily Deactivated',
            body: isAr
              ? currentUser.deactivatedReason || 'تم تعليق ظهور ملفك المهني مؤقتاً. راجع إدارة المنصة.'
              : currentUser.deactivatedReason || 'Your account was deactivated by platform admin.',
            targetTab: 'profile',
          });
        }

        // Deposit verified
        for (const d of relevantDeposits) {
          const prevDep = prev.deposits[d.id];
          if (d.providerId === userId && d.status === 'verified' && prevDep && prevDep.status !== 'verified') {
            void dispatchAppNotification({
              userId,
              eventKey: `deposit_verified:${d.id}:${d.reviewedAt || ''}`,
              category: 'success',
              title: isAr ? 'تم اعتماد توريد العمولة بنجاح' : 'Commission Deposit Verified',
              body: isAr
                ? `تم التحقق واعتماد إشعار التوريد بمبلغ ${d.amountSDG.toLocaleString()} ج.س (مرجع: ${d.bankakReferenceNumber}).`
                : `Your ${d.amountSDG.toLocaleString()} SDG deposit (Ref: ${d.bankakReferenceNumber}) has been verified.`,
              targetTab: 'commission',
            });
          }
        }

        // Service suggestions approved / rejected
        for (const s of relevantSuggestions) {
          const prevSug = prev.suggestions[s.id];
          if (s.providerId === userId && prevSug && prevSug.status !== s.status) {
            if (s.status === 'approved') {
              void dispatchAppNotification({
                userId,
                eventKey: `suggestion_approved:${s.id}`,
                category: 'success',
                title: isAr ? 'تمت الموافقة على خدمتك المقترحة' : 'Suggested Service Approved',
                body: isAr
                  ? `تمت إضافة "${s.nameAr}" إلى تصنيفات منصة مهني المعتمدة.`
                  : `"${s.nameEn || s.nameAr}" has been added to Mehani service categories.`,
                targetTab: 'profile',
              });
            } else if (s.status === 'rejected') {
              void dispatchAppNotification({
                userId,
                eventKey: `suggestion_rejected:${s.id}`,
                category: 'urgent',
                title: isAr ? 'تحديث حول مقترح الخدمة' : 'Service Suggestion Update',
                body: isAr
                  ? `لم يتم اعتماد مقترح "${s.nameAr}"${s.rejectionReason ? `: ${s.rejectionReason}` : '.'}`
                  : `Suggestion "${s.nameEn || s.nameAr}" was not approved${s.rejectionReason ? `: ${s.rejectionReason}` : '.'}`,
                targetTab: 'profile',
              });
            }
          }
        }
      }

      // Service Request Lifecycle Events (Hirer + Worker)
      for (const r of relevantRequests) {
        const prevReq = prev.requests[r.id];
        const isWorker = r.providerId === userId;
        const isHirer = r.clientId === userId;

        // A. New request received by Worker
        if (isWorker && !prevReq && r.status === 'pending') {
          void dispatchAppNotification({
            userId,
            eventKey: `req_new:${r.id}`,
            category: 'booking',
            title: isAr ? 'طلب خدمة جديد!' : 'New Service Request!',
            body: isAr
              ? `طلب جديد من ${r.clientName} (${r.city} - ${r.neighborhood}) بقيمة ${r.agreedPriceSDG.toLocaleString()} ج.س.`
              : `New request from ${r.clientName} (${r.city} - ${r.neighborhood}) for ${r.agreedPriceSDG.toLocaleString()} SDG.`,
            targetTab: 'bookings',
          });
        }

        // B. Status changes
        if (prevReq && prevReq.status !== r.status) {
          if (isHirer && r.status === 'accepted') {
            void dispatchAppNotification({
              userId,
              eventKey: `req_accepted:${r.id}`,
              category: 'booking',
              title: isAr ? 'تم قبول طلب خدمتك' : 'Service Request Accepted',
              body: isAr
                ? `قبل المهني ${r.providerName} طلبك وجاري التنسيق للموعد.`
                : `${r.providerName} accepted your service request and will coordinate timing.`,
              targetTab: 'bookings',
            });
          } else if (isHirer && r.status === 'in_progress') {
            void dispatchAppNotification({
              userId,
              eventKey: `req_started:${r.id}`,
              category: 'booking',
              title: isAr ? 'بدأ المهني تنفيذ الخدمة' : 'Service Work Started',
              body: isAr
                ? `بدأ ${r.providerName} العمل على طلبك رقم #${r.id}.`
                : `${r.providerName} has started working on request #${r.id}.`,
              targetTab: 'bookings',
            });
          } else if (isHirer && r.status === 'completed') {
            // Worker clicked End service -> Hirer MUST receive notification!
            void dispatchAppNotification({
              userId,
              eventKey: `req_completed:${r.id}`,
              category: 'booking',
              title: isAr ? 'تم إنهاء الخدمة — يرجى التقييم' : 'Service Ended — Please Rate',
              body: isAr
                ? `قام المهني ${r.providerName} بإنهاء الخدمة وتأكيد السداد (${r.agreedPriceSDG.toLocaleString()} ج.س). اضغط لتقييم الخدمة.`
                : `${r.providerName} marked your service (${r.agreedPriceSDG.toLocaleString()} SDG) as completed. Tap to rate your worker.`,
              targetTab: 'bookings',
            });
          } else if ((isHirer || isWorker) && r.status === 'cancelled') {
            // Request cancelled -> BOTH Worker and Hirer receive notification!
            const reasonText = r.cancelReason ? ` (${r.cancelReason})` : '';
            void dispatchAppNotification({
              userId,
              eventKey: `req_cancelled:${r.id}:${userId}`,
              category: 'urgent',
              title: isAr ? 'تم إلغاء طلب الخدمة' : 'Service Request Cancelled',
              body: isWorker
                ? isAr
                  ? `تم إلغاء الطلب #${r.id} من العميل ${r.clientName}${reasonText}.`
                  : `Request #${r.id} with client ${r.clientName} was cancelled${reasonText}.`
                : isAr
                ? `تم إلغاء طلبك #${r.id} مع المهني ${r.providerName}${reasonText}.`
                : `Your request #${r.id} with ${r.providerName} was cancelled${reasonText}.`,
              targetTab: 'bookings',
            });
          }
        } else if (!prevReq && r.status === 'cancelled' && (isHirer || isWorker)) {
          // Request arrived already cancelled before client had snapshot of it
          const reasonText = r.cancelReason ? ` (${r.cancelReason})` : '';
          void dispatchAppNotification({
            userId,
            eventKey: `req_cancelled:${r.id}:${userId}`,
            category: 'urgent',
            title: isAr ? 'تم إلغاء طلب الخدمة' : 'Service Request Cancelled',
            body: isWorker
              ? isAr
                ? `تم إلغاء الطلب #${r.id} من العميل ${r.clientName}${reasonText}.`
                : `Request #${r.id} with client ${r.clientName} was cancelled${reasonText}.`
              : isAr
              ? `تم إلغاء طلبك #${r.id} مع المهني ${r.providerName}${reasonText}.`
              : `Your request #${r.id} with ${r.providerName} was cancelled${reasonText}.`,
            targetTab: 'bookings',
          });
        } else if (!prevReq && r.status === 'completed' && isHirer) {
          void dispatchAppNotification({
            userId,
            eventKey: `req_completed:${r.id}`,
            category: 'booking',
            title: isAr ? 'تم إنهاء الخدمة — يرجى التقييم' : 'Service Ended — Please Rate',
            body: isAr
              ? `قام المهني ${r.providerName} بإنهاء الخدمة وتأكيد السداد (${r.agreedPriceSDG.toLocaleString()} ج.س). اضغط لتقييم الخدمة.`
              : `${r.providerName} marked your service (${r.agreedPriceSDG.toLocaleString()} SDG) as completed. Tap to rate your worker.`,
            targetTab: 'bookings',
          });
        }

        // C. Client submitted a new star rating -> Worker notified
        if (isWorker && typeof r.clientRating === 'number' && (!prevReq || typeof prevReq.clientRating !== 'number')) {
          void dispatchAppNotification({
            userId,
            eventKey: `req_rated:${r.id}`,
            category: 'success',
            title: isAr ? `تقييم جديد ${r.clientRating}/5 نجوم ⭐` : `New ${r.clientRating}/5 Star Rating ⭐`,
            body: isAr
              ? `قيّم العميل ${r.clientName} خدمتك بـ ${r.clientRating} نجوم${r.clientReviewComment ? `: "${r.clientReviewComment}"` : '.'}`
              : `${r.clientName} rated your work ${r.clientRating} stars${r.clientReviewComment ? `: "${r.clientReviewComment}"` : '.'}`,
            targetTab: 'bookings',
          });
        }
      }

      // Admin notifications
      if (currentUser.role === 'admin') {
        const prevNids = prev.adminPendingNids || {};
        for (const [provId, stamp] of Object.entries(nextAdminPendingNids)) {
          if (prevNids[provId] !== stamp) {
            const prov = allUsers.find((u) => u.id === provId);
            void dispatchAppNotification({
              userId,
              eventKey: `admin_nid:${provId}:${stamp}`,
              category: 'booking',
              title: isAr ? 'طلب مراجعة هوية مهني جديد' : 'Provider ID / Passport Pending Review',
              body: isAr
                ? `المهني ${prov?.name || provId} أرفق الرقم الوطني أو جواز السفر بانتظار المراجعة والتفعيل.`
                : `Provider ${prov?.name || provId} submitted an ID/Passport for review.`,
              targetTab: 'admin',
            });
          }
        }

        const prevDeps = prev.adminPendingDeposits || {};
        for (const [depId, stamp] of Object.entries(nextAdminPendingDeposits)) {
          if (!prevDeps[depId]) {
            const dep = deposits.find((d) => d.id === depId);
            void dispatchAppNotification({
              userId,
              eventKey: `admin_dep:${depId}:${stamp}`,
              category: 'booking',
              title: isAr ? 'إشعار توريد عمولة جديد (بنكك)' : 'New Commission Deposit Proof',
              body: isAr
                ? `رفع ${dep?.providerName || 'مهني'} إشعاراً بمبلغ ${(dep?.amountSDG || 0).toLocaleString()} ج.س للمراجعة.`
                : `${dep?.providerName || 'A provider'} uploaded a ${(dep?.amountSDG || 0).toLocaleString()} SDG deposit proof.`,
              targetTab: 'admin',
            });
          }
        }

        const prevSugs = prev.adminPendingSuggestions || {};
        for (const [sugId] of Object.entries(nextAdminPendingSuggestions)) {
          if (!prevSugs[sugId]) {
            const sug = serviceSuggestions.find((s) => s.id === sugId);
            void dispatchAppNotification({
              userId,
              eventKey: `admin_sug:${sugId}`,
              category: 'booking',
              title: isAr ? 'مقترح خدمة جديدة من مهني' : 'New Service Category Suggestion',
              body: isAr
                ? `اقترح ${sug?.providerName || 'مهني'} خدمة جديدة: ${sug?.nameAr || ''}.`
                : `${sug?.providerName || 'Provider'} suggested a new service: ${sug?.nameEn || sug?.nameAr || ''}.`,
              targetTab: 'admin',
            });
          }
        }
      }
    }

    // Persist updated snapshot
    const updatedSnapshot: UserSnapshot = {
      initialized: true,
      nidStatus: currentUser.nidStatus,
      nidRejectionReason: currentUser.nidRejectionReason,
      nidSubmittedAt: currentUser.nidSubmittedAt,
      isActive: currentUser.isActive,
      pendingCommissionDueSDG: currentUser.pendingCommissionDueSDG,
      requests: nextRequests,
      deposits: nextDeposits,
      suggestions: nextSuggestions,
      ...(currentUser.role === 'admin'
        ? {
            adminPendingNids: nextAdminPendingNids,
            adminPendingDeposits: nextAdminPendingDeposits,
            adminPendingSuggestions: nextAdminPendingSuggestions,
          }
        : {}),
    };
    safeStorage.setJSON(snapKey, updatedSnapshot);
    syncBackgroundNotificationSnapshot(userId, JSON.stringify(updatedSnapshot));
  }, [
    currentUser,
    isGuest,
    allUsers,
    requests,
    deposits,
    serviceSuggestions,
    language,
  ]);
};
