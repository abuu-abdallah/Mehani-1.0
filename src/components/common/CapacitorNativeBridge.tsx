import React, { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Bell, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { useApp, type NavigationTab } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { getAuthToken } from '../../services/api';
import { safeStorage } from '../../utils/safeStorage';
import { isUserActivelyTypingOrComposing } from '../../utils/imeInputGuard';
import { useAppNotifications } from '../../hooks/useAppNotifications';
import {
  clearBackgroundNotificationSession,
  consumePendingNotificationTab,
  getRealtimeCutoffMs,
  initializeNativeNotifications,
  scheduleBackgroundNotificationPoll,
  subscribeInAppNotificationToast,
  syncBackgroundNotificationSession,
  type AppNotificationPayload,
} from '../../services/nativeNotifications';

export const CapacitorNativeBridge: React.FC = () => {
  const { canGoBack, goBack, setActiveTab, setSelectedProviderId } = useApp();
  const { currentUser, isGuest, refreshFromServer } = useAuth();
  const { language } = useLanguage();
  const { isDark } = useTheme();
  const canGoBackRef = useRef(canGoBack);
  const goBackRef = useRef(goBack);
  const refreshRef = useRef(refreshFromServer);
  const setActiveTabRef = useRef(setActiveTab);
  const setSelectedProviderIdRef = useRef(setSelectedProviderId);

  const [activeToast, setActiveToast] = useState<AppNotificationPayload | null>(null);

  canGoBackRef.current = canGoBack;
  goBackRef.current = goBack;
  refreshRef.current = refreshFromServer;
  setActiveTabRef.current = setActiveTab;
  setSelectedProviderIdRef.current = setSelectedProviderId;

  // Monitor app state transitions and trigger Android Notification Panel & sound alerts
  useAppNotifications();

  // Keep Android status bar color synchronized with theme
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
    StatusBar.setBackgroundColor({ color: isDark ? '#020617' : '#0f172a' }).catch(() => {});
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  }, [isDark]);

  // Keep native Android background service synced with current session, language & realtime cutoff
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;

    const token = getAuthToken();
    if (currentUser && !isGuest && token) {
      const snap = safeStorage.getItem(`mehani_notif_snapshot_${currentUser.id}`) || undefined;
      const cutoff = getRealtimeCutoffMs(currentUser.id);
      syncBackgroundNotificationSession({
        token,
        userId: currentUser.id,
        role: currentUser.role,
        language,
        snapshotJson: snap,
        lastRealtimeMs: cutoff > 0 ? cutoff : Date.now(),
      });
    } else {
      clearBackgroundNotificationSession();
    }
  }, [currentUser?.id, currentUser?.role, isGuest, language]);

  useEffect(() => {
    const unsubscribeToast = subscribeInAppNotificationToast((payload) => {
      setActiveToast(payload);
    });
    return unsubscribeToast;
  }, []);

  useEffect(() => {
    if (!activeToast) return;
    const timer = window.setTimeout(() => {
      setActiveToast(null);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [activeToast]);

  useEffect(() => {
    let cleanupNotifications: (() => void) | undefined;

    const navigateToTab = (tab: NavigationTab) => {
      setSelectedProviderIdRef.current(null);
      setActiveTabRef.current(tab);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    void initializeNativeNotifications(navigateToTab).then((cleanup) => {
      cleanupNotifications = cleanup;
    });

    if (!Capacitor.isNativePlatform()) {
      return () => {
        cleanupNotifications?.();
      };
    }

    if (Capacitor.getPlatform() === 'android') {
      StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
      StatusBar.setBackgroundColor({ color: '#0f172a' }).catch(() => {});
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      void consumePendingNotificationTab().then((tab) => {
        if (tab) navigateToTab(tab);
      });
    }

    const backListenerPromise = CapApp.addListener('backButton', ({ canGoBack: webCanGoBack }) => {
      if (canGoBackRef.current) {
        goBackRef.current();
      } else if (webCanGoBack) {
        window.history.back();
      } else {
        CapApp.exitApp();
      }
    });

    const appStateListenerPromise = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        if (!isUserActivelyTypingOrComposing()) {
          void refreshRef.current();
        }
        if (Capacitor.getPlatform() === 'android') {
          void consumePendingNotificationTab().then((tab) => {
            if (tab) navigateToTab(tab);
          });
        }
      } else if (Capacitor.getPlatform() === 'android') {
        scheduleBackgroundNotificationPoll();
      }
    });

    return () => {
      cleanupNotifications?.();
      backListenerPromise.then((handle) => handle.remove()).catch(() => {});
      appStateListenerPromise.then((handle) => handle.remove()).catch(() => {});
    };
  }, []);

  if (!activeToast) return null;

  const isUrgent = activeToast.category === 'urgent';
  const isSuccess = activeToast.category === 'success';

  return (
    <div className="fixed top-16 inset-x-0 z-50 px-3 pointer-events-none flex justify-center">
      <div
        role="status"
        onClick={() => {
          if (activeToast.targetTab) {
            setSelectedProviderId(null);
            setActiveTab(activeToast.targetTab);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
          setActiveToast(null);
        }}
        className={`pointer-events-auto max-w-md w-full rounded-2xl border p-3.5 shadow-xl flex items-start gap-3 cursor-pointer transition-all ${
          isUrgent
            ? 'bg-rose-50 dark:bg-rose-950/95 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-100'
            : isSuccess
            ? 'bg-emerald-50 dark:bg-emerald-950/95 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100'
            : 'bg-slate-900 dark:bg-slate-800 border-slate-700 text-white'
        }`}
      >
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
            isUrgent
              ? 'bg-rose-600 text-white'
              : isSuccess
              ? 'bg-emerald-600 text-white'
              : 'bg-teal-600 text-white'
          }`}
        >
          {isUrgent ? (
            <AlertTriangle className="w-4 h-4" />
          ) : isSuccess ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Bell className="w-4 h-4" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-extrabold leading-snug">{activeToast.title}</p>
          <p
            className={`text-[11px] leading-relaxed mt-0.5 line-clamp-2 ${
              isUrgent
                ? 'text-rose-800 dark:text-rose-200'
                : isSuccess
                ? 'text-emerald-800 dark:text-emerald-200'
                : 'text-slate-300'
            }`}
          >
            {activeToast.body}
          </p>
        </div>

        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={(e) => {
            e.stopPropagation();
            setActiveToast(null);
          }}
          className={`p-1 rounded-lg shrink-0 ${
            isUrgent || isSuccess
              ? 'text-slate-500 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10'
              : 'text-slate-400 hover:bg-white/10'
          }`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
