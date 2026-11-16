import React, { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Bell, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { useApp, type NavigationTab } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useAppNotifications } from '../../hooks/useAppNotifications';
import {
  initializeNativeNotifications,
  subscribeInAppNotificationToast,
  type AppNotificationPayload,
} from '../../services/nativeNotifications';

export const CapacitorNativeBridge: React.FC = () => {
  const { canGoBack, goBack, setActiveTab, setSelectedProviderId } = useApp();
  const { refreshFromServer } = useAuth();
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
        void refreshRef.current();
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
            ? 'bg-rose-50 border-rose-300 text-rose-950'
            : isSuccess
            ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
            : 'bg-slate-900 border-slate-700 text-white'
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
              isUrgent ? 'text-rose-800' : isSuccess ? 'text-emerald-800' : 'text-slate-300'
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
            isUrgent || isSuccess ? 'text-slate-500 hover:bg-black/5' : 'text-slate-400 hover:bg-white/10'
          }`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
