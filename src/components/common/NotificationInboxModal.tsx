import React, { useState, useMemo } from 'react';
import {
  Bell,
  X,
  CheckCheck,
  AlertTriangle,
  CheckCircle2,
  Briefcase,
  Clock,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useApp, type NavigationTab } from '../../context/AppContext';
import type { AppNotificationItem } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationInboxModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { t, language } = useLanguage();
  const {
    notifications,
    unreadNotificationsCount,
    markNotificationRead,
    markAllNotificationsRead,
    setActiveTab,
    setSelectedProviderId,
  } = useApp();

  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all');
  const isAr = language === 'ar';

  const displayedNotifications = useMemo(() => {
    if (filterMode === 'unread') {
      return notifications.filter((n) => !n.isRead);
    }
    return notifications;
  }, [notifications, filterMode]);

  if (!isOpen) return null;

  const handleNotificationClick = async (item: AppNotificationItem) => {
    if (!item.isRead) {
      await markNotificationRead(item.id);
    }
    onClose();
    if (item.targetTab) {
      setSelectedProviderId(null);
      setActiveTab(item.targetTab as NavigationTab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const renderCategoryIcon = (category: AppNotificationItem['category'], isRead: boolean) => {
    if (category === 'urgent') {
      return (
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isRead ? 'bg-rose-50 text-rose-500' : 'bg-rose-600 text-white shadow-xs'
          }`}
        >
          <AlertTriangle className="w-5 h-5" />
        </div>
      );
    }
    if (category === 'success') {
      return (
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isRead ? 'bg-emerald-50 text-emerald-500' : 'bg-emerald-600 text-white shadow-xs'
          }`}
        >
          <CheckCircle2 className="w-5 h-5" />
        </div>
      );
    }
    return (
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          isRead ? 'bg-teal-50 text-teal-600' : 'bg-teal-700 text-white shadow-xs'
        }`}
      >
        <Briefcase className="w-5 h-5" />
      </div>
    );
  };

  const getCategoryLabel = (category: AppNotificationItem['category']) => {
    if (category === 'urgent') return isAr ? 'تنبيه هام' : 'Urgent';
    if (category === 'success') return isAr ? 'اعتماد / نجاح' : 'Approved';
    return isAr ? 'تحديث طلب' : 'Update';
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('notificationsInbox')}
        className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh]"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white leading-tight">
                {t('notificationsInbox')}
              </h2>
              <p className="text-[11px] text-slate-300 mt-0.5 tabular-nums">
                {unreadNotificationsCount > 0
                  ? isAr
                    ? `${unreadNotificationsCount} إشعارات غير مقروءة`
                    : `${unreadNotificationsCount} unread notifications`
                  : isAr
                  ? 'جميع الإشعارات مقروءة'
                  : 'All caught up'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={isAr ? 'إغلاق صندوق الإشعارات' : 'Close notifications'}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Tabs & Mark All Read Bar */}
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="inline-flex bg-slate-200/70 p-1 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`min-h-[38px] px-3.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                filterMode === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('allNotifications')} ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('unread')}
              className={`min-h-[38px] px-3.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                filterMode === 'unread'
                  ? 'bg-white text-teal-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('unread')} ({unreadNotificationsCount})
            </button>
          </div>

          {unreadNotificationsCount > 0 && (
            <button
              type="button"
              onClick={() => void markAllNotificationsRead()}
              className="min-h-[38px] px-3 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <CheckCheck className="w-4 h-4 shrink-0" />
              <span>{t('markAllRead')}</span>
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 bg-slate-50/40">
          {displayedNotifications.length === 0 ? (
            <div className="py-14 px-4 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Bell className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-slate-700">
                {filterMode === 'unread' ? t('noUnreadNotifications') : t('noNotifications')}
              </p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                {isAr
                  ? 'ستظهر هنا جميع تنبيهات الطلبات، الاعتمادات، والرسائل الإدارية فور حدوثها.'
                  : 'All service updates, approvals, and administrative notices will appear here.'}
              </p>
            </div>
          ) : (
            displayedNotifications.map((item) => {
              const title = isAr ? item.titleAr : item.titleEn;
              const body = isAr ? item.bodyAr : item.bodyEn;
              const isUnread = !item.isRead;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void handleNotificationClick(item)}
                  className={`w-full text-start p-3.5 rounded-2xl border transition-all flex items-start gap-3 cursor-pointer ${
                    isUnread
                      ? 'bg-teal-50/70 border-teal-200 hover:bg-teal-50 shadow-2xs'
                      : 'bg-white border-slate-200/80 hover:bg-slate-50'
                  }`}
                >
                  {renderCategoryIcon(item.category, item.isRead)}

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-xs sm:text-sm leading-snug ${
                          isUnread
                            ? 'font-extrabold text-slate-950'
                            : 'font-medium text-slate-700'
                        }`}
                      >
                        {title}
                      </p>
                      {isUnread && (
                        <span
                          className="w-2.5 h-2.5 rounded-full bg-teal-600 shrink-0 mt-1"
                          aria-label={t('newNotification')}
                        />
                      )}
                    </div>

                    <p
                      className={`text-xs leading-relaxed ${
                        isUnread
                          ? 'font-bold text-slate-800'
                          : 'font-normal text-slate-500'
                      }`}
                    >
                      {body}
                    </p>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-0.5 tabular-nums">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span>{item.createdAt}</span>
                      <span>·</span>
                      <span className={isUnread ? 'text-teal-700 font-bold' : ''}>
                        {getCategoryLabel(item.category)}
                      </span>
                      {isUnread && (
                        <>
                          <span>·</span>
                          <span className="text-teal-700 font-extrabold">
                            {t('newNotification')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
