import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp, type NavigationTab } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { safeStorage } from '../utils/safeStorage';
import {
  dispatchAppNotification,
  getRealtimeCutoffMs,
  requestNativeNotificationPermission,
  setRealtimeCutoffMs,
  syncBackgroundNotificationSnapshot,
  syncBackgroundRealtimeCutoff,
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
  const { currentUser, isGuest, isRemoteApi, latestBootstrap, allUsers } = useAuth();
  const {
    requests,
    deposits,
    serviceSuggestions,
    notifications,
    appendLocalNotification,
  } = useApp();
  const { language } = useLanguage();

  useEffect(() => {
    if (!currentUser || isGuest) return;
    void requestNativeNotificationPermission();
  }, [currentUser?.id, isGuest]);

  // Remote DB-backed Real-Time Notification Dispatch (only notifications created AFTER login cutoff)
  useEffect(() => {
    if (!currentUser || isGuest || !isRemoteApi) return;

    const userId = currentUser.id;
    const isAr = language === 'ar';

    let cutoffMs = getRealtimeCutoffMs(userId);
    if (!cutoffMs) {
      // First load with an already persisted session: set baseline silently so old alerts stay in the inbox without popping up
      const baseline = latestBootstrap?.serverNowMs || Date.now();
      setRealtimeCutoffMs(userId, baseline);
      syncBackgroundRealtimeCutoff(userId, baseline);
      return;
    }

    const freshRealtime = notifications
      .filter((n) => !n.isRead && n.createdAtMs > cutoffMs)
      .sort((a, b) => a.createdAtMs - b.createdAtMs);

    if (freshRealtime.length === 0) return;

    let maxSeenMs = cutoffMs;
    for (const n of freshRealtime) {
      if (n.createdAtMs > maxSeenMs) {
        maxSeenMs = n.createdAtMs;
      }
      void dispatchAppNotification({
        userId,
        eventKey: n.eventKey,
        category: n.category,
        title: isAr ? n.titleAr : n.titleEn,
        body: isAr ? n.bodyAr : n.bodyEn,
        targetTab: (n.targetTab || 'home') as NavigationTab,
      });
    }

    if (maxSeenMs > cutoffMs) {
      setRealtimeCutoffMs(userId, maxSeenMs);
      syncBackgroundRealtimeCutoff(userId, maxSeenMs);
    }
  }, [currentUser?.id, isGuest, isRemoteApi, notifications, latestBootstrap?.serverNowMs, language]);

  // Snapshot sync & Local Preview Fallback (only triggers transitions when !isRemoteApi)
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

    // In local fallback mode (without PHP/MySQL), emit real-time transition notifications from snapshot diffs
    if (!isRemoteApi && prev && prev.initialized) {
      const emitLocal = (params: {
        eventKey: string;
        category: 'urgent' | 'booking' | 'success';
        titleAr: string;
        titleEn: string;
        bodyAr: string;
        bodyEn: string;
        targetTab: NavigationTab;
      }) => {
        const nowMs = Date.now();
        appendLocalNotification({
          id: `local-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
          userId,
          eventKey: params.eventKey,
          category: params.category,
          titleAr: params.titleAr,
          titleEn: params.titleEn,
          bodyAr: params.bodyAr,
          bodyEn: params.bodyEn,
          targetTab: params.targetTab,
          isRead: false,
          createdAtMs: nowMs,
          createdAt: new Date(nowMs).toLocaleString('ar-SD'),
          readAt: null,
        });
        void dispatchAppNotification({
          userId,
          eventKey: params.eventKey,
          category: params.category,
          title: isAr ? params.titleAr : params.titleEn,
          body: isAr ? params.bodyAr : params.bodyEn,
          targetTab: params.targetTab,
        });
      };

      if (currentUser.role === 'provider') {
        if (
          prev.nidStatus !== 'reupload_requested' &&
          currentUser.nidStatus === 'reupload_requested'
        ) {
          const reason = currentUser.nidRejectionReason || '';
          emitLocal({
            eventKey: `nid_reupload:${currentUser.nidSubmittedAt || ''}:${reason}`,
            category: 'urgent',
            titleAr: 'مطلوب إعادة رفع الرقم الوطني أو جواز السفر',
            titleEn: 'ID / Passport Re-upload Required',
            bodyAr: `إدارة مهني: يرجى إعادة رفع صورة الرقم الوطني أو جواز السفر (${reason || 'الصورة غير واضحة'}).`,
            bodyEn: `Mehani Admin: Please re-upload your National ID or Passport (${reason || 'Unclear photo'}).`,
            targetTab: 'profile',
          });
        }

        if (
          (prev.nidStatus !== 'approved' && currentUser.nidStatus === 'approved') ||
          (prev.isActive === false && currentUser.isActive === true)
        ) {
          emitLocal({
            eventKey: `account_approved:${currentUser.nidSubmittedAt || Date.now()}`,
            category: 'success',
            titleAr: 'تم اعتماد هويتك وتفعيل حسابك!',
            titleEn: 'ID Approved & Account Activated!',
            bodyAr: 'تهانينا! أصبح ملفك المهني وخدماتك ظاهرين الآن للعملاء لاستقبال الطلبات.',
            bodyEn: 'Congratulations! Your worker profile and services are now live for clients.',
            targetTab: 'profile',
          });
        } else if (
          prev.isActive !== false &&
          currentUser.isActive === false &&
          currentUser.nidStatus !== 'reupload_requested'
        ) {
          emitLocal({
            eventKey: `account_deactivated:${currentUser.deactivatedReason || ''}:${Date.now()}`,
            category: 'urgent',
            titleAr: 'تنبيه: تم إيقاف تفعيل الحساب',
            titleEn: 'Account Temporarily Deactivated',
            bodyAr: currentUser.deactivatedReason || 'تم تعليق ظهور ملفك المهني مؤقتاً. راجع إدارة المنصة.',
            bodyEn: currentUser.deactivatedReason || 'Your account was deactivated by platform admin.',
            targetTab: 'profile',
          });
        }

        for (const d of relevantDeposits) {
          const prevDep = prev.deposits[d.id];
          if (d.providerId === userId && prevDep && prevDep.status !== d.status) {
            if (d.status === 'verified') {
              emitLocal({
                eventKey: `deposit_verified:${d.id}:${d.reviewedAt || ''}`,
                category: 'success',
                titleAr: 'تم اعتماد توريد العمولة بنجاح',
                titleEn: 'Commission Deposit Verified',
                bodyAr: `تم التحقق واعتماد إشعار التوريد بمبلغ ${d.amountSDG.toLocaleString()} ج.س (مرجع: ${d.bankakReferenceNumber}).`,
                bodyEn: `Your ${d.amountSDG.toLocaleString()} SDG deposit (Ref: ${d.bankakReferenceNumber}) has been verified.`,
                targetTab: 'commission',
              });
            } else if (d.status === 'rejected') {
              emitLocal({
                eventKey: `deposit_reupload:${d.id}:${d.reviewedAt || ''}:${d.rejectionReason || ''}`,
                category: 'urgent',
                titleAr: 'مطلوب إعادة رفع إشعار العمولة (بنكك)',
                titleEn: 'Deposit Proof Re-upload Needed',
                bodyAr: `تم رفض إشعار توريد ${d.amountSDG.toLocaleString()} ج.س (${d.rejectionReason || 'يرجى إرفاق إشعار صحيح'}).`,
                bodyEn: `Your ${d.amountSDG.toLocaleString()} SDG deposit proof was rejected (${d.rejectionReason || 'Please re-upload valid receipt'}).`,
                targetTab: 'commission',
              });
            }
          }
        }
      }

      for (const r of relevantRequests) {
        const prevReq = prev.requests[r.id];
        const isWorker = r.providerId === userId;
        const isHirer = r.clientId === userId;

        if (isWorker && !prevReq && r.status === 'pending') {
          emitLocal({
            eventKey: `req_new:${r.id}`,
            category: 'booking',
            titleAr: 'طلب خدمة جديد!',
            titleEn: 'New Service Request!',
            bodyAr: `طلب جديد من ${r.clientName} (${r.city} - ${r.neighborhood}) بقيمة ${r.agreedPriceSDG.toLocaleString()} ج.س.`,
            bodyEn: `New request from ${r.clientName} (${r.city} - ${r.neighborhood}) for ${r.agreedPriceSDG.toLocaleString()} SDG.`,
            targetTab: 'bookings',
          });
        }

        if (prevReq && prevReq.status !== r.status) {
          if (isHirer && r.status === 'accepted') {
            emitLocal({
              eventKey: `req_accepted:${r.id}`,
              category: 'booking',
              titleAr: 'تم قبول طلب خدمتك',
              titleEn: 'Service Request Accepted',
              bodyAr: `قبل المهني ${r.providerName} طلبك وجاري التنسيق للموعد.`,
              bodyEn: `${r.providerName} accepted your service request and will coordinate timing.`,
              targetTab: 'bookings',
            });
          } else if (isHirer && r.status === 'in_progress') {
            emitLocal({
              eventKey: `req_started:${r.id}`,
              category: 'booking',
              titleAr: 'بدأ المهني تنفيذ الخدمة',
              titleEn: 'Service Work Started',
              bodyAr: `بدأ ${r.providerName} العمل على طلبك رقم #${r.id}.`,
              bodyEn: `${r.providerName} has started working on request #${r.id}.`,
              targetTab: 'bookings',
            });
          } else if (isHirer && r.status === 'completed') {
            emitLocal({
              eventKey: `req_completed:${r.id}`,
              category: 'booking',
              titleAr: 'تم إنهاء الخدمة — يرجى التقييم',
              titleEn: 'Service Ended — Please Rate',
              bodyAr: `قام المهني ${r.providerName} بإنهاء الخدمة وتأكيد السداد (${r.agreedPriceSDG.toLocaleString()} ج.س). اضغط لتقييم الخدمة.`,
              bodyEn: `${r.providerName} marked your service (${r.agreedPriceSDG.toLocaleString()} SDG) as completed. Tap to rate your worker.`,
              targetTab: 'bookings',
            });
          } else if ((isHirer || isWorker) && r.status === 'cancelled') {
            const reasonText = r.cancelReason ? ` (${r.cancelReason})` : '';
            emitLocal({
              eventKey: `req_cancelled:${r.id}:${userId}`,
              category: 'urgent',
              titleAr: 'تم إلغاء طلب الخدمة',
              titleEn: 'Service Request Cancelled',
              bodyAr: isWorker
                ? `تم إلغاء الطلب #${r.id} من العميل ${r.clientName}${reasonText}.`
                : `تم إلغاء طلبك #${r.id} مع المهني ${r.providerName}${reasonText}.`,
              bodyEn: isWorker
                ? `Request #${r.id} with client ${r.clientName} was cancelled${reasonText}.`
                : `Your request #${r.id} with ${r.providerName} was cancelled${reasonText}.`,
              targetTab: 'bookings',
            });
          }
        }

        if (isWorker && typeof r.clientRating === 'number' && (!prevReq || typeof prevReq.clientRating !== 'number')) {
          emitLocal({
            eventKey: `req_rated:${r.id}`,
            category: 'success',
            titleAr: `تقييم جديد ${r.clientRating}/5 نجوم ⭐`,
            titleEn: `New ${r.clientRating}/5 Star Rating ⭐`,
            bodyAr: `قيّم العميل ${r.clientName} خدمتك بـ ${r.clientRating} نجوم${r.clientReviewComment ? `: "${r.clientReviewComment}"` : '.'}`,
            bodyEn: `${r.clientName} rated your work ${r.clientRating} stars${r.clientReviewComment ? `: "${r.clientReviewComment}"` : '.'}`,
            targetTab: 'bookings',
          });
        }
      }
    }

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
    isRemoteApi,
    allUsers,
    requests,
    deposits,
    serviceSuggestions,
    language,
    appendLocalNotification,
  ]);
};
